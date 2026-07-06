'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'

interface FilterPanelProps {
  rarities: string[]
  variants: { code: string; label: string }[]
  sets: { id: string; code: string; name_fr: string }[]
}

export default function FilterPanel({ rarities, variants, sets }: FilterPanelProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateFilter = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  const current = {
    set: searchParams.get('set_id') ?? '',
    rarity: searchParams.get('rarity') ?? '',
    variant: searchParams.get('variant') ?? '',
  }

  return (
    <aside className="w-52 flex-shrink-0">
      <div className="sticky top-24 space-y-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-2">Set</p>
          <select
            value={current.set}
            onChange={e => updateFilter('set_id', e.target.value)}
            className="input text-xs"
          >
            <option value="">Tous les sets</option>
            {sets.map(s => (
              <option key={s.id} value={s.id}>{s.name_fr}</option>
            ))}
          </select>
        </div>

        {rarities.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-2">Rareté</p>
            <div className="space-y-1">
              <button
                onClick={() => updateFilter('rarity', '')}
                className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${!current.rarity ? 'text-amber bg-amber/10' : 'text-muted hover:text-cream'}`}
              >
                Toutes
              </button>
              {rarities.map(r => (
                <button
                  key={r}
                  onClick={() => updateFilter('rarity', r)}
                  className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${current.rarity === r ? 'text-amber bg-amber/10' : 'text-muted hover:text-cream'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {variants.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-2">Variante</p>
            <div className="space-y-1">
              <button
                onClick={() => updateFilter('variant', '')}
                className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${!current.variant ? 'text-amber bg-amber/10' : 'text-muted hover:text-cream'}`}
              >
                Toutes
              </button>
              {variants.map(v => (
                <button
                  key={v.code}
                  onClick={() => updateFilter('variant', v.code)}
                  className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${current.variant === v.code ? 'text-amber bg-amber/10' : 'text-muted hover:text-cream'}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {(current.set || current.rarity || current.variant) && (
          <button
            onClick={() => router.push(pathname)}
            className="btn btn-ghost btn-sm w-full text-xs"
          >
            Réinitialiser
          </button>
        )}
      </div>
    </aside>
  )
}
