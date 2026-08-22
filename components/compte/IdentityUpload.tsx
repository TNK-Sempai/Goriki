'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function IdentityUpload({ disabled }: { disabled?: boolean }) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setError(null)

    const body = new FormData()
    body.append('document', file)

    const res = await fetch('/api/compte/identite', { method: 'POST', body })
    const data = await res.json().catch(() => ({}))
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Envoi impossible.')
      return
    }
    setFile(null)
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="data text-[9px]">Pièce d&apos;identité</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          disabled={disabled || loading}
          onChange={e => setFile(e.target.files?.[0] ?? null)}
          className="w-full rounded-control border border-[rgba(26,22,17,0.15)] bg-[rgba(255,255,255,0.55)] px-4 py-3 text-[13px] text-ink file:mr-4 file:rounded-control file:border-0 file:bg-[rgba(26,22,17,0.9)] file:px-4 file:py-2 file:font-mono file:text-[10px] file:tracking-[0.1em] file:text-parchment"
        />
      </label>

      <p className="m-0 text-[12px] leading-[1.6] text-ink-55">
        Carte d&apos;identité, passeport ou permis. JPEG, PNG, WebP ou PDF, 5 Mo maximum.
        Le document est stocké dans un espace privé : ni vous ni personne d&apos;autre
        n&apos;y accédez par une URL publique, et seul un administrateur peut le consulter
        pour la validation.
      </p>

      {error && (
        <p className="m-0 rounded-control border border-[rgba(138,47,29,0.35)] bg-[rgba(138,47,29,0.08)] px-4 py-3 text-[13px] text-[#8A2F1D]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!file || loading || disabled}
        className="btn-ochre self-start px-6 py-3.5 text-[14px] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Envoi…' : 'Envoyer pour vérification'}
      </button>
    </form>
  )
}
