'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

interface Group {
  key: string
  title: string
  options: { value: string; label: string }[]
}

/**
 * Filtres d'un set — colonne collante de la maquette (`Tanuki Set` /
 * `Tanuki Pokemon Set`) : recherche, version, rareté, état, « en stock ».
 *
 * L'état vit dans l'URL : les filtres restent partageables, fonctionnent sans
 * JavaScript côté rendu initial, et le tri/filtrage reste fait par la base.
 */
export default function SetFilters({
  groups,
  sorts,
}: {
  groups: Group[]
  sorts: { value: string; label: string }[]
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

  function toggle(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (next.get(key) === value) next.delete(key)
    else next.set(key, value)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  const inStock = params.get('stock') === '1'
  const activeSort = params.get('sort') ?? sorts[0]?.value

  const pill = (on: boolean) =>
    `rounded-control border px-3 py-2 font-mono text-[10px] tracking-[0.06em] transition-colors ${
      on
        ? 'border-transparent bg-[rgba(26,22,17,0.9)] text-parchment'
        : 'border-[rgba(26,22,17,0.15)] bg-[rgba(255,255,255,0.45)] text-ink hover:bg-[rgba(255,255,255,0.75)]'
    }`

  return (
    <aside className="glass flex flex-col gap-7 rounded-block p-6 lg:sticky lg:top-28">
      <div className="flex flex-col gap-2">
        <span className="data text-[9px]">Recherche</span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Nom ou numéro…"
          aria-label="Rechercher dans ce set"
          className="w-full rounded-control border border-[rgba(26,22,17,0.15)] bg-[rgba(255,255,255,0.6)] px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-55"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="data text-[9px]">Tri</span>
        <div className="flex flex-wrap gap-2">
          {sorts.map(s => (
            <button key={s.value} type="button" onClick={() => toggle('sort', s.value)} className={pill(activeSort === s.value)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {groups.map(g => (
        <div key={g.key} className="flex flex-col gap-2">
          <span className="data text-[9px]">{g.title}</span>
          <div className="flex flex-wrap gap-2">
            {g.options.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(g.key, o.value)}
                className={pill(params.get(g.key) === o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => toggle('stock', '1')}
        className={`flex items-center justify-between rounded-control border px-3.5 py-3 text-[13px] transition-colors ${
          inStock
            ? 'border-[rgba(200,134,10,0.5)] bg-[rgba(200,134,10,0.12)]'
            : 'border-[rgba(26,22,17,0.15)] bg-[rgba(255,255,255,0.45)]'
        }`}
      >
        <span>En stock uniquement</span>
        <span className="font-mono text-[10px]">{inStock ? 'ON' : 'OFF'}</span>
      </button>
    </aside>
  )
}
