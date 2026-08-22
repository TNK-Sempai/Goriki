'use client'

import Link from 'next/link'
import { useState } from 'react'
import { formatPrice } from '@/lib/utils'

/**
 * Want list — case 8 de la planche de référence.
 *
 * Composition de la planche : titre « MA WANT LIST », accroche, rangée
 * d'ONGLETS COMPTÉS (Toutes · Trouvées · En attente), puis une liste de lignes
 * portant chacune une vignette de carte, le nom, la référence, une puce d'état
 * et un bouton « Voir ». L'écran précédent n'affichait que les demandes
 * `active`, sans vignette, sans état, sans onglet — les demandes satisfaites
 * étaient donc invisibles.
 */

export interface WantRow {
  id: string
  label: string
  ref: string | null
  imageUrl: string | null
  maxPrice: number | null
  /** statut réel de `want_to_buy_requests` */
  status: string
  /** identifiant du listing en vente, si la pièce est disponible */
  listingId: string | null
  createdAt: string
}

const ONGLETS = [
  { key: 'all', label: 'Toutes' },
  { key: 'fulfilled', label: 'Trouvées' },
  { key: 'active', label: 'En attente' },
] as const

export default function WantList({ rows }: { rows: WantRow[] }) {
  const [tab, setTab] = useState<string>('all')

  const compte = (key: string) => (key === 'all' ? rows.length : rows.filter(r => r.status === key).length)
  const visibles = tab === 'all' ? rows : rows.filter(r => r.status === tab)

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2">
        {ONGLETS.map(o => (
          <button
            key={o.key}
            type="button"
            className="pill"
            data-active={tab === o.key}
            onClick={() => setTab(o.key)}
          >
            {o.label} ({compte(o.key)})
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <div className="glass rounded-block px-8 py-14 text-center">
          <p className="m-0 text-[14px] text-ink-70">
            {rows.length === 0
              ? "Votre want list est vide. Ajoutez une recherche ci-dessous et nous vous prévenons dès qu'une pièce entre en stock."
              : 'Aucune demande dans cet onglet.'}
          </p>
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-panel-lg">
          {visibles.map(r => {
            const trouvee = r.status === 'fulfilled'
            return (
              <div
                key={r.id}
                className="flex items-center gap-4 border-b border-[rgba(26,22,17,0.09)] px-4 py-3 last:border-0"
              >
                {r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- vignette de ligne de liste
                  <img
                    src={r.imageUrl}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    className="h-16 w-[46px] shrink-0 rounded-[4px] object-cover shadow-[0_8px_16px_-8px_rgba(26,22,17,0.5)]"
                  />
                ) : (
                  <span className="scan-pending h-16 w-[46px] shrink-0 rounded-[4px]" />
                )}

                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="line-clamp-1 text-[13px] font-medium leading-tight text-ink">{r.label}</span>
                  <span className="data mt-1 text-[8px]">
                    {r.ref ?? 'Recherche libre'}
                    {r.maxPrice !== null ? ` · jusqu'à ${formatPrice(r.maxPrice)}` : ''}
                  </span>
                </span>

                <span className="status shrink-0" data-tone={trouvee ? 'done' : 'wait'}>
                  {trouvee ? 'Trouvée' : r.status === 'cancelled' ? 'Annulée' : 'En attente'}
                </span>

                {r.listingId ? (
                  <Link
                    href={`/${r.listingId}`}
                    className="shrink-0 rounded-control border border-[rgba(26,22,17,0.16)] bg-[rgba(255,255,255,0.6)] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-white"
                  >
                    Voir
                  </Link>
                ) : (
                  <span className="data w-[70px] shrink-0 text-right text-[9px] text-ink-55">—</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
