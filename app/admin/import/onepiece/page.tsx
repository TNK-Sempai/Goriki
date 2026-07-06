'use client'

import { useState, useEffect } from 'react'
import ImportLogPanel from '@/components/admin/ImportLogPanel'

interface OPESetSummary {
  id: string
  name: string
  code?: string
  releaseDate?: string
  cardCount?: number
}

export default function ImportOnePiecePage() {
  const [sets, setSets] = useState<OPESetSummary[]>([])
  const [selectedSet, setSelectedSet] = useState('')
  const [loading, setLoading] = useState<'single' | 'bulk' | 'sync' | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [loadingSets, setLoadingSets] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/import/onepiece')
      .then(r => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const sorted = [...data].sort((a, b) =>
            (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '')
          )
          setSets(sorted)
        } else {
          setFetchError('Impossible de récupérer les sets OPECards')
        }
        setLoadingSets(false)
      })
      .catch(() => {
        setFetchError('Erreur réseau OPECards')
        setLoadingSets(false)
      })
  }, [])

  async function handleImport() {
    if (!selectedSet) return
    setLoading('single')
    setLogs([`[START] Import du set : ${selectedSet}`])

    const res = await fetch('/api/import/onepiece', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setId: selectedSet }),
    })
    const data = await res.json()
    setLogs(data.logs ?? ['Erreur inconnue'])
    setLoading(null)
  }

  async function handleBulk() {
    setLoading('bulk')
    setLogs(['[START] Import de tous les sets One Piece...'])
    const res = await fetch('/api/import/onepiece?action=bulk', { method: 'POST' })
    const data = await res.json()
    setLogs(data.logs ?? ['Erreur inconnue'])
    setLoading(null)
  }

  async function handleSync() {
    setLoading('sync')
    setLogs(['[START] Sync des sets One Piece...'])
    const res = await fetch('/api/import/onepiece?action=sync', { method: 'POST' })
    const data = await res.json()
    setLogs(data.logs ?? ['Erreur inconnue'])
    setLoading(null)
  }

  return (
    <div style={{ maxWidth: '560px' }}>
      <div className="admin-header-row">
        <div>
          <div className="admin-title">Import One Piece</div>
          <div className="admin-sub">Sélectionne un set et importe les cartes depuis OPECards</div>
        </div>
      </div>

      <div style={{ background: 'var(--surface-1)', border: '1px solid rgba(212,144,12,0.08)', borderRadius: '3px', padding: '16px', marginBottom: '16px' }}>
        {/* Boutons bulk + sync */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            onClick={handleBulk}
            disabled={!!loading}
            style={{
              fontSize: '10px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              color: loading ? 'var(--muted)' : '#0C0A07',
              background: loading ? 'rgba(212,144,12,0.3)' : 'var(--amber)',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '2px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
            }}
          >
            {loading === 'bulk' ? 'Import en cours...' : '↓ Tout importer (OPECards)'}
          </button>
          <button
            onClick={handleSync}
            disabled={!!loading}
            style={{
              fontSize: '10px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              color: 'var(--amber)',
              background: 'transparent',
              border: '1px solid rgba(212,144,12,0.25)',
              padding: '8px 16px',
              borderRadius: '2px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            {loading === 'sync' ? 'Sync en cours...' : '↺ Sync nouveaux sets'}
          </button>
        </div>

        <label style={{ display: 'block', fontSize: '8px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(238,228,204,0.25)', marginBottom: '6px' }}>
          Set à importer
        </label>
        {loadingSets ? (
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Chargement des sets…</div>
        ) : fetchError ? (
          <div className="admin-alert"><div className="admin-alert-dot" />{fetchError}</div>
        ) : (
          <select
            value={selectedSet}
            onChange={(e) => setSelectedSet(e.target.value)}
            className="admin-input"
          >
            <option value="">-- Choisir un set --</option>
            {sets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.name} ({set.code ?? set.id}) — {set.cardCount ?? '?'} cartes
              </option>
            ))}
          </select>
        )}

        <button
          onClick={handleImport}
          disabled={!selectedSet || !!loading}
          className="btn btn-primary btn-sm"
          style={{ marginTop: '12px', width: '100%' }}
        >
          {loading === 'single' ? 'Import en cours...' : "Lancer l'import"}
        </button>
      </div>

      <div className="admin-sep">Log d&apos;import <div className="admin-sep-line" /></div>
      <ImportLogPanel logs={logs} loading={loading !== null} />
    </div>
  )
}
