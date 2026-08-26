'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatPrice } from '@/lib/utils'

/**
 * Exemplaires physiques d'une même carte + variante.
 *
 * Au-dessus de 1 €, une carte est scannée individuellement : deux exemplaires
 * « Near Mint » peuvent différer par le centrage, le tirage, un défaut — chacun
 * mérite son propre scan et son propre prix. Ce panneau les liste et permet
 * d'en ajouter un.
 *
 * Sous 1 €, le stock est fongible : une seule ligne par (carte, variante, état),
 * garantie par l'index partiel `*_bulk_unique`. Le bouton d'ajout est donc masqué
 * et l'API refuserait de toute façon.
 */

type Univers = 'pokemon' | 'onepiece'

const CONDITIONS = ['Mint', 'Near Mint', 'Excellent', 'Light Played', 'Moderate Played']

export interface Exemplaire {
  id: string
  copy_index: number
  condition: string
  quantity: number
  price: number
  needs_photo: boolean
  front_photo_url: string | null
  // Pas d'`image_api` : depuis ARCHI-01 l'exemplaire Pokémon n'en porte plus, la
  // route ne l'envoie plus, et ce panneau n'affichait de toute façon aucune
  // vignette. Un champ mort qui décrit une colonne disparue finit par être
  // recopié dans le prochain écran — voir `lib/admin/listings` pour la vraie forme.
}

export default function ExemplairesPanel({
  universe,
  listingId,
  prixCourant,
  conditionCourante,
}: {
  universe: Univers
  listingId: string
  prixCourant: number
  conditionCourante: string
}) {
  const router = useRouter()
  const [exemplaires, setExemplaires] = useState<Exemplaire[]>([])
  const [ouvert, setOuvert] = useState(false)
  const [etat, setEtat] = useState(conditionCourante)
  const [prix, setPrix] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(async (vivant: () => boolean = () => true) => {
    const res = await fetch(`/api/listings?tcg=${universe}&copies_of=${listingId}`)
    const data = await res.json().catch(() => null)
    if (!vivant() || !res.ok || !Array.isArray(data)) return
    setExemplaires(
      (data as Exemplaire[]).sort(
        (a, b) => a.condition.localeCompare(b.condition) || a.copy_index - b.copy_index
      )
    )
  }, [universe, listingId])

  useEffect(() => {
    let actif = true
    // Chargement au montage : tous les `setState` sont posés après un `await`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger(() => actif)
    return () => { actif = false }
  }, [charger])

  async function ajouter() {
    setEnvoi(true)
    setErreur(null)

    const p = Number(prix.replace(',', '.'))
    if (!Number.isFinite(p) || p < 1) {
      setEnvoi(false)
      setErreur("Un exemplaire distinct suppose un prix d'au moins 1 €.")
      return
    }

    const res = await fetch('/api/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tcg: universe, source_id: listingId, condition: etat, price: p }),
    })
    const data = await res.json().catch(() => ({}))
    setEnvoi(false)

    if (!res.ok) {
      setErreur(data.error ?? 'Création impossible.')
      return
    }
    setOuvert(false)
    setPrix('')
    await charger()
    // On bascule directement sur le nouvel exemplaire : le geste suivant est
    // d'en téléverser le scan.
    router.push(`/admin/listings/${data.id}`)
  }

  // Le régime « exemplaires » ne s'ouvre qu'au-dessus du seuil de scan individuel.
  const multiplePossible = prixCourant >= 1

  return (
    <div
      style={{
        background: 'rgba(232,225,216,0.04)',
        border: '1px solid rgba(232,225,216,0.1)',
        borderRadius: 'var(--radius-gk-sm)',
        padding: '18px',
        marginTop: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <span className="gk-kpi-label" style={{ marginBottom: 0 }}>
          Exemplaires physiques ({exemplaires.length})
        </span>
        {multiplePossible ? (
          <button
            onClick={() => { setOuvert(o => !o); setErreur(null) }}
            className={`ab ${ouvert ? 'ab-muted' : 'ab-amber'}`}
            style={{ padding: '5px 10px', cursor: 'pointer', fontSize: '9px' }}
          >
            {ouvert ? 'Annuler' : '+ Ajouter un exemplaire'}
          </button>
        ) : (
          <span className="gk-cell mono">
            stock fongible sous 1 € — une seule ligne
          </span>
        )}
      </div>

      {ouvert && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            flexWrap: 'wrap',
            marginTop: '12px',
            padding: '10px',
            background: 'rgba(212,144,12,0.06)',
            border: '1px solid rgba(212,144,12,0.2)',
            borderRadius: 'var(--radius-gk-sm)',
          }}
        >
          <select value={etat} onChange={e => setEtat(e.target.value)} className="gk-input" style={{ width: '150px' }}>
            {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            value={prix}
            onChange={e => setPrix(e.target.value)}
            placeholder="Prix € (≥ 1)"
            className="gk-input"
            style={{ width: '120px' }}
          />
          <button onClick={ajouter} disabled={envoi} className="gk-btn" data-primaire="true">
            {envoi ? 'Création…' : 'Créer l’exemplaire'}
          </button>
          <span className="gk-cell mono" style={{ flexBasis: '100%' }}>
            Quantité 1, sans scan — il apparaîtra aussitôt dans la file « à photographier ».
          </span>
        </div>
      )}

      {erreur && (
        <div className="gk-vide" style={{ marginTop: '12px', marginBottom: 0 }}>
          <span className="gk-pastille" />
          {erreur}
        </div>
      )}

      <div style={{ marginTop: '12px' }}>
        {exemplaires.map(e => {
          const courant = e.id === listingId
          return (
            <Link
              key={e.id}
              href={`/admin/listings/${e.id}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '52px 1fr 96px 60px 76px 70px',
                gap: '8px',
                alignItems: 'center',
                padding: '7px 8px',
                borderBottom: '1px solid rgba(212,144,12,0.04)',
                textDecoration: 'none',
                background: courant ? 'rgba(212,144,12,0.08)' : undefined,
                borderRadius: 'var(--radius-gk-sm)',
              }}
            >
              <span className="gk-cell mono" style={{ color: courant ? 'var(--amber)' : undefined }}>
                {e.copy_index === 0 ? 'base' : `n° ${e.copy_index}`}
              </span>
              <span className="gk-cell">{e.condition}</span>
              <span className="gk-cell" style={{ textAlign: 'right' }}>
                {e.price > 0 ? formatPrice(e.price) : <span className="ab ab-amber">sans prix</span>}
              </span>
              <span className="gk-cell muted" style={{ textAlign: 'right' }}>×{e.quantity}</span>
              <span style={{ textAlign: 'right' }}>
                {e.front_photo_url
                  ? <span className="ab ab-green">scan</span>
                  : e.needs_photo
                    ? <span className="ab ab-red">à scanner</span>
                    : <span className="gk-cell muted">—</span>}
              </span>
              <span className="gk-cell muted" style={{ textAlign: 'right' }}>
                {courant ? 'affiché' : 'voir →'}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
