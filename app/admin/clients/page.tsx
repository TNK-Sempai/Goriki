'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(data => {
      setClients(Array.isArray(data) ? data : [])
      setLoading(false)
    })
  }, [])

  return (
    <div>
      <div className="admin-header-row">
        <div>
          <div className="admin-title">Clients</div>
          <div className="admin-sub">{clients.length} compte{clients.length > 1 ? 's' : ''}</div>
        </div>
      </div>

      <div className="admin-table">
        <div className="admin-col-heads" style={{ display: 'grid', gridTemplateColumns: '1fr 130px 80px 70px 70px 60px' }}>
          <span className="admin-col-head">Email</span>
          <span className="admin-col-head">Nom</span>
          <span className="admin-col-head">Crédit</span>
          <span className="admin-col-head">Rôle</span>
          <span className="admin-col-head">Inscrit</span>
          <span className="admin-col-head"></span>
        </div>
        {loading ? (
          <div style={{ padding: '24px 14px', fontSize: '11px', color: 'var(--muted)' }}>Chargement…</div>
        ) : clients.length === 0 ? (
          <div style={{ padding: '24px 14px', fontSize: '11px', color: 'var(--muted)' }}>Aucun client.</div>
        ) : clients.map((c: any) => (
          <Link
            key={c.id}
            href={`/admin/clients/${c.id}`}
            className="admin-row"
            style={{ gridTemplateColumns: '1fr 130px 80px 70px 70px 60px' }}
          >
            <span className="admin-cell">{c.email}</span>
            <span className="admin-cell">{c.full_name ?? '—'}</span>
            <span className="admin-cell muted">{c.store_credit?.toFixed(2)} €</span>
            <span className="admin-cell">
              <span className={`ab ${c.role === 'admin' ? 'ab-amber' : 'ab-muted'}`}>{c.role}</span>
            </span>
            <span className="admin-cell muted">{new Date(c.created_at).toLocaleDateString('fr-FR')}</span>
            <span className="admin-cell" style={{ color: 'rgba(212,144,12,0.5)', fontSize: '10px' }}>Voir →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
