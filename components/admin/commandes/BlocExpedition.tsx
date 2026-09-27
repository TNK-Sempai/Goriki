'use client'

import { useState } from 'react'

/**
 * Bloc « Expédition » de la fiche commande.
 *
 * ─── DEUX CHEMINS, JAMAIS MÉLANGÉS ────────────────────────────────────────
 * `kind = 'letter'` : le propriétaire timbre à la main. Aucun appel Sendcloud,
 * l'écran ne sert qu'à recopier l'adresse.
 * Tout le reste : étiquette Sendcloud, avec son annulation.
 *
 * ─── UNE ÉTIQUETTE CRÉÉE EST FACTURÉE ─────────────────────────────────────
 * En formule gratuite, Sendcloud facture toute étiquette non annulée. La
 * création demande donc une confirmation, et l'annulation reste offerte tant
 * que le transporteur n'a pas pris le colis. Les refus viennent du serveur :
 * cet écran ne fait que les afficher, sans les deviner.
 */

export interface TarifCommande {
  code: string
  label: string
  kind: 'letter' | 'service_point' | 'home'
  country: string
  price: number
  sendcloud_method_code: string | null
  needs_service_point: boolean
  tracked: boolean
}

/** Montant à la française, sans dépendre d'un formateur pour un seul usage. */
const euros = (n: number) => n.toFixed(2).replace('.', ',') + ' €'

/**
 * Ce qu'il faut coller sur l'enveloppe.
 *
 * Deux lettres belges coexistent et ne s'affranchissent PAS pareil : la
 * normalisée (50 g, 5 mm d'épaisseur) part avec un timbre Non Prior, la
 * non normalisée se paie au guichet. Sans cette indication, le propriétaire doit
 * rapprocher lui-même le tarif facturé du timbre à coller — et une erreur
 * d'affranchissement, c'est le colis qui revient.
 */
function affranchissement(tarif: TarifCommande): string {
  if (tarif.code === 'letter_be_norm') return '1 timbre Non Prior (lettre normalisée, 5 mm max)'
  if (tarif.code === 'letter_be') return `Affranchissement non normalisé (${euros(tarif.price)})`
  return `Affranchissement vers ${tarif.country} : ${euros(tarif.price)}`
}

export interface CommandeExpedition {
  id: string
  status: string
  shipping_label: string | null
  shipping_country: string | null
  shipping_weight_g: number | null
  shipping_address: Record<string, string> | null
  service_point: { id?: string; nom?: string; adresse?: string; transporteur?: string } | null
  sendcloud_parcel_id: string | null
  label_url: string | null
  tracking_number: string | null
  shipping_rates: TarifCommande | TarifCommande[] | null
}

const seul = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

const STATUTS_PAYES = ['paid', 'preparing', 'shipped', 'delivered']

