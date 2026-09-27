import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/service'
import { finalizeOrder } from '@/lib/orders/finalize'

const HANDLED_EVENTS = [
  'checkout.session.completed',
  'checkout.session.expired',
  'payment_intent.payment_failed',
] as const

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[webhook] signature invalide:', err)
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 })
  }

  if (!(HANDLED_EVENTS as readonly string[]).includes(event.type)) {
    return NextResponse.json({ received: true, ignored: event.type })
  }

  const service = createServiceClient()
  const orderId = extractOrderId(event)

  // ── Idempotence niveau 1 : un event.id n'est traité qu'une fois ────────────
  // (le niveau 2 — transition d'état sous verrou — vit dans la RPC finalize_paid_order)
  const { error: eventError } = await service.from('stripe_events').insert({
    id: event.id,
    type: event.type,
    order_id: orderId,
    payload: event.data.object as unknown as Record<string, unknown>,
  })

  if (eventError) {
    // 23505 = clé dupliquée : Stripe rejoue un événement déjà traité.
    if (eventError.code === '23505') {
      return NextResponse.json({ received: true, duplicate: true })
    }
    console.error('[webhook] journalisation de l\'événement:', eventError.message)
    // On continue : mieux vaut traiter deux fois (la RPC est idempotente) que pas du tout.
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        return await handleCompleted(service, event.data.object as Stripe.Checkout.Session)
      case 'checkout.session.expired':
        return await handleExpired(service, event.data.object as Stripe.Checkout.Session)
      case 'payment_intent.payment_failed':
        return await handlePaymentFailed(service, event.data.object as Stripe.PaymentIntent, orderId)
    }
  } catch (err) {
    console.error(`[webhook] traitement de ${event.type} échoué:`, err)
    // 500 → Stripe rejouera ; l'idempotence protège le rejeu.
    return NextResponse.json({ error: 'Traitement échoué' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

/** Paiement confirmé : finalisation par le chemin partagé avec le bypass 0 €. */
async function handleCompleted(
  service: ReturnType<typeof createServiceClient>,
  session: Stripe.Checkout.Session
) {
  const orderId = session.metadata?.order_id ?? (await findOrderIdBySession(service, session.id))

  if (!orderId) {
    console.error(`[webhook] aucune commande rattachée à la session ${session.id}`)
    // 200 : rejouer n'y changerait rien (session hors de ce système, ex. ancienne version).
    return NextResponse.json({ received: true, orphan: true })
  }

  // Le port et l'adresse ne viennent PLUS de Stripe. Depuis que la livraison se
  // choisit sur notre page (point relais compris), `shipping_cost` et
  // `shipping_address` sont écrits à la création de la commande. Les relire ici
  // les écraserait par du vide : Stripe ne collecte plus ni l'un ni l'autre.
  const { data: commande } = await service
    .from('orders')
    .select('shipping_cost, shipping_address')
    .eq('id', orderId)
    .maybeSingle()

  const result = await finalizeOrder(service, {
    orderId,
    paymentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
    sessionId: session.id,
    total: (session.amount_total ?? 0) / 100,
    shippingCost: Number(commande?.shipping_cost ?? 0),
    shippingAddress: (commande?.shipping_address as Record<string, unknown> | null) ?? null,
    storeCreditUsed: parseFloat(session.metadata?.store_credit_used ?? '0'),
  })

  if (!result.ok) {
    return NextResponse.json({ error: 'Finalisation échouée' }, { status: 500 })
  }

  return NextResponse.json({
    received: true,
    already_finalized: result.alreadyFinalized,
    stock_failures: result.stockFailures.length,
  })
}

/** Session expirée : la commande pending est purgée, le stock réservé revient en vente. */
async function handleExpired(
  service: ReturnType<typeof createServiceClient>,
  session: Stripe.Checkout.Session
) {
  const orderId = session.metadata?.order_id ?? (await findOrderIdBySession(service, session.id))
  if (!orderId) return NextResponse.json({ received: true, orphan: true })

  const { data, error } = await service.rpc('release_order_checkout', { p_order_id: orderId })
  if (error) {
    console.error('[webhook] RPC release_order_checkout:', error.message)
    return NextResponse.json({ error: 'Libération échouée' }, { status: 500 })
  }

  return NextResponse.json({ received: true, release: data })
}

/**
 * Échec de paiement : trace en base (la ligne `stripe_events` fait foi) et signalement
 * de la commande pending pour que l'admin la retrouve. Le stock reste réservé jusqu'à
 * expiration de la session — le client peut encore réessayer.
 */
async function handlePaymentFailed(
  service: ReturnType<typeof createServiceClient>,
  intent: Stripe.PaymentIntent,
  orderId: string | null
) {
  const reason = intent.last_payment_error?.message ?? 'Paiement refusé'

  if (orderId) {
    await service
      .from('orders')
      .update({ review_reason: `Échec de paiement Stripe : ${reason}` })
      .eq('id', orderId)
      .eq('status', 'pending')
  }

  console.error(`[webhook] payment_intent.payment_failed (${intent.id}) : ${reason}`)
  return NextResponse.json({ received: true, traced: true })
}

/** L'order_id voyage en metadata ; sur un PaymentIntent il vient de la session d'origine. */
function extractOrderId(event: Stripe.Event): string | null {
  const object = event.data.object as { metadata?: Record<string, string> | null }
  return object.metadata?.order_id ?? null
}

async function findOrderIdBySession(
  service: ReturnType<typeof createServiceClient>,
  sessionId: string
): Promise<string | null> {
  const { data } = await service
    .from('orders')
    .select('id')
    .eq('stripe_session_id', sessionId)
    .maybeSingle()
  return data?.id ?? null
}
