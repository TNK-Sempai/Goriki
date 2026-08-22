'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, use } from 'react'
import { Upload } from 'lucide-react'
import ExemplairesPanel from '@/components/admin/ExemplairesPanel'

/**
 * Fiche listing — vrai formulaire de gestion.
 *
 * L'écran précédent ne savait faire QU'UNE chose : téléverser des photos. Prix,
 * stock, état et visibilité n'y étaient pas modifiables, alors que la page
 * s'appelle « listing ». L'upload est conservé tel quel (il fonctionne) et le
 * reste du formulaire vient s'ajouter autour — fusion, pas duplication.
 *
 * Aucun calcul de prix : c'est de la saisie. Le seul automatisme est le rappel
 * qu'une pièce en stock sans prix n'est pas vendable.
 */

type TCG = 'pokemon' | 'onepiece'

interface Carte { id: string; number: string; name_fr: string; rarity: string | null; set_id: string }
interface Variante { id: string; code: string; label: string }

interface Listing {
  id: string
  quantity: number
  price: number
  condition: string
  is_active: boolean
  needs_photo: boolean
  front_photo_url: string | null
  back_photo_url: string | null
  image_api: string | null
  pokemon_cards?: Carte
  onepiece_cards?: Carte
  pokemon_variant_types?: Variante
  onepiece_variant_types?: Variante
}

const CONDITIONS = ['Mint', 'Near Mint', 'Excellent', 'Light Played', 'Moderate Played']

