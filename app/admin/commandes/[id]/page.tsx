'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'

const STATUSES = ['pending','paid','preparing','shipped','delivered','cancelled','refunded']

export default function CommandeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [order, setOrder] = useState<any>(null)
  const [status, setStatus] = useState('')
  const [tracking, setTracking] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/commandes?id=${id}`).then(r => r.json()).then(data => {
      setOrder(data)
      setStatus(data.status)
      setTracking(data.tracking_number ?? '')
    })
  }, [id])

  async function handleSave() {
    setSaving(true)
    await fetch('/api/commandes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, tracking_number: tracking }),
    })
    setSaving(false)
    router.refresh()
  }

  if (!order) return <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Chargement...</div>

  const cardStyle: React.CSSProperties = { background: 'var(--surface-1)', border: '1px solid rgba(212,144,12,0.08)', borderRadius: '3px', padding: '16px', marginBottom: '16px' }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '8px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(238,228,204,0.25)', marginBottom: '5px' }

  return (
    <div style={{ maxWidth: '560px' }}>
      <div className="admin-header-row">
        <div>
          <div className="admin-title">Commande</div>
          <div className="admin-sub" style={{ fontFamily: 'monospace' }}>{order.id}</div>
        </div>
      </div>

      <div style={cardStyle}>
        <div className="admin-sep" style={{ marginTop: 0 }}>Client <div className="admin-sep-line" /></div>
        <div style={{ fontSize: '11px', color: 'rgba(238,228,204,0.7)' }}>{order.profiles?.email}</div>
        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{order.profiles?.full_name}</div>
        {order.shipping_address && (
          <pre style={{ fontSize: '9px', color: 'var(--muted)', marginTop: '10px', background: 'var(--bg)', borderRadius: '3px', padding: '10px', overflowX: 'auto' }}>
            {JSON.stringify(order.shipping_address, null, 2)}
          </pre>
        )}
      </div>

      <div style={cardStyle}>
        <div className="admin-sep" style={{ marginTop: 0 }}>Statut &amp; Suivi <div className="admin-sep-line" /></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Statut</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="admin-input">
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>N° de suivi</label>
            <input value={tracking} onChange={e => setTracking(e.target.value)} className="admin-input" placeholder="FR123456789" />
          </div>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>
            {saving ? 'Sauvegarde...' : 'Mettre à jour'}
          </button>
        </div>
      </div>

      <div style={cardStyle}>
        <div className="admin-sep" style={{ marginTop: 0 }}>Articles ({order.order_items?.length ?? 0}) <div className="admin-sep-line" /></div>
        <div>
          {order.order_items?.map((item: any) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(212,144,12,0.04)' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'rgba(238,228,204,0.7)' }}>{item.item_snapshot?.name ?? item.item_type}</div>
                <div style={{ fontSize: '10px', color: 'var(--muted)' }}>Qté : {item.quantity}</div>
              </div>
              <div className="admin-cell amber">{(item.price_at_purchase * item.quantity).toFixed(2)} €</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px', marginTop: '4px', borderTop: '1px solid rgba(212,144,12,0.08)' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Total</span>
          <span style={{ fontSize: '14px', color: 'var(--amber)', fontWeight: 500 }}>{order.total?.toFixed(2)} €</span>
        </div>
      </div>
    </div>
  )
}