export default function BlocExpedition({
  commande,
  onChange,
}: {
  commande: CommandeExpedition
  onChange: (maj: Partial<CommandeExpedition>) => void
}) {
  const [enCours, setEnCours] = useState<'creer' | 'annuler' | null>(null)
  const [message, setMessage] = useState<{ ton: 'ok' | 'ko'; texte: string } | null>(null)
  const [aConfirmer, setAConfirmer] = useState(false)

  const tarif = seul(commande.shipping_rates)
  const adr = commande.shipping_address
  const pr = commande.service_point
  const lettre = tarif?.kind === 'letter'
  const payee = STATUTS_PAYES.includes(commande.status)

  const carte: React.CSSProperties = {
    background: 'var(--surface-1)', border: '1px solid rgba(212,144,12,0.08)',
    borderRadius: '3px', padding: '16px', marginBottom: '16px',
  }
  const etiquette: React.CSSProperties = {
    display: 'block', fontSize: '8px', letterSpacing: '1.5px', textTransform: 'uppercase',
    color: 'rgba(238,228,204,0.25)', marginBottom: '5px',
  }
  const valeur: React.CSSProperties = { fontSize: '11px', color: 'rgba(238,228,204,0.7)' }

  /** Une valeur absente se dit, elle ne se remplace pas par un signe. */
  const ligne = (label: string, v: string | number | null | undefined, absent = 'non renseigné') => (
    <div style={{ marginBottom: 10 }}>
      <label style={etiquette}>{label}</label>
      <div style={valeur}>{v === null || v === undefined || v === '' ? absent : v}</div>
    </div>
  )

  const adresseFormatee = adr
    ? [adr.name, adr.line1, `${adr.postal_code ?? ''} ${adr.city ?? ''}`.trim(), adr.country, adr.phone]
        .filter(Boolean).join('\n')
    : null

  async function agir(action: 'creer' | 'annuler') {
    setEnCours(action)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/expedition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: commande.id, action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setMessage({ ton: 'ko', texte: data.error ?? 'Opération impossible.' }); return }

      if (action === 'creer') {
        onChange({
          sendcloud_parcel_id: data.parcel_id,
          tracking_number: data.tracking_number ?? null,
          label_url: data.a_etiquette ? 'presente' : null,
        })
        setMessage({
          ton: 'ok',
          texte: `Étiquette créée (colis ${data.parcel_id}, méthode ${data.methode}).`
               + (data.tracking_number ? ` Suivi ${data.tracking_number}.` : ' Aucun numéro de suivi rendu.'),
        })
      } else {
        onChange({ sendcloud_parcel_id: null, tracking_number: null, label_url: null })
        setMessage({ ton: 'ok', texte: data.message ?? 'Étiquette annulée.' })
      }
      setAConfirmer(false)
    } catch {
      setMessage({ ton: 'ko', texte: 'Connexion interrompue.' })
    } finally {
      setEnCours(null)
    }
  }

  return (
    <div style={carte}>
      <div className="gk-sep" style={{ marginTop: 0 }}>Expédition <div className="gk-sep-line" /></div>

      {ligne('Mode de livraison', commande.shipping_label, 'aucun mode enregistré')}
      {ligne('Poids calculé', commande.shipping_weight_g ? `${commande.shipping_weight_g} g` : null, 'non calculé')}
      {ligne('Pays', commande.shipping_country)}

      <div style={{ marginBottom: 10 }}>
        <label style={etiquette}>Adresse de livraison</label>
        {adresseFormatee ? (
          <pre style={{ ...valeur, margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
            {adresseFormatee}
          </pre>
        ) : (
          <div style={valeur}>aucune adresse enregistrée</div>
        )}
      </div>

      {pr?.id && (
        <div style={{ marginBottom: 10 }}>
          <label style={etiquette}>Point relais</label>
          <div style={valeur}>{pr.nom}</div>
          <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{pr.adresse}</div>
          <div style={{ fontSize: '10px', color: 'var(--muted)' }}>
            {pr.transporteur} · réf. {pr.id}
          </div>
        </div>
      )}

      {ligne('Numéro de suivi', commande.tracking_number, 'aucun pour le moment')}

      {/* ── Lettre simple : rien à automatiser ─────────────────────────────── */}
      {lettre ? (
        <div style={{ marginTop: 12, padding: '10px', background: 'var(--bg)', borderRadius: '3px' }}>
          <div style={{ fontSize: '11px', color: 'var(--amber)', marginBottom: 6 }}>
            Lettre à timbrer, non suivie
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(238,228,204,0.7)', marginBottom: 6 }}>
            {tarif ? affranchissement(tarif) : 'Tarif introuvable : affranchissement à déterminer au guichet.'}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--muted)' }}>
            Aucune étiquette n&apos;est générée pour ce mode. Recopiez l&apos;adresse ci-dessus
            sur l&apos;enveloppe.
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {commande.sendcloud_parcel_id ? (
            <>
              {ligne('Colis Sendcloud', commande.sendcloud_parcel_id)}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {commande.label_url && (
                  <a
                    href={`/api/admin/expedition?id=${commande.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gk-btn"
                    data-primaire="true"
                  >
                    Ouvrir l&apos;étiquette (PDF)
                  </a>
                )}
                <button
                  type="button"
                  className="gk-btn"
                  data-danger="true"
                  disabled={enCours !== null}
                  onClick={() => agir('annuler')}
                >
                  {enCours === 'annuler' ? 'Annulation...' : 'Annuler l’étiquette'}
                </button>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--muted)' }}>
                Annulable tant que le transporteur n&apos;a pas pris le colis en charge.
                Une étiquette non annulée est facturée.
              </div>
            </>
          ) : aConfirmer ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: '11px', color: 'var(--amber)' }}>
                Créer l&apos;étiquette ? Sendcloud la facture si elle n&apos;est pas annulée.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="gk-btn" data-primaire="true"
                  disabled={enCours !== null} onClick={() => agir('creer')}>
                  {enCours === 'creer' ? 'Création...' : 'Oui, créer'}
                </button>
                <button type="button" className="gk-btn" onClick={() => setAConfirmer(false)}>
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="gk-btn"
                data-primaire="true"
                style={{ alignSelf: 'flex-start' }}
                disabled={!payee || !tarif?.sendcloud_method_code}
                onClick={() => { setMessage(null); setAConfirmer(true) }}
              >
                Générer l&apos;étiquette
              </button>
              {/* Dire pourquoi c'est fermé, plutôt qu'un bouton gris muet. */}
              {(!payee || !tarif?.sendcloud_method_code) && (
                <div style={{ fontSize: '10px', color: 'var(--muted)' }}>
                  {!payee
                    ? `Commande « ${commande.status} » : une étiquette ne se crée que sur une commande payée.`
                    : "Ce mode de livraison n'a pas de méthode Sendcloud."}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {message && (
        <div
          role="status"
          style={{
            marginTop: 12, fontSize: '11px', lineHeight: 1.5,
            color: message.ton === 'ok' ? 'rgba(126,200,124,0.95)' : '#ef4444',
          }}
        >
          {message.texte}
        </div>
      )}
    </div>
  )
}
