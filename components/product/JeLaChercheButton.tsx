'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'

/**
 * « ♡ Je la cherche » — point d'ajout naturel à la want list.
 *
 * Décision d'architecture 59 : on n'ajoute une recherche que depuis deux
 * endroits — ici, sur la fiche d'une pièce INDISPONIBLE, et le formulaire de
 * l'espace compte. Le radar public (`/want-to-buy`) n'a volontairement aucun
 * formulaire : c'est une lecture collective, pas un outil de saisie.
 *
 * Non connecté : on redirige vers `/login` en gardant la route de retour —
 * l'API refuse de toute façon (401), la garde est côté serveur.
 */
export default function JeLaChercheButton({
  cardType,
  cardId,
}: {
  cardType: 'pokemon' | 'onepiece'
  cardId: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function ajouter() {
    setState('sending')
    setError(null)

    const res = await fetch('/api/compte/want-to-buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: cardId, card_type: cardType }),
    })

    if (res.status === 401) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`)
      return
    }

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setState('idle')
      setError(data.error ?? 'Enregistrement impossible.')
      return
    }

    setState('done')
    router.refresh()
  }

  if (state === 'done') {
    return (
      <div className="rounded-control border border-[rgba(46,105,58,0.28)] bg-[rgba(46,105,58,0.1)] px-4 py-3.5 text-center">
        <span className="text-[13px] text-[#2E693A]">Ajoutée à votre want list.</span>
        <Link href="/compte/want-to-buy" className="data mt-1.5 block text-[9px] hover:text-ochre">
          Voir mes recherches →
        </Link>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={ajouter}
        disabled={state === 'sending'}
        className="btn-ghost flex w-full items-center justify-center gap-2 px-5 py-3.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink transition-colors hover:!bg-ink hover:!text-parchment disabled:opacity-50"
      >
        <span aria-hidden>♡</span>
        {state === 'sending' ? 'Enregistrement…' : 'Je la cherche'}
      </button>
      {error && <span className="mt-2 block text-[12px] text-[#A33B2A]">{error}</span>}
      <p className="m-0 mt-2 text-[11px] leading-[1.5] text-ink-55">
        Nous vous prévenons dès qu&apos;un exemplaire entre en stock.
      </p>
    </div>
  )
}
