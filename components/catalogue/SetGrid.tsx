import Link from 'next/link'
import { formatPrice } from '@/lib/utils'

export interface SetCardData {
  id: string
  code: string
  name_fr: string
  /** Nombre de cartes du set réellement disponibles à la vente */
  inStock: number
  /** Nombre total de cartes du set */
  total: number
  /** Prix d'entrée du set, `null` si rien en vente */
  priceFrom: number | null
  /** Jusqu'à 3 visuels de cartes réellement en vente dans ce set */
  preview?: string[]
}

/**
 * Grille de sets — réécrite sur la maquette `Tanuki Pokemon Series`.
 *
 * L'ancienne version (logo + nom + nombre de cartes) ne correspondait PAS à la
 * référence : celle-ci exige une barre de progression du stock et un prix
 * « dès … ». Composant réécrit plutôt que dupliqué, comme demandé au brief.
 */
export default function SetGrid({
  sets,
  basePath,
  emptyLabel,
}: {
  sets: SetCardData[]
  basePath: string
  emptyLabel?: string
}) {
  if (sets.length === 0) {
    return (
      <div className="glass rounded-block px-8 py-14 text-center">
        <p className="m-0 text-[14px] text-ink-70">
          {emptyLabel ?? 'Aucune extension pour le moment.'}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {sets.map(set => {
        const pct = set.total > 0 ? Math.round((set.inStock / set.total) * 100) : 0
        return (
          <Link
            key={set.id}
            href={`${basePath}/${set.id}`}
            className="glass glass-hoverable flex flex-col gap-3 rounded-panel px-5 py-5 transition-colors"
          >
            <span className="text-[15px] font-semibold uppercase leading-tight tracking-[-0.01em]">
              {set.name_fr}
            </span>

            {/* Progression du stock : part des cartes du set réellement en vente */}
            <div className="h-[3px] rounded-[2px] bg-[rgba(26,22,17,0.1)]">
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${pct}%`,
                  background: pct > 0 ? 'var(--color-ochre)' : 'transparent',
                }}
              />
            </div>

            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[9px] tracking-[0.06em] text-ink-55">
                {set.code} · {set.inStock}/{set.total}
              </span>
              {/* Jamais de tiret à la place d'un prix : un set dont aucune pièce
                  n'est chiffrée n'a pas de prix « inconnu », il n'a rien à
                  vendre. On le dit avec le mot du site, celui des tuiles et des
                  fiches, plutôt qu'avec un signe à interpréter. */}
              <span
                className={`text-[14px] font-semibold ${
                  set.priceFrom !== null ? 'text-ochre' : 'text-ink-55'
                }`}
              >
                {set.priceFrom !== null ? `dès ${formatPrice(set.priceFrom)}` : 'Épuisé'}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
