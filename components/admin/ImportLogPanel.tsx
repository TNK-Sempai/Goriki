'use client'

import { useEffect, useRef } from 'react'

interface StatItem {
  label: string
  value: string | number
}

interface ErrorItem {
  item: string
  message: string
}

interface ImportLogPanelProps {
  logs: string[]
  loading: boolean
  stats?: StatItem[]
  errors?: ErrorItem[]
}

export default function ImportLogPanel({ logs, loading, stats, errors }: ImportLogPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div>
      {stats && stats.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {stats.map((s, i) => (
            <div
              key={i}
              className="gk-kpi" style={{ flex: 1, minWidth: 100 }}
            >
              <div className="gk-label">{s.label}</div>
              <div className="gk-kpi-val" style={{ fontSize: 18 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="gk-panneau" style={{ padding: 16, fontFamily: 'var(--font-dmmono), monospace', fontSize: 11.5, height: 256, overflowY: 'auto' }}>
        {logs.length === 0 && !loading && (
          <p style={{ color: 'var(--gk-muet)' }}>En attente de lancement...</p>
        )}
        {logs.map((log, i) => (
          <p
            key={i}
            /* Couleurs de journal : `text-amber` et `text-muted` étaient les
               jetons du site public, hors palette du back-office. Le sens des
               niveaux ne change pas, seule la teinte suit le thème sombre. */
            style={{
              color:
                log.startsWith('[ERREUR]') || log.startsWith('[ERR]') ? 'var(--gk-rouge)' :
                log.startsWith('[DONE]') || log.startsWith('[OK]') || log.startsWith('[NEW]') ? 'var(--gk-accent)' :
                log.startsWith('[SKIP]') ? 'var(--gk-violet)' :
                log.startsWith('[DB]') || log.startsWith('[SET]') || log.startsWith('[SYNC]') ? 'var(--gk-doux)' :
                'var(--gk-muet)',
            }}
          >
            {log}
          </p>
        ))}
        {loading && (
          <p className="animate-pulse-soft" style={{ color: 'var(--gk-accent)' }}>Traitement en cours...</p>
        )}
        <div ref={bottomRef} />
      </div>

      {errors && errors.length > 0 && (
        <div className="gk-panneau" style={{ marginTop: 12, maxHeight: 160, overflowY: 'auto', padding: 12 }}>
          <div className="gk-label" style={{ color: 'var(--gk-rouge)', marginBottom: 8 }}>
            Erreurs ({errors.length})
          </div>
          {errors.map((e, i) => (
            <p key={i} className="text-xs font-mono text-red-400 mb-1">
              {e.item} — {e.message}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
