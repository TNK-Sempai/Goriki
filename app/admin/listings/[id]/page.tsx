'use client'

import { useState, useEffect, use } from 'react'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'

interface Listing {
  id: string
  front_photo_url: string | null
  back_photo_url: string | null
  image_api: string | null
  needs_photo: boolean
  price: number
  pokemon_cards?: { name_fr: string; number: string }
  onepiece_cards?: { name_fr: string; number: string }
}

interface Props { params: Promise<{ id: string }> }

type TCG = 'pokemon' | 'onepiece'

export default function ListingPhotoPage({ params }: Props) {
  const { id } = use(params)
  const [listing, setListing] = useState<Listing | null>(null)
  const [tcg, setTcg] = useState<TCG>('pokemon')
  const [uploading, setUploading] = useState<'front' | 'back' | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    // Chercher dans pokemon d'abord, puis onepiece
    fetch(`/api/listings?tcg=pokemon&listing_id=${id}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setListing(data[0])
          setTcg('pokemon')
        } else {
          fetch(`/api/listings?tcg=onepiece&listing_id=${id}`)
            .then(r => r.json())
            .then(d => {
              if (Array.isArray(d) && d.length > 0) {
                setListing(d[0])
                setTcg('onepiece')
              }
            })
        }
      })
  }, [id])

  async function handleUpload(side: 'front' | 'back', file: File) {
    setUploading(side)
    setMessage(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('listing_id', id)
    formData.append('side', side)
    formData.append('tcg', tcg)

    const res = await fetch('/api/upload/photo', { method: 'POST', body: formData })
    const data = await res.json()

    if (res.ok) {
      setListing(prev => prev ? {
        ...prev,
        [side === 'front' ? 'front_photo_url' : 'back_photo_url']: data.url,
        needs_photo: false,
      } : null)
      setMessage({ type: 'success', text: `Photo ${side === 'front' ? 'recto' : 'verso'} uploadée ✓` })
    } else {
      setMessage({ type: 'error', text: data.error ?? 'Erreur upload' })
    }
    setUploading(null)
  }

  if (!listing) return (
    <div className="p-8">
      <div className="skeleton h-8 w-48 mb-4" />
      <div className="skeleton h-64 w-full" />
    </div>
  )

  const card = listing.pokemon_cards ?? listing.onepiece_cards

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="font-display text-2xl text-cream mb-1">Upload photos</h1>
        <p className="text-muted text-sm">#{card?.number} — {card?.name_fr}</p>
        {listing.needs_photo && (
          <span className="badge badge-danger mt-2 inline-flex">Photo requise</span>
        )}
      </div>

      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg mb-6 ${
          message.type === 'success'
            ? 'bg-green-950/30 border border-green-900/40 text-green-400'
            : 'bg-red-950/30 border border-red-900/40 text-red-400'
        }`}>
          {message.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {(['front', 'back'] as const).map(side => {
          const url = side === 'front' ? listing.front_photo_url : listing.back_photo_url
          const label = side === 'front' ? 'Recto' : 'Verso'

          return (
            <div key={side} className="card-elevated">
              <p className="text-sm font-medium text-cream mb-3">{label}</p>

              {url ? (
                <div className="mb-3">
                  <img src={url} alt={label} className="w-full aspect-[2.5/3.5] object-cover rounded" />
                </div>
              ) : (
                <div className="w-full aspect-[2.5/3.5] bg-surface-1 rounded flex items-center justify-center mb-3">
                  {listing.image_api && side === 'front' ? (
                    <img src={listing.image_api} alt="API" className="w-full h-full object-cover rounded opacity-40" />
                  ) : (
                    <p className="text-muted text-xs">Aucune photo</p>
                  )}
                </div>
              )}

              <label className="btn btn-outline btn-sm w-full cursor-pointer flex items-center justify-center gap-2">
                <Upload size={13} />
                {uploading === side ? 'Upload...' : url ? 'Remplacer' : 'Uploader'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading !== null}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(side, file)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          )
        })}
      </div>

      <div className="mt-8 card text-sm space-y-2">
        <div className="flex justify-between">
          <span className="text-muted">Prix</span>
          <span className="text-amber">{listing.price.toFixed(2)} €</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Photo recto</span>
          <span className={listing.front_photo_url ? 'text-green-400' : 'text-muted'}>
            {listing.front_photo_url ? '✓ Présente' : '—'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Photo verso</span>
          <span className={listing.back_photo_url ? 'text-green-400' : 'text-muted'}>
            {listing.back_photo_url ? '✓ Présente' : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}
