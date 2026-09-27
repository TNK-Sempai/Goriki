import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/service'
import { resend, FROM_EMAIL, REPLY_TO } from '@/lib/resend'
import { orderShippedHtml } from '@/lib/emails/order-shipped'

async function adminClient() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cs) { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return supabase
}

export async function GET(request: NextRequest) {
  const supabase = await adminClient()
  if (!supabase) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (id) {
    const { data, error } = await supabase
      .from('orders')
      // Le tarif est joint pour la fiche d'expédition : c'est lui qui dit si
      // l'option s'affranchit à la main (`kind = 'letter'`) ou passe par une
      // méthode Sendcloud, et si elle exige un point relais.
      .select('*, profiles(email, full_name), order_items(*), shipping_rates(code, label, kind, country, price, sendcloud_method_code, needs_service_point, tracked)')
      .eq('id', id)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { data, error } = await supabase
    .from('orders')
    .select('*, profiles(email, full_name)')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const supabase = await adminClient()
  if (!supabase) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { id, status, tracking_number } = await request.json()

  const { data: current, error: readError } = await supabase
    .from('orders')
    .select('id, status, total, user_id, store_credit_used, stripe_payment_id, tracking_number')
    .eq('id', id)
    .single()

  if (readError || !current) {
    return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
  }

  // ── Remboursement réel (mission 03 §C) ────────────────────────────────────
  // Remboursement TOTAL uniquement — le partiel est hors périmètre (V2).
  if (status === 'refunded' && current.status !== 'refunded') {
    const refund = await refundOrder(current)
    if (!refund.ok) {
      // Le statut n'est PAS modifié tant que l'argent n'est pas reparti.
      return NextResponse.json({ error: refund.error }, { status: 502 })
    }
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ status, tracking_number })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  /**
   * Email d'expédition, envoyé UNE seule fois.
   *
   * Deux déclencheurs, parce qu'il y a deux façons d'expédier : la première
   * saisie d'un numéro de suivi (colis Sendcloud), et le passage en « shipped »
   * (lettre simple, qui n'aura jamais de numéro). Sans le second, un client
   * servi par lettre n'était jamais prévenu du départ de sa commande.
   */
  const suiviNouveau = Boolean(tracking_number) && tracking_number !== current.tracking_number
  const passeEnExpediee = status === 'shipped' && current.status !== 'shipped'
  if (suiviNouveau || passeEnExpediee) {
    await sendShippedEmail(current.user_id, id, tracking_number || current.tracking_number || null)
  }

  return NextResponse.json(data)
}

interface RefundableOrder {
  id: string
  total: number
  user_id: string | null
  store_credit_used: number
  stripe_payment_id: string | null
}

/**
 * Rembourse : argent chez Stripe, puis stock ré-incrémenté, puis crédit boutique re-crédité.
 * L'ordre compte — rien n'est rendu au client tant que Stripe n'a pas confirmé.
 */
async function refundOrder(order: RefundableOrder): Promise<{ ok: true } | { ok: false; error: string }> {
  const service = createServiceClient()

  // Une commande réglée intégralement en crédit boutique n'a pas de PaymentIntent :
  // il n'y a rien à rembourser chez Stripe, seulement du crédit à rendre.
  if (order.total > 0) {
    if (!order.stripe_payment_id) {
      return { ok: false, error: 'Aucun paiement Stripe rattaché à cette commande · remboursement impossible' }
    }
    try {
      await stripe.refunds.create({ payment_intent: order.stripe_payment_id })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur Stripe'
      console.error(`[commandes] refund Stripe échoué (${order.id}):`, message)
      return { ok: false, error: `Remboursement Stripe refusé : ${message}` }
    }
  }

  const { error: restockError } = await service.rpc('restock_order', { p_order_id: order.id })
  if (restockError) {
    // L'argent est parti : on ne bloque pas, mais la commande est signalée.
    console.error(`[commandes] ré-incrément du stock échoué (${order.id}):`, restockError.message)
    await service
      .from('orders')
      .update({
        needs_review: true,
        review_reason: `Remboursé chez Stripe mais ré-incrément du stock échoué : ${restockError.message}`,
      })
      .eq('id', order.id)
  }

  if (order.store_credit_used > 0 && order.user_id) {
    const { data: profile } = await service
      .from('profiles')
      .select('store_credit')
      .eq('id', order.user_id)
      .single()

    await service
      .from('profiles')
      .update({ store_credit: (profile?.store_credit ?? 0) + order.store_credit_used })
      .eq('id', order.user_id)
  }

  return { ok: true }
}

/** Email d'expédition — non bloquant, comme la confirmation de commande. */
async function sendShippedEmail(userId: string | null, orderId: string, trackingNumber: string | null) {
  if (!userId) return
  try {
    const service = createServiceClient()
    const { data: profile } = await service
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .single()

    if (!profile?.email) return

    await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO,
      to: profile.email,
      subject: 'Votre commande est expédiée · Goriki',
      html: orderShippedHtml({
        orderNumber: orderId,
        customerName: profile.full_name ?? profile.email,
        trackingNumber,
      }),
    })
  } catch (err) {
    console.error(`[commandes] envoi de l'email d'expédition échoué (${orderId}):`, err)
  }
}
