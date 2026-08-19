import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { getShippingProvider } from '@/lib/shipping'
import { createServiceClient } from '@/lib/supabase/service'
import { finalizeOrder } from '@/lib/orders/finalize'
import { MIN_ORDER_AMOUNT, CHECKOUT_TTL_MINUTES, SITE_URL } from '@/lib/constants'

interface CartItemInput {
  listingId: string
  tcg: 'pokemon' | 'onepiece' | 'sealed'
  name: string
  variantLabel?: string
  price: number
  quantity: number
  imageUrl?: string | null
}

interface ReserveResult {
  ok: boolean
  failures: { label: string; reason: string; available?: number }[]
}

const TABLE_BY_TCG: Record<CartItemInput['tcg'], string> = {
  pokemon: 'pokemon_listings',
  onepiece: 'onepiece_listings',
  sealed: 'sealed_products',
}

// La réservation doit survivre à l'expiration de la session Stripe, jamais l'inverse.
const ORDER_TTL_MINUTES = CHECKOUT_TTL_MINUTES + 5

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cs) { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const { items } = (await request.json()) as { items?: CartItemInput[] }
  if (!items?.length) return NextResponse.json({ error: 'Panier vide' }, { status: 400 })

  const service = createServiceClient()

  // Filet de sécurité : libère le stock des checkouts abandonnés dont le webhook
  // `checkout.session.expired` ne serait jamais arrivé.
  const { error: sweepError } = await service.rpc('release_expired_checkouts', { p_grace_minutes: 5 })
  if (sweepError) console.error('[checkout] balayage des checkouts expirés:', sweepError.message)

  // ── Validation serveur des prix et de la disponibilité ────────────────────
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
  const orderItems: {
    item_type: string
    item_id: string
    quantity: number
    price_at_purchase: number
    item_snapshot: { name: string; variantLabel?: string }
  }[] = []

  for (const item of items) {
    const table = TABLE_BY_TCG[item.tcg]
    if (!table) {
      return NextResponse.json({ error: `Type d'article inconnu : ${item.tcg}` }, { status: 400 })
    }

    const { data } = await supabase
      .from(table)
      .select('price, quantity, is_active')
      .eq('id', item.listingId)
      .single()

    if (!data || !data.is_active || data.quantity < item.quantity) {
      return NextResponse.json(
        { error: `${item.name} n'est plus disponible en quantité suffisante` },
        { status: 400 }
      )
    }

    lineItems.push({
      price_data: {
        currency: 'eur',
        product_data: {
          name: item.name,
          description: item.variantLabel ?? undefined,
          images: item.imageUrl ? [item.imageUrl] : [],
          metadata: { listing_id: item.listingId, tcg: item.tcg },
        },
        unit_amount: Math.round(data.price * 100), // centimes
      },
      quantity: item.quantity,
    })

    orderItems.push({
      item_type: item.tcg,
      item_id: item.listingId,
      quantity: item.quantity,
      price_at_purchase: data.price,
      item_snapshot: { name: item.name, variantLabel: item.variantLabel },
    })
  }

  // Sous-total MARCHANDISES : hors port, avant crédit boutique.
  const subtotal = orderItems.reduce((sum, i) => sum + i.price_at_purchase * i.quantity, 0)

  // ── Minimum de commande (addendum §F3) ────────────────────────────────────
  if (MIN_ORDER_AMOUNT > 0 && subtotal < MIN_ORDER_AMOUNT) {
    return NextResponse.json(
      {
        error: `Commande minimum : ${MIN_ORDER_AMOUNT.toFixed(2)} € d'articles (hors frais de port). Il manque ${(MIN_ORDER_AMOUNT - subtotal).toFixed(2)} €.`,
      },
      { status: 400 }
    )
  }

  // ── Crédit boutique ───────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('store_credit')
    .eq('id', user.id)
    .single()

  const creditToApply = Math.min(profile?.store_credit ?? 0, subtotal)

  const shippingOptions = await getShippingProvider().getOptions({
    subtotal: Math.round(subtotal * 100),
  })

  // ── Création de la commande `pending` AVANT Stripe (addendum §F1) ─────────
  // Le panier vit en base : seule la référence de commande transite par metadata,
  // qui est plafonnée à 500 caractères côté Stripe.
  const checkoutExpiresAt = new Date(Date.now() + ORDER_TTL_MINUTES * 60_000)

  const { data: order, error: orderError } = await service
    .from('orders')
    .insert({
      user_id: user.id,
      status: 'pending',
      total: Math.max(0, subtotal - creditToApply),
      shipping_cost: 0,
      store_credit_used: 0,
      checkout_expires_at: checkoutExpiresAt.toISOString(),
    })
    .select('id')
    .single()

  if (orderError || !order) {
    console.error('[checkout] création de la commande pending:', orderError?.message)
    return NextResponse.json({ error: 'Erreur lors de la création de la commande' }, { status: 500 })
  }

  const { error: itemsError } = await service
    .from('order_items')
    .insert(orderItems.map(i => ({ ...i, order_id: order.id })))

  if (itemsError) {
    console.error('[checkout] insertion des order_items:', itemsError.message)
    await service.from('orders').delete().eq('id', order.id)
    return NextResponse.json({ error: 'Erreur lors de la création de la commande' }, { status: 500 })
  }

  // ── Réservation de stock (mission 03 §B) ──────────────────────────────────
  const { data: reserveData, error: reserveError } = await service.rpc('reserve_order_stock', {
    p_order_id: order.id,
  })

  if (reserveError) {
    console.error('[checkout] RPC reserve_order_stock:', reserveError.message)
    await service.from('orders').delete().eq('id', order.id)
    return NextResponse.json({ error: 'Erreur lors de la réservation du stock' }, { status: 500 })
  }

  const reserve = reserveData as ReserveResult
  if (!reserve.ok) {
    await service.from('orders').delete().eq('id', order.id)
    const detail = reserve.failures
      .map(f => (f.available !== undefined ? `${f.label} : ${f.reason} (${f.available} restant)` : `${f.label} : ${f.reason}`))
      .join(' · ')
    return NextResponse.json(
      { error: `Stock insuffisant — ${detail}` },
      { status: 409 }
    )
  }

  // ── Cas du total 0 € : crédit couvrant tout ET port offert (addendum §F4) ──
  // Stripe refuse une Checkout Session à 0 € en mode `payment` : on court-circuite
  // Stripe et on finalise par le MÊME chemin que le webhook.
  const shippingAlwaysFree = shippingOptions.every(o => o.amount === 0)

  if (creditToApply >= subtotal && shippingAlwaysFree) {
    // Aucune adresse n'est collectée sans Stripe : on reprend la dernière connue.
    const { data: lastOrder } = await service
      .from('orders')
      .select('shipping_address')
      .eq('user_id', user.id)
      .not('shipping_address', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const shippingAddress = (lastOrder?.shipping_address as Record<string, unknown> | null) ?? null

    const result = await finalizeOrder(service, {
      orderId: order.id,
      paymentId: null,
      sessionId: null,
      total: 0,
      shippingCost: 0,
      shippingAddress,
      storeCreditUsed: creditToApply,
    })

    if (!result.ok) {
      await service.rpc('release_order_checkout', { p_order_id: order.id })
      return NextResponse.json({ error: 'Erreur lors de la création de la commande' }, { status: 500 })
    }

    if (!shippingAddress) {
      // Sans adresse, l'admin doit contacter le client : la commande est signalée.
      await service
        .from('orders')
        .update({
          needs_review: true,
          review_reason: 'Commande réglée intégralement en crédit boutique : adresse de livraison à collecter (aucune commande payée antérieure).',
        })
        .eq('id', order.id)
    }

    return NextResponse.json({
      url: `${SITE_URL}/checkout/success?order_id=${order.id}`,
      free: true,
    })
  }

  // ── Session Stripe ────────────────────────────────────────────────────────
  const stripeShippingOptions: Stripe.Checkout.SessionCreateParams.ShippingOption[] =
    shippingOptions.map((option) => ({
      shipping_rate_data: {
        type: 'fixed_amount',
        fixed_amount: { amount: option.amount, currency: option.currency },
        display_name: option.displayName,
        ...(option.minDeliveryDays !== undefined && option.maxDeliveryDays !== undefined
          ? {
              delivery_estimate: {
                minimum: { unit: 'business_day', value: option.minDeliveryDays },
                maximum: { unit: 'business_day', value: option.maxDeliveryDays },
              },
            }
          : {}),
      },
    }))

  try {
    // Le crédit boutique passe par un coupon à usage unique : Stripe REFUSE un
    // line item à `unit_amount` négatif (« Invalid non-negative integer »).
    // Le montant s'impute sur les marchandises, avant les frais de port.
    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined
    if (creditToApply > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: Math.round(creditToApply * 100),
        currency: 'eur',
        duration: 'once',
        name: `Crédit boutique Goriki — ${creditToApply.toFixed(2)} €`,
        max_redemptions: 1,
        redeem_by: Math.floor((Date.now() + ORDER_TTL_MINUTES * 60_000) / 1000),
        metadata: { order_id: order.id },
      })
      discounts = [{ coupon: coupon.id }]
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      ...(discounts ? { discounts } : {}),
      customer_email: user.email,
      // Le panier n'est PLUS sérialisé ici : seule la référence de commande transite.
      metadata: {
        order_id: order.id,
        user_id: user.id,
        store_credit_used: creditToApply.toString(),
      },
      // Recopiée sur le PaymentIntent : sans elle, `payment_intent.payment_failed`
      // arrive sans aucun moyen de remonter à la commande.
      payment_intent_data: { metadata: { order_id: order.id } },
      // +60 s de marge : Stripe exige au moins 30 minutes dans le futur.
      expires_at: Math.floor((Date.now() + CHECKOUT_TTL_MINUTES * 60_000 + 60_000) / 1000),
      success_url: `${SITE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/panier`,
      locale: 'fr',
      shipping_address_collection: { allowed_countries: ['BE', 'FR', 'LU', 'NL', 'DE'] },
      shipping_options: stripeShippingOptions,
    })

    const { error: linkError } = await service
      .from('orders')
      .update({ stripe_session_id: session.id })
      .eq('id', order.id)

    if (linkError) {
      console.error('[checkout] liaison stripe_session_id:', linkError.message)
      await stripe.checkout.sessions.expire(session.id).catch(() => {})
      await service.rpc('release_order_checkout', { p_order_id: order.id })
      return NextResponse.json({ error: 'Erreur lors de la création de la commande' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (stripeError) {
    console.error('[checkout] création de la session Stripe:', stripeError)
    await service.rpc('release_order_checkout', { p_order_id: order.id })
    return NextResponse.json({ error: 'Le paiement est momentanément indisponible' }, { status: 502 })
  }
}
