'use client'

import { useState } from 'react'
import { useCart } from '@/hooks/useCart'
import { formatPrice } from '@/lib/utils'
import { useRouter } from 'next/navigation'

export default function CheckoutPage() {
  const { items, total } = useCart()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (items.length === 0) {
    router.push('/panier')
    return null
  }

  async function handleCheckout() {
    setLoading(true)
    setError(null)

    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Erreur lors du paiement')
      setLoading(false)
      return
    }

    window.location.href = data.url
  }

  return (
    <main className="min-h-screen bg-base">
      <div className="container-goriki py-12 max-w-2xl">
        <h1 className="font-display text-2xl text-cream mb-8">Récapitulatif de commande</h1>

        <div className="card mb-6">
          {items.map(item => (
            <div key={item.listingId} className="flex items-center justify-between py-3 border-b border-dim last:border-0">
              <div className="flex items-center gap-3">
                {item.imageUrl && (
                  <img src={item.imageUrl} alt={item.name} className="w-10 h-14 object-cover rounded" />
                )}
                <div>
                  <p className="text-cream text-sm">{item.name}</p>
                  {item.variantLabel && <p className="text-muted text-xs">{item.variantLabel}</p>}
                  <p className="text-muted text-xs">× {item.quantity}</p>
                </div>
              </div>
              <p className="text-amber text-sm">{formatPrice(item.price * item.quantity)}</p>
            </div>
          ))}
        </div>

        <div className="card-elevated mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-muted text-sm">Sous-total</span>
            <span className="text-cream">{formatPrice(total)}</span>
          </div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-muted text-sm">Livraison</span>
            <span className="text-muted text-sm">Calculée par Stripe</span>
          </div>
          <div className="flex justify-between items-center pt-4 border-t border-dim">
            <span className="font-display text-lg text-cream">Total</span>
            <span className="font-display text-2xl text-amber">{formatPrice(total)}</span>
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-950/30 border border-red-900/40 rounded px-4 py-3 mb-4">
            {error}
          </p>
        )}

        <button
          onClick={handleCheckout}
          disabled={loading}
          className="btn btn-primary btn-lg w-full"
        >
          {loading ? 'Redirection vers Stripe...' : `Payer ${formatPrice(total)}`}
        </button>

        <p className="text-muted text-xs text-center mt-4">
          Paiement sécurisé par Stripe. Nous ne stockons pas vos données bancaires.
        </p>
      </div>
    </main>
  )
}
