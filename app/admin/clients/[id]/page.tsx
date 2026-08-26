'use client'

import { useState, useEffect, use } from 'react'

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<any>(null)
  const [credit, setCredit] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/clients?id=${id}`).then(r => r.json()).then(d => {
      setData(d)
      setCredit(d.profile?.store_credit ?? 0)
    })
  }, [id])

  async function handleSaveCredit() {
    setSaving(true)
    await fetch('/api/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, store_credit: credit }),
    })
    setSaving(false)
  }

  if (!data) return <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Chargement...</div>

  const cardStyle: React.CSSProperties = { background: 'var(--surface-1)', border: '1px solid rgba(212,144,12,0.08)', borderRadius: '3px', padding: '16px', marginBottom: '16px' }

  return (
    <div className="gk-corps" style={{ maxWidth: '560px' }}>
      <div className="gk-entete-ecran">
        <div>
          <div className="gk-titre">{data.profile?.full_name ?? data.profile?.email}</div>
          <div className="gk-eyebrow-texte">{data.profile?.email}</div>
        </div>
      </div>

      <div style={cardStyle}>
        <div className="gk-sep" style={{ marginTop: 0 }}>Crédit boutique <div className="gk-sep-line" /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input type="number" min="0" step="0.01" value={credit}
            onChange={e => setCredit(parseFloat(e.target.value) || 0)} className="gk-input" style={{ width: '120px' }} />
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>€</span>
          <button onClick={handleSaveCredit} disabled={saving} className="gk-btn" data-primaire="true">
            {saving ? 'Sauvegarde...' : 'Mettre à jour'}
          </button>
        </div>
      </div>

      <div style={cardStyle}>
        <div className="gk-sep" style={{ marginTop: 0 }}>Commandes ({data.orders?.length ?? 0}) <div className="gk-sep-line" /></div>
        <div>
          {data.orders?.map((o: any) => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(212,144,12,0.04)' }}>
              <div>
                <div className="gk-cell mono">{o.id.slice(0, 8)}</div>
                <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{new Date(o.created_at).toLocaleDateString('fr-FR')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="gk-cell amber">{o.total?.toFixed(2)} €</div>
                <span className="ab ab-muted">{o.status}</span>
              </div>
            </div>
          ))}
          {(!data.orders || data.orders.length === 0) && (
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Aucune commande.</div>
          )}
        </div>
      </div>
    </div>
  )
}
