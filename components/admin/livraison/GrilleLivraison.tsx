'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { enregistrerReglages, modifierTarif } from '@/app/admin/livraison/actions'

/**
 * Réglages de livraison — écran admin.
 *
 * Deux blocs, et la frontière entre eux n'est pas cosmétique :
 *
 *   · les RÉGLAGES sont les cinq nombres dont dépend tout le calcul. Deux
 *     d'entre eux — poids d'une carte, poids de l'enveloppe — sont PROVISOIRES
 *     tant que la pesée n'est pas faite, et l'écran le dit, sinon personne ne
 *     se souviendra qu'ils sont à corriger ;
 *   · la GRILLE n'expose que prix, poids maximum et activité. Le code Sendcloud,
 *     le pays et la nature définissent l'offre : les rendre modifiables ici
 *     reviendrait à changer ce que signifie un code déjà facturé sur des
 *     commandes passées.
 */

export interface Reglages {
  min_order_value: number
  handling_fee: number
  letter_max_value: number
  letter_max_weight_g: number
  card_weight_g: number
  envelope_weight_g: number
}

export interface Tarif {
  id: string
  code: string
  label: string
  carrier: string
  kind: string
  country: string
  max_weight_g: number
  price: number
  sendcloud_method_code: string | null
  needs_service_point: boolean
  tracked: boolean
  is_active: boolean
  sort_order: number
}

const NATURE: Record<string, string> = {
  letter: 'lettre simple',
  service_point: 'point relais',
  home: 'à domicile',
}
const TRANSPORTEUR: Record<string, string> = {
  bpost: 'bpost',
  mondial_relay: 'Mondial Relay',
}

const eur = (n: number) => n.toFixed(2).replace('.', ',') + ' €'

