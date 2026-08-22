import Link from 'next/link'
import { stripe } from '@/lib/stripe'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import CartCleaner from '@/components/cart/CartCleaner'
import { createClient } from '@/lib/supabase/server'
import { formatPrice } from '@/lib/utils'

export const metadata = { title: 'Commande confirmée' }

interface Props { searchParams: Promise<{ session_id?: string; order_id?: string }> }

interface OrderLine {
  quantity: number
  price_at_purchase: number
  item_snapshot: { name?: string } | null
}

interface OrderSummary {
  id: string
  total: number
  shipping_cost: number | null
  store_credit_used: number | null
  order_items: OrderLine[]
}

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { session_id, order_id } = await searchParams

  let orderEmail = ''
  let orderId = order_id ?? null

  // Le webhook rattache la commande à la session : on retrouve l'une par l'autre.
  if (session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id)
      orderEmail = session.customer_email ?? ''
      orderId = session.metadata?.order_id ?? orderId
    } catch {
      // Session invalide — la page de confirmation reste affichée.
    }
  }

  const supabase = await createClient()
  let order: OrderSummary | null = null

  if (orderId) {
    const { data } = await supabase
      .from('orders')
      .select('id, total, shipping_cost, store_credit_used, order_items(quantity, price_at_purchase, item_snapshot)')
      .eq('id', orderId)
      .maybeSingle()
    order = (data as unknown as OrderSummary | null) ?? null
  }

  const lines = order?.order_items ?? []
  const itemsSubtotal = lines.reduce((s, l) => s + l.price_at_purchase * l.quantity, 0)

  return (
    <>
      <SiteHeader />
      <CartCleaner />

      <main className="page-shell pb-20 pt-12 font-grotesk text-ink">
        <div className="mx-auto w-full max-w-[720px]">
        <div className="glass flex flex-col gap-6 rounded-hero p-8 lg:p-10">
          <div className="flex flex-col gap-3">
            <span className="eyebrow">Paiement confirmé</span>
            <h1 className="m-0 text-[28px] font-semibold tracking-[-0.03em] lg:text-[34px]">
              Merci, la commande est à nous.
            </h1>
            {orderEmail && (
              <p className="m-0 text-[14px] leading-[1.6] text-ink-70">
                Un email de confirmation part vers <strong className="font-semibold">{orderEmail}</strong>.
              </p>
            )}
          </div>

          {order && (
            <>
              <div className="flex flex-col gap-1">
                <span className="mono-meta uppercase">N° de commande</span>
                <span className="font-mono text-[15px]">#{order.id.slice(0, 8).toUpperCase()}</span>
              </div>

              <div className="h-px bg-[rgba(26,22,17,0.12)]" />

              <div className="flex flex-col gap-2.5">
                {lines.map((l, i) => (
                  <div key={i} className="flex justify-between gap-3 text-[14px]">
                    <span>
                      {l.item_snapshot?.name ?? 'Article'}{' '}
                      <span className="text-[rgba(26,22,17,0.5)]">× {l.quantity}</span>
                    </span>
                    <span className="shrink-0 font-medium">
                      {formatPrice(l.price_at_purchase * l.quantity)}
                    </span>
                  </div>
                ))}

                {lines.length > 0 && (
                  <div className="flex justify-between gap-3 text-[14px]">
                    <span className="text-[rgba(26,22,17,0.65)]">Sous-total articles</span>
                    <span>{formatPrice(itemsSubtotal)}</span>
                  </div>
                )}
                <div className="flex justify-between gap-3 text-[14px]">
                  <span className="text-[rgba(26,22,17,0.65)]">Livraison</span>
                  <span>
                    {order.shipping_cost && order.shipping_cost > 0
                      ? formatPrice(order.shipping_cost)
                      : 'Offerte'}
                  </span>
                </div>
                {order.store_credit_used ? (
                  <div className="flex justify-between gap-3 text-[14px]">
                    <span className="text-[rgba(26,22,17,0.65)]">Avoir client</span>
                    <span>− {formatPrice(order.store_credit_used)}</span>
                  </div>
                ) : null}
              </div>

              <div className="h-px bg-[rgba(26,22,17,0.12)]" />

              <div className="flex items-baseline justify-between">
                <span className="text-[15px] font-semibold">Total payé</span>
                <span className="text-[26px] font-semibold">{formatPrice(order.total)}</span>
              </div>
            </>
          )}

          <p className="m-0 text-[13px] leading-[1.6] text-ink-70">
            Votre commande est en préparation. Vous recevrez le numéro de suivi dès
            l&apos;expédition.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/compte/commandes" className="btn-ochre px-6 py-3.5 text-center text-[14px]">
              Suivre mes commandes
            </Link>
            <Link href="/catalogue" className="btn-ghost px-6 py-3.5 text-center text-[14px]">
              Retour à la boutique
            </Link>
          </div>
        </div>
        </div>
      </main>

      <SiteFooter />
    </>
  )
}
