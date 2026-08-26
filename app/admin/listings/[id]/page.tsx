'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, use } from 'react'
import { Upload } from 'lucide-react'
import ExemplairesPanel from '@/components/admin/ExemplairesPanel'
import {
  carteDuListing,
  varianteDuListing,
  visuelDuListing,
  type ListingAdmin,
} from '@/lib/admin/listings'
import { verifierUrlCloudinary } from '@/lib/admin/photo-url'

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

/** Forme décrite une seule fois, dans `lib/admin/listings`. */
type Listing = ListingAdmin

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
  /** Champ « coller une URL », ouvert et saisi indépendamment par face. */
  const [collage, setCollage] = useState<{ front: string | null; back: string | null }>({
    front: null,
    back: null,
  })
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

  /**
   * Rattache un scan DÉJÀ sur Cloudinary, sans le renvoyer.
   *
   * Chemin volontairement séparé de `televerser` : celui-ci n'envoie aucun
   * fichier. Quand on a déposé cent scans d'un coup sur Cloudinary, repasser
   * par le téléversement en créerait cent doublons.
   */
  async function rattacherUrl(side: 'front' | 'back', url: string) {
    setUpload(side)
    setMessage(null)

    const res = await fetch('/api/admin/listings/photo-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: id, side, tcg, url }),
    })
    const data = await res.json().catch(() => ({}))
    setUpload(null)

    if (!res.ok) {
      setMessage({ ok: false, texte: data.error ?? 'URL non rattachée.' })
      return
    }

    // `needs_photo` est relu de la base : c'est le trigger qui l'arbitre, pas
    // cet écran.
    setListing(prev => prev ? {
      ...prev,
      [side === 'front' ? 'front_photo_url' : 'back_photo_url']: data.url,
      needs_photo: data.needs_photo ?? prev.needs_photo,
    } : prev)
    setCollage(c => ({ ...c, [side]: '' }))
    setMessage({
      ok: true,
      texte: data.avertissement
        ?? `URL ${side === 'front' ? 'recto' : 'verso'} rattachée — aucun fichier renvoyé.`,
    })
  }

  if (introuvable) {
    return (
      <div>
        <div className="gk-vide">
          <span className="gk-pastille" />
          Aucun listing avec cet identifiant.
        </div>
        <Link href="/admin/listings" className="gk-btn">← Tous les sets</Link>
      </div>
    )
  }

  if (!listing) return <p style={{ fontSize: '11px', color: 'var(--muted)' }}>Chargement…</p>

  const carte = carteDuListing(listing)
  const variante = varianteDuListing(listing)
  const alerte = Number(quantity) > 0 && Number(price.replace(',', '.')) <= 0

  const modifie =
    String(listing.quantity) !== quantity ||
    String(listing.price) !== price ||
    listing.condition !== condition ||
    listing.is_active !== isActive

  return (
    <div className="gk-corps">
      <div className="gk-entete-ecran">
        <div>
          <Link
            href={carte ? `/admin/listings/set/${tcg}/${carte.set_id}` : '/admin/listings'}
            className="gk-btn"
            style={{ display: 'block', marginBottom: '6px' }}
          >
            ← Retour au set
          </Link>
          <div className="gk-titre">{carte?.name_fr ?? 'Listing'}</div>
          <div className="gk-eyebrow-texte">
            #{carte?.number} · {variante?.label ?? '—'}
            {carte?.rarity ? ` · ${carte.rarity}` : ''} · {tcg === 'pokemon' ? 'Pokémon' : 'One Piece'}
          </div>
        </div>
      </div>

      {message && (
        <div
          className={message.ok ? undefined : 'gk-vide'}
          style={message.ok ? {
            background: 'rgba(74,222,128,0.06)',
            border: '1px solid rgba(74,222,128,0.2)',
            borderRadius: 'var(--radius-gk-sm)',
            padding: '9px 12px',
            marginBottom: '16px',
            fontSize: '11px',
            color: '#4ade80',
          } : undefined}
        >
          {!message.ok && <span className="gk-pastille" />}
          {message.texte}
        </div>
      )}

      {alerte && (
        <div className="gk-vide">
          <span className="gk-pastille" />
          Du stock, mais aucun prix : cette pièce n&apos;est pas vendable en l&apos;état.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: '16px', alignItems: 'start' }}>
        {/* ── Formulaire ─────────────────────────────────────────────────── */}
        <div
          style={{
            background: 'rgba(232,225,216,0.04)',
            border: '1px solid rgba(232,225,216,0.1)',
            borderRadius: 'var(--radius-gk-sm)',
            padding: '18px',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
            <label>
              <span className="gk-kpi-label">Stock</span>
              <input
                type="number"
                min={0}
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className="gk-input"
              />
            </label>

            <label>
              <span className="gk-kpi-label">Prix (€)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="gk-input"
                style={alerte ? { borderColor: 'rgba(212,144,12,0.5)', color: 'var(--amber)' } : undefined}
              />
            </label>

            <label>
              <span className="gk-kpi-label">État</span>
              <select value={condition} onChange={e => setCondition(e.target.value)} className="gk-input">
                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            <label>
              <span className="gk-kpi-label">Visibilité boutique</span>
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
            <button onClick={enregistrer} disabled={!modifie || enregistrement} className="gk-btn" data-primaire="true">
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
            borderRadius: 'var(--radius-gk-sm)',
            padding: '18px',
          }}
        >
          <span className="gk-kpi-label">Scans</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
            {(['front', 'back'] as const).map(side => {
              const url = side === 'front' ? listing.front_photo_url : listing.back_photo_url
              // Le recto se rabat sur le visuel de la variante ; le verso n'a
              // pas d'équivalent d'API — une carte scannée au dos n'existe que
              // si quelqu'un l'a photographiée.
              const apercu = url ?? (side === 'front' ? visuelDuListing(listing) : null)
              // Même fonction que celle appliquée par la route : ce qui est
              // refusé ici le serait de toute façon au serveur, qui reste
              // l'autorité. Ici, c'est seulement pour le dire tout de suite.
              const saisie = collage[side]
              const verdict = saisie === null ? null : verifierUrlCloudinary(saisie)
              return (
                <div key={side}>
                  <span className="gk-cell mono" style={{ display: 'block', marginBottom: '5px' }}>
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

                  {/* ── Coller une URL déjà sur Cloudinary ──────────────────
                      À CÔTÉ du téléversement, jamais à sa place : envoyer un
                      fichier depuis la fiche reste le bon geste quand on scanne
                      une pièce isolée. Ce champ sert l'autre cas — les scans
                      déjà déposés en masse, qu'un second upload dupliquerait. */}
                  {collage[side] === null ? (
                    <button
                      type="button"
                      className="gk-cell muted"
                      onClick={() => setCollage(c => ({ ...c, [side]: '' }))}
                      style={{
                        marginTop: '4px',
                        width: '100%',
                        background: 'none',
                        border: 0,
                        cursor: 'pointer',
                        textAlign: 'center',
                        textDecoration: 'underline',
                        fontSize: '10px',
                      }}
                    >
                      Coller une URL
                    </button>
                  ) : (
                    <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <input
                        value={collage[side] ?? ''}
                        onChange={e => setCollage(c => ({ ...c, [side]: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && verdict?.ok) rattacherUrl(side, collage[side] ?? '')
                          if (e.key === 'Escape') setCollage(c => ({ ...c, [side]: null }))
                        }}
                        placeholder="https://res.cloudinary.com/…"
                        aria-label={`URL du scan ${side === 'front' ? 'recto' : 'verso'}`}
                        className="gk-input"
                        style={{ fontSize: '10px' }}
                        autoFocus
                      />
                      {/* Le refus s'affiche pendant la frappe, avant l'envoi :
                          une URL d'un autre compte Cloudinary se voit tout de
                          suite, sans aller-retour. */}
                      {verdict && !verdict.ok && (collage[side] ?? '').trim() !== '' && (
                        <span style={{ fontSize: '9px', color: 'var(--gk-rouge)' }}>{verdict.raison}</span>
                      )}
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          className="gk-btn"
                          data-primaire="true"
                          disabled={upload !== null || !verdict?.ok}
                          onClick={() => rattacherUrl(side, collage[side] ?? '')}
                          style={{ flex: 1, fontSize: '10px' }}
                        >
                          {upload === side ? 'Liaison…' : 'Rattacher'}
                        </button>
                        <button
                          type="button"
                          className="gk-btn"
                          onClick={() => setCollage(c => ({ ...c, [side]: null }))}
                          style={{ fontSize: '10px' }}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
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
