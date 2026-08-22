'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { Era } from '@/lib/catalogue/series'
import type { SetCardData } from './SetGrid'

/**
 * Liste des sets d'un univers — case 2 de la planche de référence.
 *
 * Composition de la planche, dans l'ordre : grand titre d'univers à gauche,
 * champ de recherche aligné à droite sur la même ligne de base, rangée de
 * pilules de filtre, puis grille 3 colonnes de tuiles de set — chaque tuile
 * portant un ÉVENTAIL de cartes du set, pas un simple logo. Un bouton
 * « Voir tous les sets » ferme la section tant que tout n'est pas déplié.
 *
 * Remplace la landing « bento » précédente (hero + gros bloc Singles + grille
 * asymétrique de catégories de scellé) : cette composition-là ne figure nulle
 * part dans la planche.
 *
 * Les pilules sont construites sur les `serie_name` RÉELS de la base
 * (« Boosters », « Extra Boosters », « Starter Decks », « Promos »…), jamais
 * sur la liste fictive dessinée dans l'image.
 */

const PAGE = 9

function SetTile({ set, basePath }: { set: SetCardData; basePath: string }) {
  const preview = set.preview ?? []
  const pct = set.total > 0 ? Math.round((set.inStock / set.total) * 100) : 0

  return (
    <Link
      href={`${basePath}/${set.id}`}
      data-card-hover
      className="glass glass-hoverable group flex flex-col overflow-hidden rounded-panel-lg transition-colors"
    >
      {/* Éventail : la tuile de set MONTRE des cartes du set. */}
      <div className="relative flex h-[168px] items-center justify-center overflow-hidden bg-[rgba(26,22,17,0.045)]">
        {preview.length > 0 ? (
          preview.map((src, i) => {
            const off = i - (preview.length - 1) / 2
            return (
              // eslint-disable-next-line @next/next/no-img-element -- vignette décorative en éventail, transformée
              <img
                key={i}
                src={src}
                alt=""
                aria-hidden
                loading="lazy"
                className="absolute h-[132px] rounded-[6px] object-cover shadow-[0_16px_30px_-14px_rgba(26,22,17,0.55)] transition-transform duration-500 group-hover:-translate-y-1"
                style={{
                  transform: `translateX(${off * 58}px) rotate(${off * 8}deg)`,
                  zIndex: 3 - Math.abs(off),
                }}
              />
            )
          })
        ) : (
          <span className="data text-[9px] text-ink-55">Aucune pièce en vente</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 px-4 py-3.5">
        <span className="display-sub">{set.code}</span>
        <span className="line-clamp-1 text-[12px] leading-tight text-ink-70">{set.name_fr}</span>
        <div className="mt-2 h-[3px] rounded-[2px] bg-[rgba(26,22,17,0.1)]">
          <div
            className="h-full rounded-[2px]"
            style={{ width: `${pct}%`, background: pct > 0 ? 'var(--color-ochre)' : 'transparent' }}
          />
        </div>
        <span className="data mt-1.5 text-[9px]">
          {set.total} carte{set.total > 1 ? 's' : ''} · {set.inStock} dispo
        </span>
      </div>
    </Link>
  )
}

export default function SetsIndex({
  title,
  eras,
  basePath,
  emptyLabel,
}: {
  title: string
  eras: Era[]
  basePath: string
  emptyLabel?: string
}) {
  const [filter, setFilter] = useState<string>('*')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)

  // Pilules : « Tous » + les séries réellement présentes, les plus fournies
  // d'abord — c'est l'ordre que suit la planche (principaux sets en tête).
  const series = useMemo(
    () => eras.map(e => ({ name: e.name, n: e.sets.length })).sort((a, b) => b.n - a.n),
    [eras]
  )

  const sets = useMemo(() => {
    const q = query.trim().toLowerCase()
    return eras
      .filter(e => filter === '*' || e.name === filter)
      .flatMap(e => e.sets)
      .filter(s => !q || s.name_fr.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))
  }, [eras, filter, query])

  const shown = expanded ? sets : sets.slice(0, PAGE)

  return (
    <>
      <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between lg:mb-9">
        <h1 className="display-section m-0">{title}</h1>
        <div className="relative w-full sm:w-[300px]">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher un set…"
            aria-label="Rechercher un set"
            className="field pr-9"
          />
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-55"
          >
            <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12.8 12.8 17 17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {series.length > 1 && (
        <div className="mb-7 flex flex-wrap gap-2 lg:mb-9">
          <button type="button" className="pill" data-active={filter === '*'} onClick={() => { setFilter('*'); setExpanded(false) }}>
            Tous
          </button>
          {series.map(s => (
            <button
              key={s.name}
              type="button"
              className="pill"
              data-active={filter === s.name}
              onClick={() => { setFilter(s.name); setExpanded(false) }}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="glass rounded-block px-8 py-14 text-center">
          <p className="m-0 text-[14px] text-ink-70">
            {sets.length === 0 && !query
              ? (emptyLabel ?? 'Aucune extension pour le moment.')
              : `Aucun set ne correspond à « ${query} ».`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map(set => (
            <SetTile key={set.id} set={set} basePath={basePath} />
          ))}
        </div>
      )}

      {sets.length > PAGE && (
        <div className="mt-8 flex justify-center lg:mt-10">
          <button
            type="button"
            onClick={() => setExpanded(x => !x)}
            className="rounded-control border border-[rgba(26,22,17,0.16)] bg-[rgba(255,255,255,0.6)] px-7 py-3.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink transition-colors hover:bg-white"
          >
            {expanded ? 'Réduire' : `Voir tous les sets (${sets.length})`}
          </button>
        </div>
      )}
    </>
  )
}
