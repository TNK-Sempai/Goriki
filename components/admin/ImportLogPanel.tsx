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
              className="bg-surface-1 border border-dim rounded-lg px-3 py-2 flex-1 min-w-[100px]"
            >
              <div className="text-[8px] tracking-widest uppercase text-muted">{s.label}</div>
              <div className="text-sm font-mono text-cream">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-surface-1 border border-dim rounded-lg p-4 font-mono text-xs h-64 overflow-y-auto">
        {logs.length === 0 && !loading && (
          <p className="text-muted">En attente de lancement...</p>
        )}
        {logs.map((log, i) => (
          <p
            key={i}
            className={
              log.startsWith('[ERREUR]') || log.startsWith('[ERR]') ? 'text-red-400' :
              log.startsWith('[DONE]') || log.startsWith('[OK]') || log.startsWith('[NEW]') ? 'text-green-400' :
              log.startsWith('[SKIP]')   ? 'text-yellow-400' :
              log.startsWith('[DB]') || log.startsWith('[SET]') || log.startsWith('[SYNC]') ? 'text-amber' :
              log.startsWith('[START]') ? 'text-muted' :
              'text-muted'
            }
          >
            {log}
          </p>
        ))}
        {loading && (
          <p className="text-amber animate-pulse-soft">Traitement en cours...</p>
        )}
        <div ref={bottomRef} />
      </div>

      {errors && errors.length > 0 && (
        <div className="mt-3 max-h-40 overflow-y-auto border border-dim rounded-lg bg-surface-1 p-3">
          <div className="text-[8px] tracking-widest uppercase text-red-400 mb-2">
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