export default function GrilleLivraison({
  reglages, tarifs,
}: {
  reglages: Reglages
  tarifs: Tarif[]
}) {
  const [enCours, demarrer] = useTransition()
  const [msg, setMsg] = useState<{ ton: 'ok' | 'ko'; texte: string } | null>(null)
  /**
   * Le rafraîchissement est déclenché ICI, pas par un `revalidatePath` dans
   * l'action serveur. MESURÉ : avec `revalidatePath`, l'écriture partait bien
   * et la base était à jour, mais la transition ne se terminait JAMAIS — le
   * bouton restait sur « … », désactivé, indéfiniment. Même motif que
   * l'éditeur de variantes et la want list, qui rafraîchissent côté client.
   */
  const router = useRouter()

  const [forme, setForme] = useState({
    min_order_value: String(reglages.min_order_value),
    handling_fee: String(reglages.handling_fee),
    letter_max_value: String(reglages.letter_max_value),
    letter_max_weight_g: String(reglages.letter_max_weight_g),
    card_weight_g: String(reglages.card_weight_g),
    envelope_weight_g: String(reglages.envelope_weight_g),
  })

  /** Ligne en cours d'édition, et sa saisie. */
  const [edite, setEdite] = useState<string | null>(null)
  const [saisie, setSaisie] = useState({ price: '', max_weight_g: '' })

  const champ = (
    cle: keyof typeof forme,
    label: string,
    aide: string,
    provisoire = false,
  ) => (
    <label className="gk-field" key={cle}>
      <span className="gk-label">
        {label}
        {provisoire && <span className="gk-tag" style={{ marginLeft: 6 }}>provisoire</span>}
      </span>
      <input
        className="gk-input"
        value={forme[cle]}
        inputMode="decimal"
        disabled={enCours}
        onChange={e => { setForme({ ...forme, [cle]: e.target.value }); setMsg(null) }}
      />
      <span className="gk-aide">{aide}</span>
    </label>
  )

  function sauverReglages() {
    demarrer(async () => {
      const r = await enregistrerReglages(forme)
      setMsg(r.ok
        ? { ton: 'ok', texte: 'Réglages enregistrés. Le calcul des frais de port les applique immédiatement.' }
        : { ton: 'ko', texte: r.erreur ?? 'Échec' })
      if (r.ok) router.refresh()
    })
  }

  function sauverTarif(t: Tarif) {
    demarrer(async () => {
      const r = await modifierTarif(t.id, { price: saisie.price, max_weight_g: saisie.max_weight_g })
      if (r.ok) {
        setEdite(null)
        setMsg({ ton: 'ok', texte: `${t.code} mis à jour.` })
        router.refresh()
      } else {
        setMsg({ ton: 'ko', texte: r.erreur ?? 'Échec' })
      }
    })
  }

  function basculer(t: Tarif) {
    demarrer(async () => {
      const r = await modifierTarif(t.id, { is_active: !t.is_active })
      setMsg(r.ok
        ? { ton: 'ok', texte: `${t.code} ${t.is_active ? 'désactivé' : 'réactivé'}.` }
        : { ton: 'ko', texte: r.erreur ?? 'Échec' })
      if (r.ok) router.refresh()
    })
  }

  // Groupé par pays : c'est la seule lecture utile — on vérifie la couverture
  // d'un pays d'un coup d'œil, pas la liste alphabétique des codes.
  const pays = [...new Set(tarifs.map(t => t.country))].sort()

  return (
    <div className="gk-corps">
      {msg && (
        <div
          className="gk-panneau"
          role="status"
          style={{
            padding: 12, marginBottom: 16,
            borderColor: msg.ton === 'ok' ? 'rgba(126,200,124,0.35)' : 'rgba(255,122,104,0.35)',
          }}
        >
          <span className="gk-aide">{msg.texte}</span>
        </div>
      )}

      {/* ── Réglages généraux ──────────────────────────────────────────── */}
      <div className="gk-panneau" style={{ padding: 16 }}>
        <div className="gk-panneau-tete">
          <span className="gk-label">Réglages généraux</span>
        </div>

        <div
          style={{
            display: 'grid', gap: 12, marginTop: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          }}
        >
          {champ('min_order_value', 'Minimum de commande (€)',
            'Sur la VALEUR DES ARTICLES, hors port et hors forfait. 0 désactive le minimum.')}
          {champ('handling_fee', 'Forfait de préparation (€)',
            'Frais de préparation et d’emballage, par commande. À 0, il disparaît partout : options, récapitulatif, email, facture.')}
          {champ('letter_max_value', 'Plafond de valeur, lettre (€)',
            'La lettre simple n’est proposée qu’EN DESSOUS de ce montant d’articles. Elle n’est ni suivie ni assurée.')}
          {champ('letter_max_weight_g', 'Plafond de poids, lettre (g)',
            'Poids total de l’envoi, enveloppe comprise. Ce poids-là passe encore.')}
          {champ('card_weight_g', 'Poids d’une carte (g)',
            'Aucune carte ne porte de poids propre en base : cette valeur les pèse toutes.', true)}
          {champ('envelope_weight_g', 'Emballage (enveloppe + carton)',
            'Tare en grammes, ajoutée une fois par commande : enveloppe ou carton, protection, calage.', true)}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <button type="button" className="gk-btn" data-primaire disabled={enCours} onClick={sauverReglages}>
            {enCours ? 'Enregistrement…' : 'Enregistrer les réglages'}
          </button>
          <span className="gk-aide">
            Les deux poids marqués « provisoire » viennent du brief, pas d’une pesée.
            Les corriger change le mode de livraison proposé sur toutes les commandes.
          </span>
        </div>
      </div>

      {/* ── Grille tarifaire ───────────────────────────────────────────── */}
      {pays.map(p => {
        const lignes = tarifs
          .filter(t => t.country === p)
          .sort((a, b) => a.sort_order - b.sort_order || a.price - b.price)

        return (
          <div className="gk-panneau" style={{ marginTop: 16 }} key={p}>
            <div className="gk-panneau-tete">
              <span className="gk-label">{p}</span>
              <span className="gk-aide">
                {lignes.filter(l => l.is_active).length} actif(s) sur {lignes.length}
              </span>
            </div>

            <div
              className="gk-heads"
              style={{ display: 'grid', gridTemplateColumns: '150px 1fr 110px 100px 92px max-content' }}
            >
              <span className="gk-label">Code</span>
              <span className="gk-label">Mode</span>
              <span className="gk-label">Poids max</span>
              <span className="gk-label">Port</span>
              <span className="gk-label">Suivi</span>
              <span className="gk-label" />
            </div>

            {lignes.map(t => {
              const enEdition = edite === t.id
              return (
                <div
                  key={t.id}
                  className="gk-row"
                  style={{
                    gridTemplateColumns: '150px 1fr 110px 100px 92px max-content',
                    opacity: t.is_active ? 1 : 0.45,
                  }}
                >
                  <span className="gk-mono gk-sm">{t.code}</span>

                  <span className="gk-cell">
                    {t.label}
                    <span className="gk-dim gk-sm">
                      {' · '}{TRANSPORTEUR[t.carrier] ?? t.carrier}{' · '}{NATURE[t.kind] ?? t.kind}
                    </span>
                  </span>

                  {enEdition ? (
                    <input
                      className="gk-input"
                      value={saisie.max_weight_g}
                      inputMode="numeric"
                      aria-label={`Poids maximum de ${t.code}`}
                      onChange={e => setSaisie({ ...saisie, max_weight_g: e.target.value })}
                    />
                  ) : (
                    <span className="gk-mono gk-sm">{t.max_weight_g} g</span>
                  )}

                  {enEdition ? (
                    <input
                      className="gk-input"
                      value={saisie.price}
                      inputMode="decimal"
                      aria-label={`Prix de ${t.code}`}
                      onChange={e => setSaisie({ ...saisie, price: e.target.value })}
                    />
                  ) : (
                    <span className="gk-mono gk-sm">{eur(t.price)}</span>
                  )}

                  <span className="gk-tag" data-etat={t.tracked ? 'logo' : 'aucun'}>
                    {t.tracked ? 'suivi' : 'non suivi'}
                  </span>

                  <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                    {enEdition ? (
                      <>
                        <button type="button" className="gk-btn" data-primaire disabled={enCours}
                          onClick={() => sauverTarif(t)}>
                          {enCours ? '…' : 'OK'}
                        </button>
                        <button type="button" className="gk-btn" onClick={() => setEdite(null)}>Annuler</button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="gk-btn"
                          disabled={enCours}
                          onClick={() => {
                            setMsg(null)
                            setSaisie({ price: String(t.price), max_weight_g: String(t.max_weight_g) })
                            setEdite(t.id)
                          }}
                        >
                          Modifier
                        </button>
                        <button type="button" className="gk-btn" disabled={enCours} onClick={() => basculer(t)}>
                          {t.is_active ? 'Désactiver' : 'Réactiver'}
                        </button>
                      </>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
