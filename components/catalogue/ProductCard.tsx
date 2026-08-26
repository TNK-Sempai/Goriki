import Image from 'next/image'
import Link from 'next/link'
import { prixDepuis } from '@/lib/utils'

export interface ProductCardData {
  id: string
  name: string
  /** Référence technique affichée en mono (ex. `OP05-119`, `SV03-121`) */
  ref: string
  price: number
  imageUrl: string | null
  /** Ex. « Near Mint » — affiché sous la référence quand fourni */
  grade?: string | null
  soldOut?: boolean
}

/**
 * Carte produit du catalogue et de la home.
 *
 * L'absence de visuel n'est pas un trou : la DA prévoit un emplacement
 * « scan à venir » hachuré, au même ratio 63/88 que la carte.
 */
export default function ProductCard({ card }: { card: ProductCardData }) {
  return (
    <Link
      href={`/${card.id}`}
      className="glass-light glass-hoverable group flex flex-col gap-3 rounded-panel p-3.5 transition-colors"
    >
      <div className="relative aspect-[63/88] w-full overflow-hidden rounded-control">
        {card.imageUrl ? (
          <Image
            src={card.imageUrl}
            alt={card.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover shadow-[0_12px_26px_-12px_rgba(26,22,17,0.35)] transition-transform duration-300 group-hover:-translate-y-0.5"
          />
        ) : (
          <div className="scan-pending flex h-full w-full items-center justify-center rounded-control">
            <span className="font-mono text-[10px] tracking-[0.12em] text-[rgba(26,22,17,0.45)]">
              scan à venir
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-[3px]">
        <span className="text-[14px] font-semibold leading-tight text-ink">{card.name}</span>
        <span className="mono-meta">{card.ref}</span>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          {/* `prixDepuis` dit déjà « Épuisé » quand aucun prix n'est saisi :
              l'ancien badge ÉPUISÉ ne s'affiche donc plus que lorsqu'il ajoute
              quelque chose — une pièce chiffrée mais sans stock. Sans ce
              garde-fou, la vignette répétait le mot deux fois de suite. */}
          <span className="text-[15px] font-semibold text-ink">{prixDepuis(card.price)}</span>
          {card.soldOut && card.price > 0 ? (
            <span className="mono-meta">ÉPUISÉ</span>
          ) : card.grade ? (
            <span className="mono-meta">{card.grade}</span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
