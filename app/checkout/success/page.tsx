import { stripe } from '@/lib/stripe'
import Link from 'next/link'
import CartCleaner from '@/components/cart/CartCleaner'

interface Props { searchParams: Promise<{ session_id?: string; order_id?: string }> }

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { session_id, order_id } = await searchParams

  let orderEmail = ''
  let orderTotal = 0

  if (session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id)
      orderEmail = session.customer_email ?? ''
      orderTotal = (session.amount_total ?? 0) / 100
    } catch {
      // Session invalide — on affiche quand même la page de succès
    }
  }

  // Commande réglée intégralement en crédit boutique : aucune session Stripe,
  // la référence de commande arrive directement du checkout.
  const paidWithCredit = !session_id && Boolean(order_id)

  return (
    <main className="min-h-screen bg-base flex items-center justify-center p-8">
      <CartCleaner />
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-amber/10 border border-amber/30 flex items-center justify-center mx-auto mb-6">
          <span className="text-amber text-2xl">✓</span>
        </div>
        <h1 className="font-display text-3xl text-cream mb-3">Commande confirmée</h1>
        {orderEmail && (
          <p className="text-muted mb-2">
            Un email de confirmation a été envoyé à <strong className="text-cream">{orderEmail}</strong>.
          </p>
        )}
        {orderTotal > 0 && (
          <p className="text-amber font-display text-xl mb-6">{orderTotal.toFixed(2)} €</p>
        )}
        {paidWithCredit && (
          <p className="text-amber font-display text-xl mb-6">Réglée par votre crédit boutique</p>
        )}
        <p className="text-muted text-sm mb-8">
          Votre commande est en cours de préparation. Vous recevrez un email avec le numéro de suivi dès l&apos;expédition.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/compte/commandes" className="btn btn-primary">Mes commandes</Link>
          <Link href="/catalogue" className="btn btn-outline">Continuer mes achats</Link>
        </div>
      </div>
    </main>
  )
}
