'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  carteDuListing,
  varianteDuListing,
  visuelDuListing,
  comparerParCarte,
  type ListingAdmin,
} from '@/lib/admin/listings'

/**
 * Éditeur de listings d'un set — la vraie vue de gestion.
 *
 * Deux mécanismes dans UN seul écran, au lieu du mode « édition en masse »
 * séparé et déconnecté du contexte visuel :
 *   · édition en ligne (prix, stock, état, visibilité) directement dans la grille ;
 *   · sélection multiple + application d'une valeur à toute la sélection.
 *
 * Aucun prix n'est jamais calculé ici : c'est un outil de SAISIE. Le seul
 * automatisme est l'affichage — un listing avec du stock mais sans prix est
 * marqué, parce qu'il n'est pas vendable en l'état.
 */

type Univers = 'pokemon' | 'onepiece'

/**
 * La forme de l'exemplaire vient de `lib/admin/listings` — elle n'est plus
 * redécrite ici. C'est la copie locale, restée à l'ancienne chaîne plate, qui
 * vidait les colonnes Carte, Variante, Rareté et la vignette.
 */
type Listing = ListingAdmin

const CONDITIONS = ['Mint', 'Near Mint', 'Excellent', 'Light Played', 'Moderate Played']

type Statut = 'tous' | 'stock' | 'sans-prix' | 'sans-photo' | 'inactifs'

const STATUTS: { v: Statut; label: string }[] = [
  { v: 'tous', label: 'Tous' },
  { v: 'stock', label: 'Avec stock' },
  { v: 'sans-prix', label: 'Sans prix' },
  { v: 'sans-photo', label: 'Sans photo' },
  { v: 'inactifs', label: 'Inactifs' },
]

const carteDe = carteDuListing
const varianteDe = varianteDuListing

