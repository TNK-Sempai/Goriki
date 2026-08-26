'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { formatPrice } from '@/lib/utils'

export interface BuybackItem {
  description?: string
  quantity?: number
  estimate?: number | null
  photos?: string[]
}

const NEXT_LABEL: Record<string, string> = {
  pending: 'EN ÉTUDE',
  accepted: 'OFFRE ENVOYÉE',
  rejected: 'REFUSÉE',
  completed: 'RÉGLÉE',
}

export default function BuybackRow({
  id, email, status, offer, createdAt, item,
}: {
  id: string
  email: string | null
  status: string
  offer: number | null
  createdAt: string
  item: BuybackItem | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [price, setPrice] = useState(offer != null ? String(offer) : '')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function act(patch: Record<string, unknown>, tag: string) {
    setBusy(tag); setError(null)
    const res = await fetch('/api/admin/rachat', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    })
    setBusy(null)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Action impossible')
      return
    }
    router.refresh()
  }

  async function openPhoto(path: string) {
    const res = await fetch(`/api/admin/rachat?path=${encodeURIComponent(path)}`)
    const d = await res.json()
    if (d.url) window.open(d.url, '_blank', 'noopener')
  }

  return (
    <div style={{ borderBottom: '1px solid rgba(232,225,216,0.1)', padding: '14px 0' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: 'grid', gridTemplateColumns: '1fr 120px 110px 90px', gap: '12px', alignItems: 'center', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
      >
        <span className="gk-cell">{email ?? '—'}</span>
        <span className="gk-cell muted">{new Date(createdAt).toLocaleDateString('fr-FR')}</span>
        <span className="gk-cell">{item?.quantity ? `${item.quantity} cartes` : '—'}</span>
        <span className="gk-cell mono">{NEXT_LABEL[status] ?? status}</span>
      </button>

      {open && (
        <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {item?.description && (
            <p className="gk-cell muted" style={{ margin: 0, maxWidth: '70ch', lineHeight: 1.6 }}>
              {item.description}
            </p>
          )}

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <span className="gk-cell mono">
              ESTIMATION CLIENT : {item?.estimate != null ? formatPrice(item.estimate) : '—'}
            </span>
            <span className="gk-cell mono">PHOTOS : {item?.photos?.length ?? 0}</span>
          </div>

          {(item?.photos ?? []).length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(item!.photos ?? []).map((p, i) => (
                <button key={p} onClick={() => openPhoto(p)} className="gk-btn">
                  Photo {i + 1}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="Montant proposé"
              className="gk-input"
              style={{ width: '150px', padding: '8px 10px', fontSize: '12px' }}
            />
            <button onClick={() => act({ offer: price, status: 'accepted' }, 'offer')} disabled={busy !== null} className="gk-btn" data-primaire="true">
              {busy === 'offer' ? '…' : 'Proposer ce prix'}
            </button>
            <button onClick={() => act({ status: 'rejected' }, 'reject')} disabled={busy !== null} className="gk-btn">
              Refuser
            </button>
            <button onClick={() => act({ status: 'completed', paymentType: 'cash' }, 'paid')} disabled={busy !== null} className="gk-btn">
              Marquer réglée
            </button>
          </div>

          {error && <span className="gk-cell" style={{ color: '#ef4444' }}>{error}</span>}
        </div>
      )}
    </div>
  )
}
