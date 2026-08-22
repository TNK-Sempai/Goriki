'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

/**
 * Barre d'outils d'un set — case 3 de la planche de référence.
 *
 * La planche ne pose PAS de colonne de filtres collante à gauche : elle pose
 * une barre d'onglets de RARETÉ pleine largeur (TOUT · LEADER · COMMON · RARE ·
 * SR · SEC · ALT ART · MANGA), puis une ligne d'outils compacte — recherche à
 * gauche, sélecteurs à droite. La grille de cartes occupe alors toute la
 * largeur, ce qui est précisément ce qui donne sa densité à cet écran.
 *
 * Remplace `SetFilters` sur cet écran. L'état reste dans l'URL : filtres
 * partageables, tri et filtrage toujours faits par la base.
 */

interface Option {
  value: string
  label: string
}

export default function SetToolbar({
  rarities,
  variants,
  conditions,
  sorts,
}: {
  rarities: Option[]
  variants: Option[]
  conditions: Option[]
  sorts: Option[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')

  // Recherche différée : on ne pousse pas une URL à chaque frappe.
  useEffect(() => {
    const current = params.get('q') ?? ''
    if (query === current) return
    const id = setTimeout(() => {
      const next = new URLSearchParams(params.toString())
      if (query) next.set('q', query)
      else next.delete('q')
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    }, 300)
    return () => clearTimeout(id)
  }, [query, params, pathname, router])

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (!value || next.get(key) === value) next.delete(key)
    else next.set(key, value)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  const rarity = params.get('rarity')
  const inStock = params.get('stock') === '1'

  const select =
    'rounded-control border border-[rgba(26,22,17,0.14)] bg-[rgba(255,255,255,0.6)] px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink transition-colors hover:bg-white'

  return (
    <>
      {/* Onglets de rareté — pleine largeur, filet en pied, comme la planche. */}
      <div className="mb-5 flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-[rgba(26,22,17,0.12)] pb-0">
        <button
          type="button"
          onClick={() => set('rarity', '')}
          data-active={!rarity}
          className="nav-link px-3 !text-[12px] uppercase tracking-[0.08em]"
        >
          Tout
        </button>
        {rarities.map(r => (
          <button
            key={r.value}
            type="button"
            onClick={() => set('rarity', r.value)}
            data-active={rarity === r.value}
            className="nav-link px-3 !text-[12px] uppercase tracking-[0.08em]"
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Ligne d'outils : recherche à gauche, sélecteurs à droite. */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-[320px]">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher une carte…"
            aria-label="Rechercher dans ce set"
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

        <div className="flex flex-wrap items-center gap-2">
          {variants.length > 0 && (
            <select
              aria-label="Version"
              className={select}
              value={params.get('variant') ?? ''}
              onChange={e => set('variant', e.target.value)}
            >
              <option value="">Version · toutes</option>
              {variants.map(v => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          )}

          <select
            aria-label="État"
            className={select}
            value={params.get('condition') ?? ''}
            onChange={e => set('condition', e.target.value)}
          >
            <option value="">État · tous</option>
            {conditions.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          <select
            aria-label="Trier"
            className={select}
            value={params.get('sort') ?? sorts[0]?.value}
            onChange={e => set('sort', e.target.value)}
          >
            {sorts.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => set('stock', '1')}
            className="pill font-mono !text-[10px] uppercase !tracking-[0.1em]"
            data-active={inStock}
          >
            Disponibles
          </button>
        </div>
      </div>
    </>
  )
}
