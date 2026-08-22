'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Result {
  card_type: 'pokemon' | 'onepiece'
  card_id: string
  label: string
}

export default function WantToBuyForm() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [picked, setPicked] = useState<Result | null>(null)
  const [freeText, setFreeText] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (picked || query.trim().length < 2) {
      setResults([])
      return
    }
    const id = setTimeout(async () => {
      const res = await fetch(`/api/compte/want-to-buy?q=${encodeURIComponent(query)}`)
      const data = await res.json().catch(() => ({ results: [] }))
      setResults(data.results ?? [])
    }, 250)
    return () => clearTimeout(id)
  }, [query, picked])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/compte/want-to-buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        card_id: picked?.card_id ?? null,
        card_type: picked?.card_type ?? null,
        free_text: picked ? null : freeText,
        max_price: maxPrice,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)

    if (!res.ok) { setError(data.error ?? 'Enregistrement impossible.'); return }

    setQuery(''); setPicked(null); setFreeText(''); setMaxPrice(''); setResults([])
    router.refresh()
  }

  const field =
    'w-full rounded-control border border-[rgba(26,22,17,0.15)] bg-[rgba(255,255,255,0.55)] px-4 py-3 text-[14px] text-ink placeholder:text-ink-55'

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="relative flex flex-col gap-1.5">
        <span className="data text-[9px]">Chercher dans le catalogue</span>
        {picked ? (
          <div className="flex items-center justify-between gap-3 rounded-control border border-[rgba(200,134,10,0.4)] bg-[rgba(200,134,10,0.10)] px-4 py-3">
            <span className="text-[14px]">{picked.label}</span>
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="font-mono text-[10px] tracking-[0.1em] text-ink-55 hover:text-ochre"
            >
              CHANGER
            </button>
          </div>
        ) : (
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Nom de la carte…"
            className={field}
          />
        )}

        {results.length > 0 && (
          <ul className="glass absolute top-full z-10 mt-1 flex w-full list-none flex-col rounded-panel p-1.5">
            {results.map(r => (
              <li key={`${r.card_type}-${r.card_id}`}>
                <button
                  type="button"
                  onClick={() => { setPicked(r); setResults([]); setQuery('') }}
                  className="w-full rounded-control px-3 py-2 text-left text-[13px] hover:bg-[rgba(26,22,17,0.06)]"
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!picked && (
        <label className="flex flex-col gap-1.5">
          <span className="data text-[9px]">Ou décrivez-la — si elle n&apos;est pas au catalogue</span>
          <input
            value={freeText}
            onChange={e => setFreeText(e.target.value)}
            placeholder="Ex. Dracaufeu 1ère édition, japonais, PSA 8"
            className={field}
          />
        </label>
      )}

      <label className="flex flex-col gap-1.5 sm:max-w-[240px]">
        <span className="data text-[9px]">Prix maximum (optionnel)</span>
        <input
          value={maxPrice}
          onChange={e => setMaxPrice(e.target.value)}
          inputMode="decimal"
          placeholder="120"
          className={field}
        />
      </label>

      {error && (
        <p className="m-0 rounded-control border border-[rgba(138,47,29,0.35)] bg-[rgba(138,47,29,0.08)] px-4 py-3 text-[13px] text-[#8A2F1D]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || (!picked && freeText.trim().length === 0)}
        className="btn-ochre self-start px-6 py-3.5 text-[14px] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Enregistrement…' : 'Ajouter à ma liste'}
      </button>
    </form>
  )
}
