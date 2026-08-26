'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const STATUS_TONE: Record<string, string> = {
  pending: 'var(--amber)',
  verified: 'oklch(0.62 0.12 150)',
  rejected: '#ef4444',
}

export default function VerificationRow({
  userId, email, status, documentPath, submittedAt, reviewedAt, reason,
}: {
  userId: string
  email: string
  status: string
  documentPath: string | null
  submittedAt: string | null
  reviewedAt?: string | null
  reason?: string | null
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function open() {
    if (!documentPath) return
    setError(null)
    const res = await fetch(`/api/admin/verifications?path=${encodeURIComponent(documentPath)}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.url) { setError(data.error ?? 'Document illisible'); return }
    window.open(data.url, '_blank', 'noopener')
  }

  async function decide(decision: 'verified' | 'rejected') {
    setBusy(decision); setError(null)
    const res = await fetch('/api/admin/verifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, decision }),
    })
    setBusy(null)
    if (!res.ok) { setError('Action impossible'); return }
    setFeedback(decision === 'verified' ? 'Identité validée' : 'Demande refusée')
    router.refresh()
  }

  const stamp = reviewedAt ?? submittedAt

  return (
    <div style={{ borderBottom: '1px solid rgba(232,225,216,0.1)', padding: '14px 0', display: 'grid', gridTemplateColumns: '1fr 110px 130px 1fr', gap: '12px', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
        <span className="gk-cell">{email}</span>
        {reason && <span className="gk-cell muted">Motif : {reason}</span>}
      </div>

      <span className="gk-cell muted">
        {stamp ? new Date(stamp).toLocaleDateString('fr-FR') : '—'}
      </span>

      <span className="gk-cell mono" style={{ color: STATUS_TONE[status] }}>
        {status === 'pending' ? 'EN ATTENTE' : status === 'verified' ? 'VÉRIFIÉE' : 'REFUSÉE'}
      </span>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
        {feedback && <span className="gk-cell mono" style={{ color: 'oklch(0.62 0.12 150)' }}>{feedback}</span>}
        {error && <span className="gk-cell mono" style={{ color: '#ef4444' }}>{error}</span>}
        <button onClick={open} disabled={!documentPath} className="gk-btn">
          Document
        </button>
        {status === 'pending' && (
          <>
            <button onClick={() => decide('verified')} disabled={busy !== null} className="gk-btn" data-primaire="true">
              {busy === 'verified' ? '…' : 'Approuver'}
            </button>
            <button onClick={() => decide('rejected')} disabled={busy !== null} className="gk-btn">
              {busy === 'rejected' ? '…' : 'Rejeter'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
