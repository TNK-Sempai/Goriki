'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Informations personnelles — panneau central de la case 10 de la planche.
 *
 * La planche montre un FORMULAIRE éditable (champs + bouton « Enregistrer »),
 * là où l'écran précédent n'affichait que du texte en lecture seule.
 *
 * Seul `full_name` est modifiable : la migration 0021 a réduit le GRANT UPDATE
 * de `authenticated` sur `profiles` aux colonnes `full_name` et `avatar_url`.
 * L'e-mail est géré par l'authentification, pas par cette table — il est donc
 * présenté en lecture seule, et non désactivé « pour faire joli ».
 *
 * ⚠️ La planche dessine un champ « Téléphone ». Aucune colonne de téléphone
 * n'existe dans `profiles` : le champ n'est pas inventé, il est remplacé par
 * l'état de vérification d'identité, qui est une donnée réelle du compte.
 */
export default function ProfilForm({
  initialName,
  email,
  identityLabel,
}: {
  initialName: string
  email: string
  identityLabel: string
}) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const dirty = name.trim() !== initialName.trim()

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setState('saving')
    setMessage(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setState('error')
      setMessage('Session expirée — reconnectez-vous.')
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: name.trim() })
      .eq('id', user.id)

    if (error) {
      setState('error')
      setMessage(error.message)
      return
    }
    setState('done')
    router.refresh()
  }

  const field =
    'w-full rounded-control border border-[rgba(26,22,17,0.14)] bg-[rgba(255,255,255,0.7)] px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-55 focus:border-[rgba(200,134,10,0.55)] focus:bg-white focus:outline-none'

  return (
    <form onSubmit={save} className="glass rounded-panel-lg p-5 lg:p-7">
      <div className="mb-6 flex items-start justify-between gap-4">
        <h2 className="display-sub m-0">Informations personnelles</h2>
        <span
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[rgba(26,22,17,0.08)] text-ink-55"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5">
            <circle cx="10" cy="6.6" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3.8 17c0-3.4 2.8-5.4 6.2-5.4s6.2 2 6.2 5.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="data text-[9px]">Nom</span>
          <input
            value={name}
            onChange={e => { setName(e.target.value); setState('idle') }}
            placeholder="Votre nom"
            className={field}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="data text-[9px]">E-mail</span>
          <input
            value={email}
            readOnly
            aria-readonly="true"
            className={`${field} cursor-not-allowed text-ink-55`}
          />
          <span className="text-[11px] text-ink-55">Géré par votre authentification.</span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="data text-[9px]">Identité</span>
          <input value={identityLabel} readOnly aria-readonly="true" className={`${field} cursor-not-allowed text-ink-55`} />
        </label>
      </div>

      <div className="mt-6 flex items-center justify-end gap-4">
        {message && <span className="text-[12px] text-[#A33B2A]">{message}</span>}
        {state === 'done' && !dirty && (
          <span className="text-[12px] text-[#2E693A]">Modifications enregistrées.</span>
        )}
        <button
          type="submit"
          disabled={!dirty || state === 'saving'}
          className="btn-ochre px-6 py-3 font-mono text-[11px] uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {state === 'saving' ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}
