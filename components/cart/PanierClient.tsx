'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '@/hooks/useCart'
import { formatPrice } from '@/lib/utils'
import { SHIPPING_RATES } from '@/lib/constants'

export default function PanierClient() {
  const { items, removeItem, updateQty, total } = useCart()

  const isEmpty = items.length === 0
  const freeShipping = total >= SHIPPING_RATES.FREE_THRESHOLD
  const missing = SHIPPING_RATES.FREE_THRESHOLD - total

  return (
    <main className="page-shell pb-16 pt-10 font-grotesk text-ink">
      <h1 className="m-0 mb-8 text-[32px] font-semibold tracking-[-0.03em] sm:text-[38px] lg:text-[44px]">
        Panier
      </h1>

      {isEmpty ? (
        <div className="glass flex flex-col items-center gap-4 rounded-hero px-8 py-20 text-center lg:px-14 lg:py-24">
          <span className="font-mono text-[10px] tracking-[0.2em] text-[rgba(26,22,17,0.5)]">
            PANIER VIDE
          </span>
          <span className="text-[22px] font-semibold tracking-[-0.02em] lg:text-[26px]">
            Aucune carte pour l&apos;instant.
          </span>
          <p className="m-0 max-w-[42ch] text-[14px] leading-[1.6] text-[rgba(26,22,17,0.65)]">
            Les belles pièces partent vite — jetez un œil aux dernières arrivées ou à
            votre wishlist.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link href="/catalogue" className="btn-ochre px-6 py-3.5 text-[14px]">
              Découvrir les cartes
            </Link>
            <Link href="/compte/wishlist" className="btn-ghost px-5 py-3.5 text-[14px]">
              Ma wishlist
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          {/* ── Lignes ─────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-4">
            {items.map(item => (
              <div
                key={item.listingId}
                className="glass flex flex-col gap-4 rounded-panel p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5"
              >
                <div className="relative aspect-[63/88] w-[88px] shrink-0 overflow-hidden rounded-control">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      sizes="88px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="scan-pending flex h-full w-full items-center justify-center rounded-control">
                      <span className="font-mono text-[9px] tracking-[0.1em] text-[rgba(26,22,17,0.45)]">
                        scan
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link href={`/${item.listingId}`} className="text-[15px] font-semibold leading-tight">
                    {item.name}
                  </Link>
                  {item.variantLabel && <span className="mono-meta uppercase">{item.variantLabel}</span>}
                  <span className="mono-meta">{formatPrice(item.price)} l&apos;unité</span>
                </div>

                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <div className="glass-light flex items-center rounded-control">
                    <button
                      type="button"
                      onClick={() => updateQty(item.listingId, item.quantity - 1)}
                      aria-label={`Retirer une unité de ${item.name}`}
                      className="h-[34px] w-[34px] text-[15px] text-ink transition-colors hover:text-ochre"
                    >
                      −
                    </button>
                    <span className="min-w-[28px] text-center font-mono text-[12px]">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.listingId, item.quantity + 1)}
                      disabled={item.quantity >= item.maxQuantity}
                      aria-label={`Ajouter une unité de ${item.name}`}
                      className="h-[34px] w-[34px] text-[15px] text-ink transition-colors hover:text-ochre disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[15px] font-semibold">
                      {formatPrice(item.price * item.quantity)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.listingId)}
                      className="font-mono text-[10px] tracking-[0.1em] text-[rgba(26,22,17,0.5)] transition-colors hover:text-ochre"
                    >
                      RETIRER
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Récapitulatif ──────────────────────────────────────────── */}
          <aside className="glass flex flex-col rounded-block p-7 lg:sticky lg:top-24">
            <span className="mb-6 text-[17px] font-semibold">Récapitulatif</span>

            <div className="flex justify-between py-2 text-[14px]">
              <span className="text-[rgba(26,22,17,0.65)]">Sous-total</span>
              <span className="font-medium">{formatPrice(total)}</span>
            </div>
            <div className="flex justify-between py-2 text-[14px]">
              <span className="text-[rgba(26,22,17,0.65)]">Livraison estimée</span>
              <span className="font-medium">
                {freeShipping ? 'Offerte' : `dès ${formatPrice(SHIPPING_RATES.BE)}`}
              </span>
            </div>
            <div className="px-0 pb-3 pt-1 text-[12px] text-ink-55">
              {freeShipping
                ? `Livraison offerte dès ${formatPrice(SHIPPING_RATES.FREE_THRESHOLD)} — c'est bon !`
                : `Offerte dès ${formatPrice(SHIPPING_RATES.FREE_THRESHOLD)} d'achat (encore ${formatPrice(missing)})`}
            </div>

            <div className="my-2 mb-4 h-px bg-[rgba(26,22,17,0.12)]" />

            <div className="mb-6 flex items-baseline justify-between">
              <span className="text-[15px] font-semibold">Total</span>
              <span className="text-[24px] font-semibold">{formatPrice(total)}</span>
            </div>

            <Link href="/checkout" className="btn-ochre py-4 text-center text-[15px]">
              Passer commande
            </Link>
            <Link href="/catalogue" className="mt-3.5 text-center text-[13px] text-ink-60">
              Continuer mes achats
            </Link>

            <p className="mt-4 text-center text-[11px] leading-[1.5] text-ink-55">
              Le montant définitif des frais de port est fixé à l&apos;étape de paiement,
              selon la zone de livraison.
            </p>
          </aside>
        </div>
      )}
    </main>
  )
}
