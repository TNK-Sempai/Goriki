'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  pending:   { label: 'En attente',  class: 'ab-muted' },
  paid:      { label: 'Payée',       class: 'ab-amber' },
  preparing: { label: 'Préparation', class: 'ab-amber' },
  shipped:   { label: 'Expédiée',    class: 'ab-green' },
  delivered: { label: 'Livrée',      class: 'ab-green' },
  cancelled: { label: 'Annulée',     class: 'ab-red' },
  refunded:  { label: 'Remboursée',  class: 'ab-red' },
}

export default function CommandesPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/commandes').then(r => r.json()).then(data => {
      setOrders(Array.isArray(data) ? data : [])
      setLoading(false)
    })
  }, [])

  return (
    <div>
      <div className="admin-header-row">
        <div>
          <div className="admin-title">Commandes</div>
          <div className="admin-sub">{orders.length} au total</div>
        </div>
        <a href="/api/export/commandes" download className="btn btn-outline btn-sm">
          ↓ Export CSV
        </a>
      </div>

      {/* Filtres statut */}
      <div className="admin-filter-pills">
        {['Toutes', 'Payées', 'Expédiées', 'En attente', 'Annulées'].map(f => (
          <button
            key={f}
            className={`ab ${f === 'Toutes' ? 'ab-amber' : 'ab-muted'}`}
            style={{ padding: '4px 10px', cursor: 'pointer', fontSize: '9px' }}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="admin-table">
        <div className="admin-col-heads" style={{ display: 'grid', gridTemplateColumns: '90px 1fr 100px 100px 70px 60px' }}>
          <span className="admin-col-head">#</span>
          <span className="admin-col-head">Client</span>
          <span className="admin-col-head">Total</span>
          <span className="admin-col-head">Statut</span>
          <span className="admin-col-head">Date</span>
          <span className="admin-col-head"></span>
        </div>
        {loading ? (
          <div style={{ padding: '24px 14px', fontSize: '11px', color: 'var(--muted)' }}>Chargement…</div>
        ) : orders.length === 0 ? (
          <div style={{ padding: '24px 14px', fontSize: '11px', color: 'var(--muted)' }}>Aucune commande.</div>
        ) : orders.map((o: any) => {
          const st = STATUS_LABELS[o.status] ?? { label: o.status, class: 'ab-muted' }
          return (
            <Link
              key={o.id}
              href={`/admin/commandes/${o.id}`}
              className="admin-row"
              style={{ gridTemplateColumns: '90px 1fr 100px 100px 70px 60px' }}
            >
              <span className="admin-cell mono">{o.id.slice(0, 8)}</span>
              <span className="admin-cell">{o.profiles?.email ?? '—'}</span>
              <span className="admin-cell amber">{o.total?.toFixed(2)} €</span>
              <span className="admin-cell"><span className={`ab ${st.class}`}>{st.label}</span></span>
              <span className="admin-cell muted">{new Date(o.created_at).toLocaleDateString('fr-FR')}</span>
              <span className="admin-cell" style={{ color: 'rgba(212,144,12,0.5)', fontSize: '10px' }}>Voir →</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