export default function SetListingsEditor({
  universe,
  setId,
}: {
  universe: Univers
  setId: string
}) {
  const [listings, setListings] = useState<Listing[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  const [edits, setEdits] = useState<Record<string, Partial<Listing>>>({})
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [enregistrement, setEnregistrement] = useState(false)
  const [rapport, setRapport] = useState<{ ok: number; ko: { id: string; error: string }[] } | null>(null)

  const [statut, setStatut] = useState<Statut>('tous')
  const [variante, setVariante] = useState('')
  const [rarete, setRarete] = useState('')
  const [q, setQ] = useState('')

  // Valeurs du bloc « appliquer à la sélection »
  const [lotPrix, setLotPrix] = useState('')
  const [lotStock, setLotStock] = useState('')
  const [lotCondition, setLotCondition] = useState('')

  /**
   * Rechargement. Aucun `setState` AVANT le premier `await` : l'indicateur de
   * chargement part de `true` à l'initialisation, et les rechargements après
   * enregistrement se font sans clignotement.
   *
   * `vivant` protège d'une vraie course : en enchaînant deux sets rapidement,
   * la réponse la plus lente écrasait sinon la plus récente.
   */
  const charger = useCallback(async (vivant: () => boolean = () => true) => {
    const res = await fetch(`/api/listings?tcg=${universe}&set_id=${setId}`)
    const data = await res.json().catch(() => null)
    if (!vivant()) return
    if (!res.ok) {
      setErreur(data?.error ?? 'Chargement impossible.')
      setListings([])
    } else {
      setErreur(null)
      // Trié ici : la route ne peut pas ordonner sur une colonne intégrée (voir
      // le commentaire de `comparerParCarte`). Sans ce tri, 245 cartes arrivent
      // dans l'ordre physique de la table.
      setListings(Array.isArray(data) ? [...(data as Listing[])].sort(comparerParCarte) : [])
    }
    setChargement(false)
  }, [universe, setId])

  useEffect(() => {
    let actif = true
    // Chargement de données au montage : tous les `setState` de `charger` sont
    // posés APRÈS un `await`, et la garde `actif` empêche une réponse périmée
    // d'écraser l'état courant. Rien n'est appelé dans le corps synchrone.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger(() => actif)
    return () => { actif = false }
  }, [charger])

  // ── Valeurs courantes (édition locale prioritaire) ────────────────────────
  function valeur<K extends keyof Listing>(l: Listing, champ: K): Listing[K] {
    return (edits[l.id]?.[champ] ?? l[champ]) as Listing[K]
  }

  function editer(id: string, champ: keyof Listing, v: unknown) {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [champ]: v } }))
    setRapport(null)
  }

  // ── Filtres ───────────────────────────────────────────────────────────────
  const variantes = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of listings) {
      const v = varianteDe(l)
      if (v) m.set(v.code, v.label)
    }
    return [...m].map(([code, label]) => ({ code, label }))
  }, [listings])

  const raretes = useMemo(
    () => [...new Set(listings.map(l => carteDe(l)?.rarity).filter(Boolean) as string[])].sort(),
    [listings]
  )

  const visibles = useMemo(() => {
    const query = q.trim().toLowerCase()
    // Lecture directe de `edits` plutôt que via `valeur()` : le filtre doit
    // refléter les saisies en cours (une ligne qu'on vient de chiffrer sort du
    // filtre « sans prix »), sans faire de `valeur` une dépendance du memo.
    return listings.filter(l => {
      const c = carteDe(l)
      const v = varianteDe(l)
      const e = edits[l.id]
      const qte = (e?.quantity ?? l.quantity) as number
      const prix = (e?.price ?? l.price) as number
      const actif = (e?.is_active ?? l.is_active) as boolean

      if (statut === 'stock' && qte <= 0) return false
      if (statut === 'sans-prix' && !(prix <= 0)) return false
      if (statut === 'sans-photo' && !l.needs_photo) return false
      if (statut === 'inactifs' && actif) return false
      if (variante && v?.code !== variante) return false
      if (rarete && c?.rarity !== rarete) return false
      if (query && !(c?.name_fr.toLowerCase().includes(query) || c?.number.toLowerCase().includes(query))) return false
      return true
    })
  }, [listings, statut, variante, rarete, q, edits])

  // ── Sélection ─────────────────────────────────────────────────────────────
  const idsVisibles = useMemo(() => visibles.map(l => l.id), [visibles])
  const toutSelectionne = idsVisibles.length > 0 && idsVisibles.every(id => selection.has(id))

  function basculerTout() {
    setSelection(prev => {
      const s = new Set(prev)
      if (toutSelectionne) idsVisibles.forEach(id => s.delete(id))
      else idsVisibles.forEach(id => s.add(id))
      return s
    })
  }

  function basculer(id: string) {
    setSelection(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  }

  function appliquerALaSelection() {
    if (selection.size === 0) return
    const prix = lotPrix.trim() === '' ? null : Number(lotPrix.replace(',', '.'))
    const stock = lotStock.trim() === '' ? null : parseInt(lotStock, 10)

    setEdits(prev => {
      const next = { ...prev }
      for (const id of selection) {
        const champs: Partial<Listing> = { ...next[id] }
        if (prix !== null && Number.isFinite(prix) && prix >= 0) champs.price = prix
        if (stock !== null && Number.isFinite(stock) && stock >= 0) champs.quantity = stock
        if (lotCondition) champs.condition = lotCondition
        next[id] = champs
      }
      return next
    })
    setLotPrix(''); setLotStock(''); setLotCondition('')
    setRapport(null)
  }

  // ── Enregistrement ────────────────────────────────────────────────────────
  async function enregistrer() {
    const updates = Object.entries(edits).map(([id, champs]) => ({ id, ...champs }))
    if (updates.length === 0) return
    setEnregistrement(true)
    setRapport(null)

    const res = await fetch('/api/listings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tcg: universe, updates }),
    })
    const data = await res.json().catch(() => ({}))
    setEnregistrement(false)

    if (!res.ok) {
      setErreur(data?.error ?? 'Enregistrement impossible.')
      return
    }
    const resultats: { id: string; ok?: boolean; error?: string }[] = data.results ?? []
    const ko = resultats.filter(r => r.error).map(r => ({ id: r.id, error: r.error! }))
    setRapport({ ok: resultats.length - ko.length, ko })
    setEdits({})
    setSelection(new Set())
    await charger()
  }

  const nbEdits = Object.keys(edits).length
  const sansPrix = visibles.filter(l => (valeur(l, 'quantity') as number) > 0 && (valeur(l, 'price') as number) <= 0).length

  const colonnes = '26px 44px 1fr 96px 110px 74px 88px 108px 34px 30px'

  if (chargement) {
    return <p style={{ fontSize: '11px', color: 'var(--muted)' }}>Chargement des listings…</p>
  }

  return (
    <>
      {erreur && (
        <div className="gk-vide">
          <span className="gk-pastille" />
          {erreur}
        </div>
      )}

      {/* ── Filtres ──────────────────────────────────────────────────────── */}
      <div
        style={{
          background: 'rgba(232,225,216,0.04)',
          border: '1px solid rgba(232,225,216,0.1)',
          borderRadius: 'var(--radius-gk-sm)',
          padding: '14px',
          marginBottom: '12px',
        }}
      >
        <div className="gk-facette-liste">
          {STATUTS.map(s => (
            <button
              key={s.v}
              onClick={() => setStatut(s.v)}
              className={`ab ${statut === s.v ? 'ab-amber' : 'ab-muted'}`}
              style={{ padding: '4px 10px', cursor: 'pointer', fontSize: '9px' }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Nom ou numéro…"
            className="gk-input"
            style={{ flex: 1, minWidth: '200px' }}
          />
          {variantes.length > 1 && (
            <select value={variante} onChange={e => setVariante(e.target.value)} className="gk-input" style={{ width: '150px' }}>
              <option value="">Toutes variantes</option>
              {variantes.map(v => <option key={v.code} value={v.code}>{v.label}</option>)}
            </select>
          )}
          {raretes.length > 1 && (
            <select value={rarete} onChange={e => setRarete(e.target.value)} className="gk-input" style={{ width: '150px' }}>
              <option value="">Toutes raretés</option>
              {raretes.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* ── Barre de sélection ───────────────────────────────────────────── */}
      {selection.size > 0 && (
        <div
          style={{
            background: 'rgba(212,144,12,0.08)',
            border: '1px solid rgba(212,144,12,0.22)',
            borderRadius: 'var(--radius-gk-sm)',
            padding: '10px 14px',
            marginBottom: '12px',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--amber)' }}>
            {selection.size} sélectionné{selection.size > 1 ? 's' : ''}
          </span>
          <input value={lotPrix} onChange={e => setLotPrix(e.target.value)} placeholder="Prix €" className="gk-input" style={{ width: '90px' }} />
          <input value={lotStock} onChange={e => setLotStock(e.target.value)} placeholder="Stock" className="gk-input" style={{ width: '80px' }} />
          <select value={lotCondition} onChange={e => setLotCondition(e.target.value)} className="gk-input" style={{ width: '140px' }}>
            <option value="">État inchangé</option>
            {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={appliquerALaSelection} className="gk-btn" data-primaire="true">Appliquer à la sélection</button>
          <button
            onClick={() => setSelection(new Set())}
            className="ab ab-muted"
            style={{ padding: '5px 10px', cursor: 'pointer', fontSize: '9px' }}
          >
            Désélectionner
          </button>
        </div>
      )}

      {/* ── Barre d'enregistrement ───────────────────────────────────────── */}
      {nbEdits > 0 && (
        <div
          style={{
            background: 'rgba(74,222,128,0.06)',
            border: '1px solid rgba(74,222,128,0.2)',
            borderRadius: 'var(--radius-gk-sm)',
            padding: '10px 14px',
            marginBottom: '12px',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '11px', color: '#4ade80' }}>
            {nbEdits} ligne{nbEdits > 1 ? 's' : ''} modifiée{nbEdits > 1 ? 's' : ''}, non enregistrée{nbEdits > 1 ? 's' : ''}
          </span>
          <span style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => { setEdits({}); setRapport(null) }}
              className="ab ab-muted"
              style={{ padding: '5px 10px', cursor: 'pointer', fontSize: '9px' }}
            >
              Annuler
            </button>
            <button onClick={enregistrer} disabled={enregistrement} className="gk-btn" data-primaire="true">
              {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </span>
        </div>
      )}

      {rapport && (
        <div
          className={rapport.ko.length ? 'gk-vide' : undefined}
          style={
            rapport.ko.length
              ? undefined
              : {
                  background: 'rgba(74,222,128,0.06)',
                  border: '1px solid rgba(74,222,128,0.2)',
                  borderRadius: 'var(--radius-gk-sm)',
                  padding: '9px 12px',
                  marginBottom: '12px',
                  fontSize: '11px',
                  color: '#4ade80',
                }
          }
        >
          {rapport.ko.length > 0 && <span className="gk-pastille" />}
          {rapport.ok} ligne(s) enregistrée(s)
          {rapport.ko.length > 0 && ` · ${rapport.ko.length} échec(s) : ${rapport.ko.map(k => k.error).join(' · ')}`}
        </div>
      )}

      {/* ── Grille ───────────────────────────────────────────────────────── */}
      <div className="gk-panneau">
        <div className="gk-panneau-tete">
          <span className="gk-label">
            {visibles.length} listing(s) affiché(s) sur {listings.length}
            {sansPrix > 0 ? ` · ${sansPrix} avec stock mais sans prix` : ''}
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: colonnes,
            gap: '8px',
            padding: '7px 14px',
            borderBottom: '1px solid rgba(212,144,12,0.06)',
            alignItems: 'center',
          }}
        >
          <input type="checkbox" checked={toutSelectionne} onChange={basculerTout} aria-label="Tout sélectionner" />
          <span className="gk-label" />
          <span className="gk-label">Carte</span>
          <span className="gk-label">Variante</span>
          <span className="gk-label">Rareté</span>
          <span className="gk-label" style={{ textAlign: 'right' }}>Stock</span>
          <span className="gk-label" style={{ textAlign: 'right' }}>Prix €</span>
          <span className="gk-label">État</span>
          <span className="gk-label" style={{ textAlign: 'center' }}>Actif</span>
          <span className="gk-label" />
        </div>

        {visibles.length === 0 ? (
          <p style={{ padding: '20px 14px', fontSize: '11px', color: 'var(--muted)' }}>
            Aucun listing ne correspond à ces filtres.
          </p>
        ) : (
          visibles.map(l => {
            const c = carteDe(l)
            const v = varianteDe(l)
            const modifie = !!edits[l.id]
            const qte = valeur(l, 'quantity') as number
            const prix = valeur(l, 'price') as number
            const actif = valeur(l, 'is_active') as boolean
            const alerte = qte > 0 && prix <= 0
            const img = visuelDuListing(l)

            return (
              <div
                key={l.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: colonnes,
                  gap: '8px',
                  alignItems: 'center',
                  padding: '6px 14px',
                  borderBottom: '1px solid rgba(212,144,12,0.04)',
                  background: modifie ? 'rgba(212,144,12,0.06)' : undefined,
                }}
              >
                <input
                  type="checkbox"
                  checked={selection.has(l.id)}
                  onChange={() => basculer(l.id)}
                  aria-label={`Sélectionner ${c?.name_fr ?? ''}`}
                />

                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element -- vignette dense de table admin
                  <img
                    src={img}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    style={{ width: '32px', height: '44px', objectFit: 'cover', borderRadius: '2px' }}
                  />
                ) : (
                  <span style={{ width: '32px', height: '44px', display: 'block', background: 'rgba(232,225,216,0.06)', borderRadius: '2px' }} />
                )}

                <span style={{ minWidth: 0 }}>
                  <span className="gk-cell" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c?.name_fr}
                  </span>
                  <span className="gk-cell mono" style={{ display: 'block' }}>
                    #{c?.number}
                    {l.needs_photo ? ' · photo requise' : ''}
                  </span>
                </span>

                <span className="ab ab-muted" style={{ justifySelf: 'start' }}>{v?.label ?? '—'}</span>
                <span className="gk-cell muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c?.rarity ?? '—'}
                </span>

                <input
                  type="number"
                  min={0}
                  value={qte}
                  onChange={e => editer(l.id, 'quantity', parseInt(e.target.value, 10) || 0)}
                  className="gk-input"
                  style={{ textAlign: 'right' }}
                  aria-label={`Stock de ${c?.name_fr ?? ''}`}
                />

                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={prix}
                  onChange={e => editer(l.id, 'price', parseFloat(e.target.value) || 0)}
                  className="gk-input"
                  style={{
                    textAlign: 'right',
                    borderColor: alerte ? 'rgba(212,144,12,0.5)' : undefined,
                    color: alerte ? 'var(--amber)' : undefined,
                  }}
                  aria-label={`Prix de ${c?.name_fr ?? ''}`}
                />

                <select
                  value={valeur(l, 'condition') as string}
                  onChange={e => editer(l.id, 'condition', e.target.value)}
                  className="gk-input"
                  aria-label={`État de ${c?.name_fr ?? ''}`}
                >
                  {CONDITIONS.map(x => <option key={x} value={x}>{x}</option>)}
                </select>

                <button
                  onClick={() => editer(l.id, 'is_active', !actif)}
                  title={actif ? 'Visible en boutique' : 'Masqué'}
                  className={`ab ${actif ? 'ab-green' : 'ab-muted'}`}
                  style={{ cursor: 'pointer', padding: '3px 6px', justifySelf: 'center' }}
                >
                  {actif ? 'ON' : 'OFF'}
                </button>

                <Link
                  href={`/admin/listings/${l.id}`}
                  title="Fiche complète"
                  className="gk-cell muted"
                  style={{ textAlign: 'right', textDecoration: 'none' }}
                >
                  →
                </Link>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
