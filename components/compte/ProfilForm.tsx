'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Informations personnelles — panneau central de la case 10 de la planche.
 *
 * La planche montre un FORMULAIRE éditable (champs + bouton « Enregistrer »),
 * là où l'écran précédent n'affichait que du texte en lecture seule.
 *
 * DEUX NOMS, DEUX RÔLES (migration 0032). L'écran ne portait qu'un champ « Nom »
 * ambigu, branché sur `full_name` — c'est-à-dire sur le nom imprimé en haut des
 * FACTURES et employé dans les e-mails de commande. Un utilisateur y écrivait un
 * pseudo sans savoir qu'il renommait son identité de facturation.
 *
 *   « Pseudo affiché »  → `username`. Libre, mais UNIQUE (migration 0033 :
 *                         index sur `lower(btrim(username))`, donc « Tanuki » et
 *                         « tanuki » ne peuvent pas coexister). Seul champ
 *                         destiné à devenir public un jour.
 *   « Nom d'identité »  → `full_name`. Facture, e-mails, dossier de vérification.
 *                         Jamais public. VERROUILLÉ une fois l'identité vérifiée
 *                         — le verrou est en base (trigger), pas seulement ici :
 *                         désactiver un input ne protège rien, PostgREST est
 *                         joignable directement.
 *
 * Colonnes modifiables par le titulaire : `full_name`, `avatar_url`
 * (migration 0021) et `username` (0032, renommé en 0033). Rien d'autre.
 * L'e-mail est géré par l'authentification, pas par cette table — il est donc
 * présenté en lecture seule, et non désactivé « pour faire joli ».
 *
 * ⚠️ La planche dessine un champ « Téléphone ». Aucune colonne de téléphone
 * n'existe dans `profiles` : le champ n'est pas inventé, il est remplacé par
 * l'état de vérification d'identité, qui est une donnée réelle du compte.
 */
export default function ProfilForm({
  initialName,
  initialUsername,
  email,
  identityLabel,
  identityVerified,
}: {
  initialName: string
  initialUsername: string
  email: string
  identityLabel: string
  /** `identity_status === 'verified'` : le nom d'identité n'est plus réinscriptible. */
  identityVerified: boolean
}) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [pseudo, setPseudo] = useState(initialUsername)
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const nameDirty = !identityVerified && name.trim() !== initialName.trim()
  const pseudoDirty = pseudo.trim() !== initialUsername.trim()
  const dirty = nameDirty || pseudoDirty

  // Même bornes que la contrainte `profiles_username_len` : on refuse ici ce
  // que la base refuserait de toute façon, pour donner un message lisible.
  const pseudoInvalide = pseudo.trim().length > 0 && (pseudo.trim().length < 2 || pseudo.trim().length > 32)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (pseudoInvalide) {
      setState('error')
      setMessage('Le pseudo doit faire entre 2 et 32 caractères.')
      return
    }
    setState('saving')
    setMessage(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setState('error')
      setMessage('Session expirée — reconnectez-vous.')
      return
    }

    // On n'envoie que ce qui a bougé : réécrire `full_name` à l'identique
    // suffirait à faire passer le trigger de verrou sur un compte vérifié.
    const patch: Record<string, string | null> = {}
    if (nameDirty) patch.full_name = name.trim()
    if (pseudoDirty) patch.username = pseudo.trim() === '' ? null : pseudo.trim()

    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)

    if (error) {
      setState('error')
      // 23505 = violation d'unicité : le seul index unique posé sur ce que ce
      // formulaire écrit est `profiles_username_unique`. Le message brut de
      // PostgREST nomme l'index, ce qui ne veut rien dire pour un client.
      setMessage(
        error.code === '23505'
          ? 'Ce pseudo est déjà pris. Choisissez-en un autre.'
          : error.message,
      )
      return
    }
    setState('done')
    router.refresh()
  }

  const field =
    'w-full rounded-control border border-[rgba(26,22,17,0.14)] bg-[rgba(255,255,255,0.7)] px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-55 focus:border-[rgba(200,134,10,0.55)] focus:bg-white focus:outline-none'
  const fieldLock = `${field} cursor-not-allowed text-ink-55`

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
          <span className="data text-[9px]">Pseudo affiché</span>
          <input
            value={pseudo}
            onChange={e => { setPseudo(e.target.value); setState('idle') }}
            placeholder="Comment vous appeler"
            maxLength={32}
            className={field}
          />
          <span className="text-[11px] text-ink-55">
            Le nom sous lequel vous apparaîtriez auprès des autres membres. Jamais votre identité.
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="data text-[9px]">E-mail</span>
          <input
            value={email}
            readOnly
            aria-readonly="true"
            className={fieldLock}
          />
          <span className="text-[11px] text-ink-55">Géré par votre authentification.</span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="data text-[9px]">Nom d&apos;identité</span>
          <input
            value={name}
            onChange={e => { setName(e.target.value); setState('idle') }}
            placeholder="Nom tel qu'il figure sur vos documents"
            readOnly={identityVerified}
            aria-readonly={identityVerified}
            className={identityVerified ? fieldLock : field}
          />
          <span className="text-[11px] text-ink-55">
            {identityVerified
              ? 'Verrouillé : votre identité est vérifiée. Contactez-nous pour une correction.'
              : 'Porté sur vos factures et rattaché à votre vérification d’identité. Jamais public.'}
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="data text-[9px]">Vérification d&apos;identité</span>
          <input value={identityLabel} readOnly aria-readonly="true" className={fieldLock} />
          <span className="text-[11px] text-ink-55">
            Requise pour le dépôt-vente et le rachat.{' '}
            <Link href="/compte/verification" className="underline underline-offset-2 hover:text-ink">
              Gérer
            </Link>
          </span>
        </label>
      </div>

      <div className="mt-6 flex items-center justify-end gap-4">
        {message && <span className="text-[12px] text-[#A33B2A]">{message}</span>}
        {state === 'done' && !dirty && (
          <span className="text-[12px] text-[#2E693A]">Modifications enregistrées.</span>
        )}
        <button
          type="submit"
          disabled={!dirty || pseudoInvalide || state === 'saving'}
          className="btn-ochre px-6 py-3 font-mono text-[11px] uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {state === 'saving' ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}
