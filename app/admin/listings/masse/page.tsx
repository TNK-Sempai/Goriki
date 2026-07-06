'use client'

import { useState, useEffect, useCallback } from 'react'
import MassListingTable from '@/components/admin/MassListingTable'

type TCG = 'pokemon' | 'onepiece'

interface SetOption { id: string; code: string; name_fr: string }

export default function MassListingPage() {
  const [tcg, setTcg] = useState<TCG>('pokemon')
  const [sets, setSets] = useState<SetOption[]>([])
  const [selectedSet, setSelectedSet] = useState('')
  const [listings, setListings] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/listings?tcg=${tcg}&sets_only=true`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSets(data) })
    setSelectedSet('')
    setListings([])
  }, [tcg])

  const loadListings = useCallback(async () => {
    if (!selectedSet) return
    setLoading(true)
    const res = await fetch(`/api/listings?tcg=${tcg}&set_id=${selectedSet}`)
    const data = await res.json()
    setListings(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [tcg, selectedSet])

  const handleSave = useCallback(async (updates: any[]) => {
    await fetch('/api/listings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tcg, updates }),
    })
    await loadListings()
  }, [tcg, loadListings])

  return (
    <div>
      <div className="admin-header-row">
        <div>
          <div className="admin-title">Édition en masse</div>
          <div className="admin-sub">Modifier prix, quantités et conditions par set</div>
        </div>
      </div>

      <div style={{ background: 'var(--surface-1)', border: '1px solid rgba(212,144,12,0.08)', borderRadius: '3px', padding: '16px', marginBottom: '16px' }}>
        <div className="admin-filter-pills">
          {(['pokemon', 'onepiece'] as TCG[]).map((t) => (
            <button
              key={t}
              onClick={() => setTcg(t)}
              className={`ab ${tcg === t ? 'ab-amber' : 'ab-muted'}`}
              style={{ padding: '4px 10px', cursor: 'pointer', fontSize: '9px' }}
            >
              {t === 'pokemon' ? 'Pokémon' : 'One Piece'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <select
            value={selectedSet}
            onChange={(e) => setSelectedSet(e.target.value)}
            className="admin-input"
            style={{ flex: 1 }}
          >
            <option value="">-- Choisir un set --</option>
            {sets.map(s => (
              <option key={s.id} value={s.id}>{s.name_fr} ({s.code})</option>
            ))}
          </select>
          <button
            onClick={loadListings}
            disabled={!selectedSet || loading}
            className="btn btn-primary btn-sm"
          >
            {loading ? 'Chargement...' : 'Charger'}
          </button>
        </div>
      </div>

      {listings.length > 0 && (
        <div className="admin-table" style={{ padding: '4px' }}>
          <MassListingTable listings={listings} onSave={handleSave} />
        </div>
      )}

      {listings.length === 0 && selectedSet && !loading && (
        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
          Aucun listing trouvé pour ce set. Importe d&apos;abord les cartes.
        </div>
      )}
    </div>
  )
}
