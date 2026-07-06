import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cs) { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const { items } = await request.json()
  if (!items?.length) return NextResponse.json({ error: 'Panier vide' }, { status: 400 })

  // Valider les stocks et prix côté server
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []

  for (const item of items) {
    const table = item.tcg === 'sealed' ? 'sealed_products' : `${item.tcg}_listings`
    const { data } = await supabase.from(table).select('price, quantity, is_active').eq('id', item.listingId).single()

    if (!data || !data.is_active || data.quantity < item.quantity) {
      return NextResponse.json({ error: `${item.name} n'est plus disponible en quantité suffisante` }, { status: 400 })
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
  }

  // Vérifier le store credit disponible
  const { data: profile } = await supabase
    .from('profiles')
    .select('store_credit')
    .eq('id', user.id)
    .single()

  const storeCredit = profile?.store_credit ?? 0
  const subtotal = lineItems.reduce((sum, item) => {
    const unitAmount = (item.price_data as { unit_amount: number }).unit_amount
    const qty = item.quantity as number
    return sum + unitAmount * qty
  }, 0) / 100

  const creditToApply = Math.min(storeCredit, subtotal)

  if (creditToApply > 0) {
    lineItems.push({
      price_data: {
        currency: 'eur',
        product_data: {
          name: 'Crédit boutique Goriki',
          description: `Avoir déduit : ${creditToApply.toFixed(2)} €`,
        },
        unit_amount: -Math.round(creditToApply * 100), // négatif = réduction
      },
      quantity: 1,
    })
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: lineItems,
    customer_email: user.email,
    metadata: {
      user_id: user.id,
      store_credit_used: creditToApply.toString(),
      items_json: JSON.stringify(items.map((i: { listingId: string; tcg: string; quantity: number; price: number; name: string }) => ({
        listing_id: i.listingId,
        tcg: i.tcg,
        quantity: i.quantity,
        price: i.price,
        name: i.name,
      }))),
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/panier`,
    locale: 'fr',
    shipping_address_collection: { allowed_countries: ['BE', 'FR', 'LU', 'NL', 'DE'] },
  })

  return NextResponse.json({ url: session.url })
}
