'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { formatPrice } from '@/lib/utils'

export interface WtbRow {
  id: string
  label: string
  max_price: number | null
  created_at: string
}

export default function WantToBuyList({ rows }: { rows: WtbRow[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  async function remove(id: string) {
    setBusy(id)
    await fetch(`/api/compte/want-to-buy?id=${id}`, { method: 'DELETE' })
    setBusy(null)
    router.refresh()
  }

  if (rows.length === 0) {
    return (
      <p className="m-0 text-[14px] leading-[1.6] text-ink-70">
        Aucune demande active. Ajoutez les cartes que vous cherchez : nous vous
        prévenons dès qu&apos;une d&apos;elles arrive en stock.
      </p>
    )
  }

  return (
    <div className="flex flex-col">
      {rows.map(row => (
        <div
          key={row.id}
          className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[rgba(26,22,17,0.08)] py-4 last:border-0"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[14px]">{row.label}</span>
            <span className="mono-meta">
              {new Date(row.created_at).toLocaleDateString('fr-FR')}
              {row.max_price != null ? ` · max ${formatPrice(row.max_price)}` : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={() => remove(row.id)}
            disabled={busy === row.id}
            className="font-mono text-[10px] tracking-[0.1em] text-ink-55 transition-colors hover:text-[#8A2F1D] disabled:opacity-50"
          >
            {busy === row.id ? '…' : 'RETIRER'}
          </button>
        </div>
      ))}
    </div>
  )
}