export default function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [listing, setListing] = useState<Listing | null>(null)
  const [tcg, setTcg] = useState<TCG>('pokemon')
  const [introuvable, setIntrouvable] = useState(false)

  const [quantity, setQuantity] = useState('0')
  const [price, setPrice] = useState('0')
  const [condition, setCondition] = useState('Near Mint')
  const [isActive, setIsActive] = useState(true)

  const [upload, setUpload] = useState<'front' | 'back' | null>(null)
  const [enregistrement, setEnregistrement] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)

  const hydrater = useCallback((l: Listing) => {
    setListing(l)
    setQuantity(String(l.quantity))
    setPrice(String(l.price))
    setCondition(l.condition)
    setIsActive(l.is_active)
  }, [])

  const charger = useCallback(async () => {
    // Le listing peut appartenir à l'un ou l'autre univers : on tente Pokémon,
    // puis One Piece. Même stratégie que la fiche produit publique.
    for (const univers of ['pokemon', 'onepiece'] as TCG[]) {
      const res = await fetch(`/api/listings?tcg=${univers}&listing_id=${id}`)
      const data = await res.json().catch(() => null)
      if (res.ok && Array.isArray(data) && data.length > 0) {
        setTcg(univers)
        hydrater(data[0] as Listing)
        return
      }
    }
    setIntrouvable(true)
  }, [id, hydrater])

  useEffect(() => {
    // Chargement de données au montage : tous les `setState` de `charger` sont
    // posés après un `await`, jamais dans le corps synchrone de l'effet.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger()
  }, [charger])

  async function enregistrer() {
    setEnregistrement(true)
    setMessage(null)

    const q = parseInt(quantity, 10)
    const p = Number(price.replace(',', '.'))
    if (!Number.isFinite(q) || q < 0 || !Number.isFinite(p) || p < 0) {
      setEnregistrement(false)
      setMessage({ ok: false, texte: 'Stock et prix doivent être des nombres positifs.' })
      return
    }

    const res = await fetch('/api/listings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tcg,
        updates: [{ id, quantity: q, price: p, condition, is_active: isActive }],
      }),
    })
    const data = await res.json().catch(() => ({}))
    setEnregistrement(false)

    const echec = data?.results?.find((r: { error?: string }) => r.error)
    if (!res.ok || echec) {
      setMessage({ ok: false, texte: echec?.error ?? data?.error ?? 'Enregistrement impossible.' })
      return
    }
    setMessage({ ok: true, texte: 'Listing enregistré.' })
    await charger()
  }

  async function televerser(side: 'front' | 'back', file: File) {
    setUpload(side)
    setMessage(null)

    const form = new FormData()
    form.append('file', file)
    form.append('listing_id', id)
    form.append('side', side)
    form.append('tcg', tcg)

    const res = await fetch('/api/upload/photo', { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    setUpload(null)

    if (!res.ok) {
      setMessage({ ok: false, texte: data.error ?? 'Envoi de la photo impossible.' })
      return
    }
    setListing(prev => prev ? {
      ...prev,
      [side === 'front' ? 'front_photo_url' : 'back_photo_url']: data.url,
      needs_photo: false,
    } : prev)
    setMessage({ ok: true, texte: `Photo ${side === 'front' ? 'recto' : 'verso'} envoyée.` })
  }

  if (introuvable) {
    return (
      <div>
        <div className="admin-alert">
          <span className="admin-alert-dot" />
          Aucun listing avec cet identifiant.
        </div>
        <Link href="/admin/listings" className="admin-table-action">← Tous les sets</Link>
      </div>
    )
  }

  if (!listing) return <p style={{ fontSize: '11px', color: 'var(--muted)' }}>Chargement…</p>

  const carte = listing.pokemon_cards ?? listing.onepiece_cards
  const variante = listing.pokemon_variant_types ?? listing.onepiece_variant_types
  const alerte = Number(quantity) > 0 && Number(price.replace(',', '.')) <= 0

  const modifie =
    String(listing.quantity) !== quantity ||
    String(listing.price) !== price ||
    listing.condition !== condition ||
    listing.is_active !== isActive

  return (
    <div>
      <div className="admin-header-row">
        <div>
          <Link
            href={carte ? `/admin/listings/set/${tcg}/${carte.set_id}` : '/admin/listings'}
            className="admin-table-action"
            style={{ display: 'block', marginBottom: '6px' }}
          >
            ← Retour au set
          </Link>
          <div className="admin-title">{carte?.name_fr ?? 'Listing'}</div>
          <div className="admin-sub">
            #{carte?.number} · {variante?.label ?? '—'}
            {carte?.rarity ? ` · ${carte.rarity}` : ''} · {tcg === 'pokemon' ? 'Pokémon' : 'One Piece'}
          </div>
        </div>
      </div>

      {message && (
        <div
          className={message.ok ? undefined : 'admin-alert'}
          style={message.ok ? {
            background: 'rgba(74,222,128,0.06)',
            border: '1px solid rgba(74,222,128,0.2)',
            borderRadius: 'var(--radius-admin-sm)',
            padding: '9px 12px',
            marginBottom: '16px',
            fontSize: '11px',
            color: '#4ade80',
          } : undefined}
        >
          {!message.ok && <span className="admin-alert-dot" />}
          {message.texte}
        </div>
      )}

      {alerte && (
        <div className="admin-alert">
          <span className="admin-alert-dot" />
          Du stock, mais aucun prix : cette pièce n&apos;est pas vendable en l&apos;état.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: '16px', alignItems: 'start' }}>
        {/* ── Formulaire ─────────────────────────────────────────────────── */}
        <div
          style={{
            background: 'rgba(232,225,216,0.04)',
            border: '1px solid rgba(232,225,216,0.1)',
            borderRadius: 'var(--radius-admin-sm)',
            padding: '18px',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
            <label>
              <span className="admin-kpi-label">Stock</span>
              <input
                type="number"
                min={0}
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className="admin-input"
              />
            </label>

            <label>
              <span className="admin-kpi-label">Prix (€)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="admin-input"
                style={alerte ? { borderColor: 'rgba(212,144,12,0.5)', color: 'var(--amber)' } : undefined}
              />
            </label>

            <label>
              <span className="admin-kpi-label">État</span>
              <select value={condition} onChange={e => setCondition(e.target.value)} className="admin-input">
                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            <label>
              <span className="admin-kpi-label">Visibilité boutique</span>
              <button
                onClick={() => setIsActive(a => !a)}
                className={`ab ${isActive ? 'ab-green' : 'ab-muted'}`}
                style={{ cursor: 'pointer', padding: '7px 12px', width: '100%', fontSize: '9px' }}
              >
                {isActive ? 'Visible' : 'Masqué'}
              </button>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '18px', alignItems: 'center' }}>
            <button onClick={enregistrer} disabled={!modifie || enregistrement} className="btn btn-primary btn-sm">
              {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {modifie && (
              <button
                onClick={() => hydrater(listing)}
                className="ab ab-muted"
                style={{ padding: '6px 10px', cursor: 'pointer', fontSize: '9px' }}
              >
                Annuler
              </button>
            )}
          </div>
        </div>

        {/* ── Photos ─────────────────────────────────────────────────────── */}
        <div
          style={{
            background: 'rgba(232,225,216,0.04)',
            border: '1px solid rgba(232,225,216,0.1)',
            borderRadius: 'var(--radius-admin-sm)',
            padding: '18px',
          }}
        >
          <span className="admin-kpi-label">Scans</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
            {(['front', 'back'] as const).map(side => {
              const url = side === 'front' ? listing.front_photo_url : listing.back_photo_url
              const apercu = url ?? (side === 'front' ? listing.image_api : null)
              return (
                <div key={side}>
                  <span className="admin-cell mono" style={{ display: 'block', marginBottom: '5px' }}>
                    {side === 'front' ? 'Recto' : 'Verso'}
                  </span>
                  {apercu ? (
                    // eslint-disable-next-line @next/next/no-img-element -- aperçu admin, source Cloudinary ou API
                    <img
                      src={apercu}
                      alt={side === 'front' ? 'Recto' : 'Verso'}
                      style={{
                        width: '100%',
                        aspectRatio: '2.5 / 3.5',
                        objectFit: 'cover',
                        borderRadius: '2px',
                        opacity: url ? 1 : 0.4,
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        display: 'block',
                        width: '100%',
                        aspectRatio: '2.5 / 3.5',
                        background: 'rgba(232,225,216,0.06)',
                        borderRadius: '2px',
                      }}
                    />
                  )}
                  <label
                    className="ab ab-muted"
                    style={{
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      padding: '6px',
                      marginTop: '6px',
                    }}
                  >
                    <Upload size={11} />
                    {upload === side ? 'Envoi…' : url ? 'Remplacer' : 'Téléverser'}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      disabled={upload !== null}
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) televerser(side, f)
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
              )
            })}
          </div>

          {listing.needs_photo && (
            <p style={{ marginTop: '10px', fontSize: '10px', color: '#f87171' }}>
              Marquée « photo requise » : au-dessus du seuil de scan réel.
            </p>
          )}
        </div>
      </div>

      <ExemplairesPanel
        universe={tcg}
        listingId={id}
        prixCourant={Number(price.replace(',', '.')) || 0}
        conditionCourante={condition}
      />
    </div>
  )
}
