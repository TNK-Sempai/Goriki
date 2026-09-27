'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatPrice } from '@/lib/utils'

/**
 * Want list — case 8 de la planche de référence.
 *
 * Composition de la planche : titre « MA WANT LIST », accroche, rangée
 * d'ONGLETS COMPTÉS (Toutes · Trouvées · En attente), puis une liste de lignes
 * portant chacune une vignette de carte, le nom, la référence, une puce d'état
 * et un bouton « Voir ». L'écran précédent n'affichait que les demandes
 * `active`, sans vignette, sans état, sans onglet — les demandes satisfaites
 * étaient donc invisibles.
 *
 * ─── LA COLONNE DE DROITE NE PORTE JAMAIS DE TIRET ────────────────────────
 * Elle affichait « — » quand aucune pièce n'était en vente. Un tiret à
 * l'emplacement d'un prix se lit comme « prix inconnu », alors que l'absence de
 * plafond est une information nette : le client accepte n'importe quel prix.
 * La colonne dit donc « Max 120,00 € » ou « Sans limite de prix », jamais un
 * signe qu'il faut interpréter.
 */

export interface WantRow {
  id: string
  label: string
  ref: string | null
  imageUrl: string | null
  maxPrice: number | null
  /** statut réel de `want_to_buy_requests` */
  status: string
  /** identifiant du listing en vente, si la pièce est disponible */
  listingId: string | null
  createdAt: string
}

const ONGLETS = [
  { key: 'all', label: 'Toutes' },
  { key: 'fulfilled', label: 'Trouvées' },
  { key: 'active', label: 'En attente' },
] as const

const BTN =
  'shrink-0 rounded-control border border-[rgba(26,22,17,0.16)] bg-[rgba(255,255,255,0.6)] px-3 py-1.5' +
  ' font-mono text-[9px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-white' +
  ' disabled:cursor-not-allowed disabled:opacity-45'

const BTN_VOIR =
  'shrink-0 rounded-control border border-[rgba(26,22,17,0.16)] bg-[rgba(255,255,255,0.6)] px-4 py-2' +
  ' font-mono text-[10px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-white'

/** « Max 120,00 € » si un plafond est posé, sinon la phrase qui dit qu'il n'y en a pas. */
const ligneDePrix = (maxPrice: number | null) =>
  maxPrice !== null ? `Max ${formatPrice(maxPrice)}` : 'Sans limite de prix'

