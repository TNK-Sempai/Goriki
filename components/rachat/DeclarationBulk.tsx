'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BULK_CATEGORIES, BULK_CONTACT_THRESHOLD, BULK_CONTACT_EMAIL } from '@/lib/constants'

/**
 * Rachat bulk — logique SÉPARÉE du carte par carte.
 *
 * Un lot en vrac ne s'inventorie pas ligne à ligne : il se déclare par
 * catégories grossières. Au-delà de `BULK_CONTACT_THRESHOLD`, il n'y a plus de
 * formulaire du tout — un stock de cette taille se négocie de vive voix.
 *
 * Ici non plus AUCUN prix n'est affiché : le total est un nombre de CARTES,
 * jamais un montant.
 */
export default function DeclarationBulk({
  connected,
  verified,
}: {
  connected: boolean
  verified: boolean
}) {
  const router = useRouter()
  const [univers, setUnivers] = useState<string>('')
  const [quantites, setQuantites] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [envoye, setEnvoye] = useState(false)

  const nombre = (v: string | undefined) => {
    const n = parseInt((v ?? '').replace(/\D/g, ''), 10)
    return Number.isFinite(n) ? n : 0
  }
  const total = BULK_CATEGORIES.reduce((n, c) => n + nombre(quantites[c.code]), 0)
  const trop = total > BULK_CONTACT_THRESHOLD

  async function soumettre() {
    if (!connected) {
      router.push('/login?redirect=/rachat')
      return
    }
    setEnvoi(true)
    setMessage(null)

    const res = await fetch('/api/rachat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'bulk',
        universe: univers || null,
        note,
        buckets: BULK_CATEGORIES.map(c => ({ code: c.code, quantity: nombre(quantites[c.code]) })).filter(
          b => b.quantity > 0
        ),
      }),
    })
    const data = await res.json().catch(() => ({}))
    setEnvoi(false)

    if (!res.ok) {
      setMessage(data.error ?? 'Envoi impossible.')
      return
    }
    setQuantites({})
    setNote('')
    setEnvoye(true)
    router.refresh()
  }

  if (envoye) {
    return (
      <div className="glass rounded-panel-lg p-8 text-center lg:p-10">
        <h2 className="display-sub m-0">Lot bulk transmis</h2>
        <p className="m-0 mx-auto mt-4 max-w-[54ch] text-[14px] leading-[1.65] text-ink-70">
          Votre déclaration est enregistrée. Nous revenons vers vous avec une offre au lot
          après réception et tri du contenu.
        </p>
        <Link
          href="/compte/rachat"
          className="btn-ochre mt-6 inline-flex px-6 py-3.5 font-mono text-[11px] uppercase tracking-[0.14em]"
        >
          Suivre ma demande
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,62fr)_minmax(0,38fr)] lg:items-start">
      <div className="glass flex flex-col gap-6 rounded-panel-lg p-5 lg:p-6">
        <div>
          <span className="data text-[9px]">Univers du lot</span>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {[
              { v: '', label: 'Mélangé' },
              { v: 'onepiece', label: 'One Piece' },
              { v: 'pokemon', label: 'Pokémon' },
            ].map(u => (
              <button key={u.v || 'mix'} type="button" className="pill" data-active={univers === u.v} onClick={() => setUnivers(u.v)}>
                {u.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="data text-[9px]">Contenu déclaré</span>
          <div className="mt-3 flex flex-col">
            {BULK_CATEGORIES.map(c => (
              <label
                key={c.code}
                className="flex items-center gap-4 border-b border-[rgba(26,22,17,0.09)] py-3 last:border-0"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[13px] font-medium text-ink">{c.label}</span>
                  <span className="mt-0.5 text-[11px] text-ink-55">{c.hint}</span>
                </span>
                <input
                  inputMode="numeric"
                  value={quantites[c.code] ?? ''}
                  onChange={e => setQuantites(q => ({ ...q, [c.code]: e.target.value }))}
                  placeholder="0"
                  aria-label={`Nombre de cartes — ${c.label}`}
                  className="w-[92px] shrink-0 rounded-control border border-[rgba(26,22,17,0.14)] bg-[rgba(255,255,255,0.7)] px-3 py-2 text-right text-[14px] text-ink"
                />
              </label>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-2">
          <span className="data text-[9px]">Précisions (facultatif)</span>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="Extensions dominantes, langue, état général, pièces notables du lot…"
            className="w-full rounded-control border border-[rgba(26,22,17,0.14)] bg-[rgba(255,255,255,0.7)] px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-55"
          />
        </label>
      </div>

      <div className="glass rounded-panel-lg p-5 lg:sticky lg:top-24 lg:p-6">
        <span className="data text-[9px]">Volume déclaré</span>
        <p className="m-0 mt-3 text-[38px] font-semibold leading-none tracking-[-0.03em] text-ink">
          {total.toLocaleString('fr-FR')}
        </p>
        <p className="data m-0 mt-2 text-[9px]">carte{total > 1 ? 's' : ''}</p>

        {trop ? (
          /* Au-delà du seuil : plus de formulaire du tout. */
          <div className="mt-5 rounded-control border border-[rgba(200,134,10,0.4)] bg-[rgba(200,134,10,0.1)] px-4 py-4">
            <p className="m-0 text-[13px] font-semibold text-ink">Ce lot dépasse le formulaire.</p>
            <p className="m-0 mt-2 text-[12px] leading-[1.6] text-ink-70">
              Au-delà de {BULK_CONTACT_THRESHOLD.toLocaleString('fr-FR')} cartes, un stock se
              négocie directement. Écrivez-nous en indiquant le nombre de cartes et les
              extensions concernées — nous organisons la reprise avec vous.
            </p>
            <a
              href={`mailto:${BULK_CONTACT_EMAIL}?subject=${encodeURIComponent('Rachat gros stock bulk')}`}
              className="btn-ochre mt-4 flex w-full items-center justify-center px-5 py-3.5 font-mono text-[11px] uppercase tracking-[0.14em]"
            >
              Nous contacter
            </a>
          </div>
        ) : (
          <>
            {message && <p className="m-0 mt-4 text-[12px] text-[#A33B2A]">{message}</p>}

            {connected && !verified && total > 0 && (
              <p className="m-0 mt-4 rounded-control border border-[rgba(200,134,10,0.35)] bg-[rgba(200,134,10,0.1)] px-3.5 py-3 text-[12px] leading-[1.5] text-ink">
                Votre identité doit être vérifiée avant toute soumission.{' '}
                <Link href="/compte/verification" className="underline hover:text-ochre">
                  Vérifier mon identité
                </Link>
              </p>
            )}

            <button
              type="button"
              onClick={soumettre}
              disabled={total === 0 || envoi}
              className="btn-ochre mt-5 w-full px-5 py-3.5 font-mono text-[11px] uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {envoi ? 'Envoi…' : !connected ? 'Se connecter pour soumettre' : 'Soumettre pour inspection'}
            </button>
          </>
        )}

        <p className="m-0 mt-4 text-[11px] leading-[1.55] text-ink-55">
          Aucun montant n&apos;est annoncé à ce stade. L&apos;offre au lot est chiffrée après
          réception et tri du contenu.
        </p>
      </div>
    </div>
  )
}
