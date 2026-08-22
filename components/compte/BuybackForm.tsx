'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BuybackForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/compte/rachat', {
      method: 'POST',
      body: new FormData(e.currentTarget),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Envoi impossible.')
      return
    }
    setDone(true)
    router.refresh()
  }

  if (done) {
    return (
      <p className="m-0 rounded-control border border-[rgba(200,134,10,0.35)] bg-[rgba(200,134,10,0.10)] px-4 py-4 text-[14px] leading-[1.6] text-ink">
        Demande enregistrée. Nous revenons vers vous avec une offre chiffrée, en général
        sous 48 heures ouvrées.
      </p>
    )
  }

  const field =
    'w-full rounded-control border border-[rgba(26,22,17,0.15)] bg-[rgba(255,255,255,0.55)] px-4 py-3 text-[14px] text-ink placeholder:text-ink-55'

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="data text-[9px]">Votre lot</span>
        <textarea
          name="description"
          rows={4}
          required
          minLength={20}
          placeholder="Séries, langues, états approximatifs, cartes notables…"
          className={field}
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="data text-[9px]">Nombre de cartes</span>
          <input name="quantity" type="number" min={1} required placeholder="120" className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="data text-[9px]">Votre estimation (optionnel)</span>
          <input name="estimate" type="text" inputMode="decimal" placeholder="150" className={field} />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="data text-[9px]">Photos — 5 maximum</span>
        <input
          name="photos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className={`${field} file:mr-4 file:rounded-control file:border-0 file:bg-[rgba(26,22,17,0.9)] file:px-4 file:py-2 file:font-mono file:text-[10px] file:tracking-[0.1em] file:text-parchment`}
        />
      </label>

      {error && (
        <p className="m-0 rounded-control border border-[rgba(138,47,29,0.35)] bg-[rgba(138,47,29,0.08)] px-4 py-3 text-[13px] text-[#8A2F1D]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-ochre self-start px-6 py-3.5 text-[14px] disabled:opacity-60"
      >
        {loading ? 'Envoi…' : 'Envoyer ma demande'}
      </button>
    </form>
  )
}
