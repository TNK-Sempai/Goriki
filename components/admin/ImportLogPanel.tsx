'use client'

import { useEffect, useRef } from 'react'

interface ImportLogPanelProps {
  logs: string[]
  loading: boolean
}

export default function ImportLogPanel({ logs, loading }: ImportLogPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="bg-surface-1 border border-dim rounded-lg p-4 font-mono text-xs h-64 overflow-y-auto">
      {logs.length === 0 && !loading && (
        <p className="text-muted">En attente de lancement...</p>
      )}
      {logs.map((log, i) => (
        <p
          key={i}
          className={
            log.startsWith('[ERREUR]') ? 'text-red-400' :
            log.startsWith('[DONE]')   ? 'text-green-400' :
            log.startsWith('[SKIP]')   ? 'text-yellow-400' :
            log.startsWith('[DB]')     ? 'text-amber' :
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
  )
}
