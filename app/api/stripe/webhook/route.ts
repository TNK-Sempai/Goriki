import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Stripe from 'stripe'
import { resend, FROM_EMAIL } from '@/lib/resend'
import { orderConfirmedHtml } from '@/lib/emails/order-confirmed'

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
    console.error('Webhook signature error:', err)
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.user_id
    const itemsJson = session.metadata?.items_json

    if (!userId || !itemsJson) return NextResponse.json({ received: true })

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // service role pour bypass RLS
      { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
    )

    const items = JSON.parse(itemsJson)
    const shippingAddress = session.collected_information?.shipping_details?.address

    // Créer la commande
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        status: 'paid',
        total: (session.amount_total ?? 0) / 100,
        stripe_payment_id: session.payment_intent as string,
        stripe_session_id: session.id,
        shipping_address: shippingAddress,
      })
      .select('id')
      .single()

    if (orderError || !order) {
      console.error('Order creation error:', orderError)
      return NextResponse.json({ error: 'Erreur création commande' }, { status: 500 })
    }

    // Créer les order_items et décrémenter les stocks
    for (const item of items) {
      await supabase.from('order_items').insert({
        order_id: order.id,
        item_type: item.tcg,
        item_id: item.listing_id,
        quantity: item.quantity,
        price_at_purchase: item.price,
        item_snapshot: { name: item.name },
      })

      // Décrémenter le stock
      const table = item.tcg === 'sealed' ? 'sealed_products' : `${item.tcg}_listings`
      const { data: current } = await supabase
        .from(table).select('quantity').eq('id', item.listing_id).single()

      if (current) {
        const newQty = Math.max(0, current.quantity - item.quantity)
        await supabase.from(table).update({
          quantity: newQty,
          is_active: newQty > 0,
        }).eq('id', item.listing_id)
      }
    }

    // Déduire le store credit utilisé
    const creditUsed = parseFloat(session.metadata?.store_credit_used ?? '0')
    if (creditUsed > 0) {
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('store_credit')
        .eq('id', userId)
        .single()

      const newCredit = Math.max(0, (currentProfile?.store_credit ?? 0) - creditUsed)
      await supabase.from('profiles').update({ store_credit: newCredit }).eq('id', userId)

      // Enregistrer dans la commande
      await supabase.from('orders')
        .update({ store_credit_used: creditUsed })
        .eq('id', order.id)
    }

    // Envoyer email de confirmation
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', userId)
        .single()

      if (profile?.email) {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: profile.email,
          subject: `Commande confirmée — Goriki`,
          html: orderConfirmedHtml({
            orderNumber: order.id,
            customerName: profile.full_name ?? profile.email,
            items: items.map((i: { name: string; quantity: number; price: number }) => ({
              name: i.name,
              quantity: i.quantity,
              price: i.price,
            })),
            total: (session.amount_total ?? 0) / 100,
            shippingAddress: (session.collected_information?.shipping_details?.address as unknown as Record<string, string> | undefined) ?? null,
          }),
        })
      }
    } catch (emailError) {
      // Email non bloquant — la commande est créée même si l'email échoue
      console.error('Email confirmation error:', emailError)
    }
  }

  return NextResponse.json({ received: true })
}
