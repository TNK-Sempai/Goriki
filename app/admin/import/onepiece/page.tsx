'use client'

import { useState, useEffect, useRef } from 'react'
import ImportLogPanel from '@/components/admin/ImportLogPanel'

interface OPESetSummary {
  id: string
  name: string
  code?: string
  releaseDate?: string
  cardCount?: number
}

interface ImportErrorItem {
  item: string
  message: string
}

interface ImportStats {
  setsProcessed?: number
  cardsImported: number
  listingsCreated: number
  errors: ImportErrorItem[]
  durationMs: number
}

interface ImportResponse {
  ok: boolean
  logs?: string[]
  stats?: ImportStats
  error?: string
}

interface StatRow {
  label: string
  value: string | number
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function statsToRows(stats: ImportStats): StatRow[] {
  const rows: StatRow[] = []
  if (stats.setsProcessed !== undefined) rows.push({ label: 'Sets', value: stats.setsProcessed })
  rows.push({ label: 'Cartes', value: stats.cardsImported })
  rows.push({ label: 'Listings', value: stats.listingsCreated })
  rows.push({ label: 'Erreurs', value: stats.errors.length })
  rows.push({ label: 'Durée', value: formatDuration(stats.durationMs) })
  return rows
}

async function parseImportResponse(res: Response): Promise<ImportResponse> {
  try {
    const data = await res.json()
    return data as ImportResponse
  } catch {
    return { ok: false, logs: [`[ERR] Réponse invalide (HTTP ${res.status})`], error: 'Réponse invalide du serveur' }
  }
}

export default function ImportOnePiecePage() {
  const [sets, setSets] = useState<OPESetSummary[]>([])
  const [selectedSet, setSelectedSet] = useState('')
  const [loading, setLoading] = useState<'single' | 'bulk' | 'sync' | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [statRows, setStatRows] = useState<StatRow[]>([])
  const [errorRows, setErrorRows] = useState<ImportErrorItem[]>([])
  const [loadingSets, setLoadingSets] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [apiUnavailable, setApiUnavailable] = useState(false)
  const cancelBulkRef = useRef(false)

  useEffect(() => {
    fetch('/api/import/onepiece')
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}))
          if (r.status === 503) {
            setApiUnavailable(true)
            setFetchError(body.error ?? 'API OPECards indisponible (domaine mort) — import One Piece désactivé, alternatives à valider')
          } else {
            setFetchError(body.error ?? `Impossible de récupérer les sets (HTTP ${r.status})`)
          }
          setLoadingSets(false)
          return
        }
        const data = await r.json()
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

  function applyResult(data: ImportResponse) {
    setLogs(data.logs ?? [data.error ?? 'Erreur inconnue'])
    if (data.stats) {
      setStatRows(statsToRows(data.stats))
      setErrorRows(data.stats.errors)
    } else if (!data.ok) {
      setErrorRows(data.error ? [{ item: 'Import', message: data.error }] : [])
    }
  }

  async function handleImport() {
    if (!selectedSet) return
    setLoading('single')
    setLogs([`[START] Import du set : ${selectedSet}`])
    setStatRows([])
    setErrorRows([])

    const res = await fetch('/api/import/onepiece', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setId: selectedSet }),
    })
    applyResult(await parseImportResponse(res))
    setLoading(null)
  }

  async function handleSync() {
    setLoading('sync')
    setLogs(['[START] Sync des sets One Piece...'])
    setStatRows([])
    setErrorRows([])

    const res = await fetch('/api/import/onepiece?action=sync', { method: 'POST' })
    applyResult(await parseImportResponse(res))
    setLoading(null)
  }

  // Orchestration client : un POST single par set, séquentiel (comme Pokémon) —
  // évite un éventuel timeout serveur et affiche la progression en direct.
  async function handleBulk() {
    if (sets.length === 0 || loading) return
    cancelBulkRef.current = false
    setLoading('bulk')
    setErrorRows([])

    const total = sets.length
    const startedAt = Date.now()
    let cumulativeLogs = [`[START] Import de tous les sets One Piece (${total} sets)...`]
    setLogs(cumulativeLogs)

    let cardsImported = 0
    let listingsCreated = 0
    let setsProcessed = 0
    const allErrors: ImportErrorItem[] = []

    const pushStats = () => {
      setStatRows([
        { label: 'Sets', value: `${setsProcessed}/${total}` },
        { label: 'Cartes', value: cardsImported },
        { label: 'Listings', value: listingsCreated },
        { label: 'Erreurs', value: allErrors.length },
        { label: 'Durée', value: formatDuration(Date.now() - startedAt) },
      ])
      setErrorRows(allErrors)
    }

    for (let i = 0; i < total; i++) {
      if (cancelBulkRef.current) {
        cumulativeLogs = [...cumulativeLogs, `[DONE] Annulé — ${i}/${total} sets traités`]
        setLogs(cumulativeLogs)
        break
      }

      const set = sets[i]
      const label = `${i + 1}/${total} ${set.name}`
      cumulativeLogs = [...cumulativeLogs, `[SET] [${label}] Import en cours...`]
      setLogs(cumulativeLogs)

      try {
        const res = await fetch('/api/import/onepiece', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ setId: set.id }),
        })
        const data = await parseImportResponse(res)
        const prefixedLogs = (data.logs ?? []).map((l) => `[${label}] ${l}`)
        cumulativeLogs = [...cumulativeLogs, ...prefixedLogs]

        if (data.ok && data.stats) {
          cardsImported += data.stats.cardsImported
          listingsCreated += data.stats.listingsCreated
          setsProcessed += 1
          if (data.stats.errors.length) allErrors.push(...data.stats.errors)
        } else {
          allErrors.push({ item: set.name, message: data.error ?? 'Échec import' })
          cumulativeLogs = [...cumulativeLogs, `[ERR] [${label}] ${data.error ?? 'Échec import'}`]

          // OPECards devenu injoignable en cours de passe — inutile de continuer
          if (res.status === 503) {
            cumulativeLogs = [...cumulativeLogs, '[ERR] OPECards injoignable — arrêt de la passe']
            setLogs(cumulativeLogs)
            pushStats()
            setLoading(null)
            return
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur réseau'
        allErrors.push({ item: set.name, message })
        cumulativeLogs = [...cumulativeLogs, `[ERR] [${label}] ${message}`]
      }

      setLogs(cumulativeLogs)
      pushStats()
    }

    if (!cancelBulkRef.current) {
      cumulativeLogs = [
        ...cumulativeLogs,
        `[DONE] ${setsProcessed}/${total} sets · ${cardsImported} cartes · ${allErrors.length} erreur(s) · ${formatDuration(Date.now() - startedAt)}`,
      ]
      setLogs(cumulativeLogs)
    }

    setLoading(null)
  }

  function handleCancelBulk() {
    cancelBulkRef.current = true
  }

  const disabled = apiUnavailable || !!loading

  return (
    <div style={{ maxWidth: '560px' }}>
      <div className="admin-header-row">
        <div>
          <div className="admin-title">Import One Piece</div>
          <div className="admin-sub">Sélectionne un set et importe les cartes depuis OPECards</div>
        </div>
      </div>

      {apiUnavailable && (
        <div className="admin-alert" style={{ marginBottom: '16px' }}>
          <div className="admin-alert-dot" />
          API OPECards indisponible (domaine mort) — import One Piece désactivé, alternatives à valider
        </div>
      )}

      <div style={{ background: 'var(--surface-1)', border: '1px solid rgba(212,144,12,0.08)', borderRadius: '3px', padding: '16px', marginBottom: '16px' }}>
        {/* Boutons bulk + sync */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            onClick={handleBulk}
            disabled={disabled || sets.length === 0}
            style={{
              fontSize: '10px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              color: disabled ? 'var(--muted)' : '#0C0A07',
              background: disabled ? 'rgba(212,144,12,0.3)' : 'var(--amber)',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '2px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
            }}
          >
            {loading === 'bulk' ? 'Import en cours...' : '↓ Tout importer (OPECards)'}
          </button>
          {loading === 'bulk' && (
            <button
              onClick={handleCancelBulk}
              style={{
                fontSize: '10px',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                color: '#F87171',
                background: 'transparent',
                border: '1px solid rgba(248,113,113,0.35)',
                padding: '8px 16px',
                borderRadius: '2px',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              ✕ Annuler
            </button>
          )}
          <button
            onClick={handleSync}
            disabled={disabled}
            style={{
              fontSize: '10px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              color: 'var(--amber)',
              background: 'transparent',
              border: '1px solid rgba(212,144,12,0.25)',
              padding: '8px 16px',
              borderRadius: '2px',
              cursor: disabled ? 'not-allowed' : 'pointer',
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
        ) : fetchError && sets.length === 0 ? (
          <div className="admin-alert"><div className="admin-alert-dot" />{fetchError}</div>
        ) : (
          <select
            value={selectedSet}
            onChange={(e) => setSelectedSet(e.target.value)}
            className="admin-input"
            disabled={disabled}
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
          disabled={!selectedSet || disabled}
          className="btn btn-primary btn-sm"
          style={{ marginTop: '12px', width: '100%' }}
        >
          {loading === 'single' ? 'Import en cours...' : "Lancer l'import"}
        </button>
      </div>

      <div className="admin-sep">Log d&apos;import <div className="admin-sep-line" /></div>
      <ImportLogPanel logs={logs} loading={loading !== null} stats={statRows} errors={errorRows} />
    </div>
  )
}
