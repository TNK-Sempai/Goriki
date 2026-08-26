import Image from 'next/image'
import Link from 'next/link'
import { prixOuEpuise } from '@/lib/utils'

export interface SealedProduct {
  id: string
  name: string
  /** Ligne technique reconstruite depuis les colonnes réelles */
  meta: string
  price: number
  quantity: number
  imageUrl: string | null
}

/**
 * Tuile produit scellé — case 5 de la planche de référence.
 *
 * La planche dispose les scellés en GRILLE de tuiles produit (visuel centré sur
 * un fond clair, puis nom, ligne technique, prix), pas en liste de lignes
 * pleine largeur comme la version précédente. Un seul composant sert toutes
 * les catégories : displays, boosters, ETB, tins, coffrets, accessoires.
 */
export default function SealedTile({ product }: { product: SealedProduct }) {
  const soldOut = product.quantity <= 0

  return (
    <Link
      href={`/${product.id}`}
      data-card-hover
      className="glass glass-hoverable group flex flex-col overflow-hidden rounded-panel-lg transition-colors"
    >
      <div className="relative flex h-[196px] items-center justify-center overflow-hidden bg-[rgba(26,22,17,0.045)]">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-contain p-6 transition-transform duration-500 group-hover:-translate-y-1"
          />
        ) : (
          <div className="scan-pending flex h-[130px] w-[168px] items-center justify-center rounded-control">
            <span className="data text-[9px]">visuel à venir</span>
          </div>
        )}

        {soldOut && (
          <span className="corner-tag absolute left-3 top-3">Épuisé</span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-4 py-3.5">
        <span className="line-clamp-2 text-[13px] font-semibold leading-tight text-ink">{product.name}</span>
        <span className="data mt-1.5 line-clamp-1 text-[9px]">{product.meta}</span>
        <div className="mt-auto flex items-baseline justify-between gap-2 pt-3">
          <span className="text-[16px] font-semibold text-ink">{prixOuEpuise(product.price)}</span>
          {/* Le prix porte déjà « Épuisé » quand rien n'est chiffré : cette
              ligne ne redit le mot que si l'article a un prix mais plus de
              stock, ce qui est une information différente. */}
          <span className="data text-[9px]">
            {product.price > 0 ? (soldOut ? 'Épuisé' : `${product.quantity} en stock`) : 'Non chiffré'}
          </span>
        </div>
      </div>
    </Link>
  )
}
