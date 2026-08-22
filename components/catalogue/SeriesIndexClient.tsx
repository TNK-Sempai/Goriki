'use client'

import { useState, useMemo } from 'react'
import SetGrid from './SetGrid'
import type { Era } from '@/lib/catalogue/series'

/**
 * Index des séries — recherche vivante sur le nom et le code d'extension,
 * comme la maquette (`Tanuki Pokemon Series` / `Tanuki Series`).
 * Les données sont déjà chargées côté serveur : le filtrage est local, sans
 * aller-retour réseau.
 */
export default function SeriesIndexClient({
  eras,
  basePath,
  emptyLabel,
}: {
  eras: Era[]
  basePath: string
  emptyLabel?: string
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return eras
    return eras
      .map(era => ({
        ...era,
        sets: era.sets.filter(
          s => s.name_fr.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
        ),
      }))
      .filter(era => era.sets.length > 0)
  }, [eras, query])

  const total = eras.reduce((n, e) => n + e.sets.length, 0)

  return (
    <>
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-mono text-[10px] tracking-[0.14em] text-ink-55">
          {total} EXTENSION{total > 1 ? 'S' : ''}
        </span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher une extension…"
          aria-label="Rechercher une extension"
          className="w-full rounded-control border border-[rgba(26,22,17,0.15)] bg-[rgba(255,255,255,0.6)] px-4 py-3 text-[13px] text-ink placeholder:text-ink-55 sm:w-[320px]"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="glass rounded-block px-8 py-14 text-center">
          <p className="m-0 text-[14px] text-ink-70">
            {total === 0
              ? (emptyLabel ?? 'Aucune extension pour le moment.')
              : `Aucune extension ne correspond à « ${query} ».`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-14">
          {filtered.map(era => (
            <section key={era.name}>
              <div className="mb-5 flex items-baseline justify-between gap-4">
                <h2 className="m-0 text-[20px] font-semibold tracking-[-0.02em] lg:text-[24px]">
                  {era.name}
                </h2>
                <span className="font-mono text-[10px] tracking-[0.14em] text-ink-55">
                  {era.sets.length} SET{era.sets.length > 1 ? 'S' : ''}
                </span>
              </div>
              <SetGrid sets={era.sets} basePath={basePath} />
            </section>
          ))}
        </div>
      )}
    </>
  )
}
