import Image from 'next/image'
import Link from 'next/link'
import { prixOuEpuise } from '@/lib/utils'

export interface SealedProduct {
  id: string
  name: string
  /** Ligne technique : « SV3.5 · FR · 36 BOOSTERS · SOUS BLISTER » */
  meta: string
  price: number
  quantity: number
  imageUrl: string | null
}

/**
 * Ligne produit scellé — générique, valable pour TOUTE catégorie
 * (displays, boosters, blisters, ETB, UPC, coffrets, starter decks…).
 * Un seul composant, aucune duplication par catégorie (règle du brief).
 */
export default function SealedRow({ product }: { product: SealedProduct }) {
  const soldOut = product.quantity <= 0

  return (
    <Link
      href={`/${product.id}`}
      className="glass glass-hoverable flex flex-col gap-4 rounded-panel p-4 transition-colors sm:flex-row sm:items-center sm:gap-6 sm:p-5"
    >
      <div className="relative h-[86px] w-[120px] shrink-0 overflow-hidden rounded-control">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="120px"
            className="object-contain"
          />
        ) : (
          <div className="scan-pending flex h-full w-full items-center justify-center rounded-control">
            <span className="font-mono text-[9px] tracking-[0.1em] text-[rgba(26,22,17,0.45)]">
              visuel à venir
            </span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-[16px] font-semibold leading-tight">{product.name}</span>
        <span className="mono-meta uppercase">{product.meta}</span>
      </div>

      <div className="flex items-center justify-between gap-6 sm:justify-end">
        {/* Même règle que sur la tuile : ne pas répéter « Épuisé », que le
            prix affiche déjà quand rien n'est chiffré. */}
        <span className="font-mono text-[10px] tracking-[0.1em] text-ink-55">
          {product.price > 0 ? (soldOut ? 'ÉPUISÉ' : `${product.quantity} EN STOCK`) : 'NON CHIFFRÉ'}
        </span>
        <span className="text-[18px] font-semibold">{prixOuEpuise(product.price)}</span>
      </div>
    </Link>
  )
}
