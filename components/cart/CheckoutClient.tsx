'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCart } from '@/hooks/useCart'
import { formatPrice } from '@/lib/utils'
import { SHIPPING_RATES, MIN_ORDER_AMOUNT } from '@/lib/constants'

export default function CheckoutClient({ storeCredit }: { storeCredit: number }) {
  const { items, total } = useCart()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  // Redirection APRÈS hydratation seulement : le panier vit en sessionStorage,
  // il est vide au premier rendu (fix mission 02, à ne pas casser).
  useEffect(() => {
    if (hydrated && items.length === 0) router.push('/panier')
  }, [hydrated, items, router])

  if (!hydrated || items.length === 0) return null

  const freeShipping = total >= SHIPPING_RATES.FREE_THRESHOLD
  const belowMinimum = MIN_ORDER_AMOUNT > 0 && total < MIN_ORDER_AMOUNT
  const creditApplied = Math.min(storeCredit, total)

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
    <main className="page-shell pb-16 pt-8 font-grotesk text-ink">
      <nav className="mb-6 font-mono text-[10px] tracking-[0.14em] text-ink-55">
        <Link href="/panier" className="text-[rgba(26,22,17,0.55)]">PANIER</Link>
        {' / '}
        <span className="text-ink">CHECKOUT</span>
        {' / '}
        <span>PAIEMENT (STRIPE)</span>
      </nav>

      <h1 className="m-0 mb-8 text-[32px] font-semibold tracking-[-0.03em] sm:text-[38px] lg:text-[44px]">
        Commande
      </h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="flex flex-col gap-5">
          {/* ── Adresse ────────────────────────────────────────────────── */}
          <section className="glass flex flex-col gap-3 rounded-block p-7">
            <span className="text-[16px] font-semibold">Adresse de livraison</span>
            <p className="m-0 max-w-[52ch] text-[14px] leading-[1.6] text-ink-70">
              Elle est saisie à l&apos;étape suivante, directement sur la page de paiement
              sécurisée. Nous ne stockons aucune donnée bancaire.
            </p>
            <span className="mono-meta uppercase">Belgique · France · Luxembourg · Pays-Bas · Allemagne</span>
          </section>

          {/* ── Livraison ──────────────────────────────────────────────── */}
          <section className="glass flex flex-col gap-3 rounded-block p-7">
            <span className="text-[16px] font-semibold">Mode de livraison</span>
            <div className="flex flex-col gap-2">
              {freeShipping ? (
                <div className="glass-light flex items-center justify-between rounded-control px-4 py-3 text-[14px]">
                  <span>Livraison offerte</span>
                  <span className="font-medium">0,00 €</span>
                </div>
              ) : (
                <>
                  <div className="glass-light flex items-center justify-between rounded-control px-4 py-3 text-[14px]">
                    <span>Belgique</span>
                    <span className="font-medium">{formatPrice(SHIPPING_RATES.BE)}</span>
                  </div>
                  <div className="glass-light flex items-center justify-between rounded-control px-4 py-3 text-[14px]">
                    <span>France · Luxembourg · Pays-Bas · Allemagne</span>
                    <span className="font-medium">{formatPrice(SHIPPING_RATES.EU)}</span>
                  </div>
                </>
              )}
            </div>
            <span className="text-[12px] text-ink-55">
              {freeShipping
                ? `Offerte dès ${formatPrice(SHIPPING_RATES.FREE_THRESHOLD)} d'achat — c'est acquis.`
                : `Offerte dès ${formatPrice(SHIPPING_RATES.FREE_THRESHOLD)} d'achat. Le mode se choisit sur la page de paiement.`}
            </span>
          </section>

          {/* ── Store credit ───────────────────────────────────────────── */}
          <section className="glass flex flex-col gap-3 rounded-block p-7">
            <span className="text-[16px] font-semibold">Store credit</span>
            {storeCredit > 0 ? (
              <div className="flex flex-col gap-1">
                <span className="text-[14px] font-semibold">
                  Utiliser mon avoir — {formatPrice(creditApplied)}
                </span>
                <span className="text-[12px] text-ink-60">
                  Déduit automatiquement du total, dans la limite du montant des articles.
                </span>
              </div>
            ) : (
              <p className="m-0 text-[14px] leading-[1.6] text-ink-70">
                Aucun avoir disponible. Un rachat de cartes vous en crédite un.
              </p>
            )}
          </section>
        </div>

        {/* ── Récapitulatif ────────────────────────────────────────────── */}
        <aside className="glass flex flex-col rounded-block p-7 lg:sticky lg:top-24">
          <span className="mb-5 text-[17px] font-semibold">Votre commande</span>

          <div className="flex flex-col gap-2.5">
            {items.map(item => (
              <div key={item.listingId} className="flex justify-between gap-3 text-[14px]">
                <span className="min-w-0">
                  <span className="line-clamp-2">{item.name}</span>{' '}
                  <span className="text-[rgba(26,22,17,0.5)]">× {item.quantity}</span>
                </span>
                <span className="shrink-0 font-medium">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="my-4 h-px bg-[rgba(26,22,17,0.12)]" />

          <div className="flex justify-between py-1.5 text-[14px]">
            <span className="text-[rgba(26,22,17,0.65)]">Sous-total</span>
            <span>{formatPrice(total)}</span>
          </div>
          <div className="flex justify-between py-1.5 text-[14px]">
            <span className="text-[rgba(26,22,17,0.65)]">Livraison</span>
            <span>{freeShipping ? 'Offerte' : 'à l\'étape suivante'}</span>
          </div>
          {creditApplied > 0 && (
            <div className="flex justify-between py-1.5 text-[14px]">
              <span className="text-[rgba(26,22,17,0.65)]">Avoir client</span>
              <span>− {formatPrice(creditApplied)}</span>
            </div>
          )}

          <div className="my-3 h-px bg-[rgba(26,22,17,0.12)]" />

          <div className="mb-5 flex items-baseline justify-between">
            <span className="text-[15px] font-semibold">Total</span>
            <span className="text-[24px] font-semibold lg:text-[26px]">
              {formatPrice(Math.max(0, total - creditApplied))}
            </span>
          </div>

          {belowMinimum && (
            <p className="mb-3 rounded-control border border-[rgba(200,134,10,0.35)] bg-[rgba(200,134,10,0.10)] px-4 py-3 text-[13px] leading-[1.5] text-ink">
              Commande minimum : {formatPrice(MIN_ORDER_AMOUNT)} d&apos;articles.
              Il manque {formatPrice(MIN_ORDER_AMOUNT - total)}.
            </p>
          )}

          {error && (
            <p className="mb-3 rounded-control border border-[rgba(185,28,28,0.35)] bg-[rgba(185,28,28,0.08)] px-4 py-3 text-[13px] leading-[1.5] text-[#8c1d1d]">
              {error}
            </p>
          )}

          <button
            onClick={handleCheckout}
            disabled={loading || belowMinimum}
            className="btn-ochre py-4 text-[15px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Redirection vers Stripe…' : 'Payer'}
          </button>

          <span className="mt-3 text-center font-mono text-[9px] tracking-[0.12em] text-[rgba(26,22,17,0.5)]">
            PAIEMENT SÉCURISÉ — REDIRECTION VERS STRIPE
          </span>
        </aside>
      </div>
    </main>
  )
}