export default function WantList({ rows }: { rows: WantRow[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<string>('all')
  /** Ligne dont une écriture est en vol — désarme ses boutons, pas ceux des autres. */
  const [enVol, setEnVol] = useState<string | null>(null)
  /** Ligne dont le prix est en cours d'édition, et la valeur saisie. */
  const [edition, setEdition] = useState<string | null>(null)
  const [saisie, setSaisie] = useState('')
  /** Ligne dont la suppression attend confirmation. */
  const [aConfirmer, setAConfirmer] = useState<string | null>(null)
  /** Erreur rattachée à SA ligne : un bandeau global ne dirait pas laquelle. */
  const [erreur, setErreur] = useState<{ id: string; texte: string } | null>(null)

  const compte = (key: string) => (key === 'all' ? rows.length : rows.filter(r => r.status === key).length)
  const visibles = tab === 'all' ? rows : rows.filter(r => r.status === tab)

  async function appeler(id: string, envoi: () => Promise<Response>) {
    setEnVol(id)
    setErreur(null)
    try {
      const res = await envoi()
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErreur({ id, texte: data.error ?? 'Opération impossible.' })
        return false
      }
      // La page est rendue côté serveur : c'est le rafraîchissement qui fait
      // foi, pas un état local qu'on aurait recopié à la main.
      router.refresh()
      return true
    } catch {
      setErreur({ id, texte: 'Connexion interrompue.' })
      return false
    } finally {
      setEnVol(null)
    }
  }

  const marquerTrouvee = (id: string) =>
    appeler(id, () => fetch('/api/compte/want-to-buy', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'fulfilled' }),
    }))

  async function enregistrerPrix(id: string) {
    const ok = await appeler(id, () => fetch('/api/compte/want-to-buy', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      // Chaîne vide = plus de plafond. La route la traduit en NULL, qui est
      // une valeur voulue et non un champ non rempli.
      body: JSON.stringify({ id, max_price: saisie.trim() }),
    }))
    if (ok) { setEdition(null); setSaisie('') }
  }

  async function supprimer(id: string) {
    const ok = await appeler(id, () =>
      fetch(`/api/compte/want-to-buy?id=${encodeURIComponent(id)}`, { method: 'DELETE' }))
    if (ok) setAConfirmer(null)
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2">
        {ONGLETS.map(o => (
          <button
            key={o.key}
            type="button"
            className="pill"
            data-active={tab === o.key}
            onClick={() => setTab(o.key)}
          >
            {o.label} ({compte(o.key)})
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <div className="glass rounded-block px-8 py-14 text-center">
          <p className="m-0 text-[14px] text-ink-70">
            {rows.length === 0
              ? "Votre want list est vide. Ajoutez une recherche ci-dessous et nous vous prévenons dès qu'une pièce entre en stock."
              : 'Aucune demande dans cet onglet.'}
          </p>
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-panel-lg">
          {visibles.map(r => {
            const trouvee = r.status === 'fulfilled'
            const occupee = enVol === r.id
            const msg = erreur?.id === r.id ? erreur.texte : null

            return (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[rgba(26,22,17,0.09)] px-4 py-3 last:border-0"
              >
                {r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- vignette de ligne de liste
                  <img
                    src={r.imageUrl}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    className="h-16 w-[46px] shrink-0 rounded-[4px] object-cover shadow-[0_8px_16px_-8px_rgba(26,22,17,0.5)]"
                  />
                ) : (
                  <span className="scan-pending h-16 w-[46px] shrink-0 rounded-[4px]" />
                )}

                <span className="flex min-w-[140px] flex-1 flex-col">
                  <span className="line-clamp-1 text-[13px] font-medium leading-tight text-ink">{r.label}</span>
                  <span className="data mt-1 text-[8px]">{r.ref ?? 'Recherche libre'}</span>
                </span>

                <span className="status shrink-0" data-tone={trouvee ? 'done' : 'wait'}>
                  {trouvee ? 'Trouvée' : r.status === 'cancelled' ? 'Annulée' : 'En attente'}
                </span>

                {/* ── Colonne de droite : le prix, puis les actions ─────────── */}
                <span className="flex shrink-0 flex-col items-end gap-2">
                  {edition === r.id ? (
                    <span className="flex items-center gap-1.5">
                      <input
                        value={saisie}
                        onChange={e => setSaisie(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') enregistrerPrix(r.id)
                          if (e.key === 'Escape') { setEdition(null); setErreur(null) }
                        }}
                        inputMode="decimal"
                        autoFocus
                        aria-label={`Prix maximum pour ${r.label}`}
                        placeholder="Sans limite"
                        className="w-[104px] rounded-control border border-[rgba(26,22,17,0.15)] bg-[rgba(255,255,255,0.55)] px-2.5 py-1.5 text-right text-[12px] text-ink placeholder:text-ink-55"
                      />
                      <button type="button" className={BTN} disabled={occupee} onClick={() => enregistrerPrix(r.id)}>
                        {occupee ? '…' : 'OK'}
                      </button>
                      <button
                        type="button"
                        className={BTN}
                        onClick={() => { setEdition(null); setErreur(null) }}
                      >
                        Annuler
                      </button>
                    </span>
                  ) : (
                    <span className="data text-[9px] text-ink-70">{ligneDePrix(r.maxPrice)}</span>
                  )}

                  {aConfirmer === r.id ? (
                    <span className="flex items-center gap-1.5">
                      <span className="text-[11px] text-ink-70">Supprimer définitivement ?</span>
                      <button
                        type="button"
                        className={`${BTN} !border-[rgba(138,47,29,0.4)] !text-[#8A2F1D]`}
                        disabled={occupee}
                        onClick={() => supprimer(r.id)}
                      >
                        {occupee ? '…' : 'Oui'}
                      </button>
                      <button type="button" className={BTN} onClick={() => setAConfirmer(null)}>
                        Non
                      </button>
                    </span>
                  ) : (
                    <span className="flex flex-wrap items-center justify-end gap-1.5">
                      {r.status === 'active' && (
                        <button type="button" className={BTN} disabled={occupee} onClick={() => marquerTrouvee(r.id)}>
                          Je l&apos;ai trouvée
                        </button>
                      )}
                      {edition !== r.id && (
                        <button
                          type="button"
                          className={BTN}
                          disabled={occupee}
                          onClick={() => {
                            setErreur(null)
                            setSaisie(r.maxPrice !== null ? String(r.maxPrice) : '')
                            setEdition(r.id)
                          }}
                        >
                          Prix max
                        </button>
                      )}
                      <button
                        type="button"
                        className={`${BTN} hover:!border-[rgba(138,47,29,0.4)] hover:!text-[#8A2F1D]`}
                        disabled={occupee}
                        onClick={() => { setErreur(null); setAConfirmer(r.id) }}
                      >
                        Supprimer
                      </button>
                      {r.listingId && (
                        <Link href={`/${r.listingId}`} className={BTN_VOIR}>
                          Voir
                        </Link>
                      )}
                    </span>
                  )}
                </span>

                {msg && (
                  <p
                    role="status"
                    className="m-0 w-full rounded-control border border-[rgba(138,47,29,0.35)] bg-[rgba(138,47,29,0.08)] px-3 py-2 text-[12px] text-[#8A2F1D]"
                  >
                    {msg}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
