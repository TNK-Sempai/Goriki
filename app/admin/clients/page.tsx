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
    <div className="gk-corps">
      <div className="gk-entete-ecran">
        <div>
          <div className="gk-titre">Clients</div>
          <div className="gk-eyebrow-texte">{clients.length} compte{clients.length > 1 ? 's' : ''}</div>
        </div>
      </div>

      <div className="gk-panneau">
        <div className="gk-heads" style={{ display: 'grid', gridTemplateColumns: '1fr 130px 80px 70px 70px 60px' }}>
          <span className="gk-label">Email</span>
          <span className="gk-label">Nom</span>
          <span className="gk-label">Crédit</span>
          <span className="gk-label">Rôle</span>
          <span className="gk-label">Inscrit</span>
          <span className="gk-label"></span>
        </div>
        {loading ? (
          <div style={{ padding: '24px 14px', fontSize: '11px', color: 'var(--muted)' }}>Chargement…</div>
        ) : clients.length === 0 ? (
          <div style={{ padding: '24px 14px', fontSize: '11px', color: 'var(--muted)' }}>Aucun client.</div>
        ) : clients.map((c: any) => (
          <Link
            key={c.id}
            href={`/admin/clients/${c.id}`}
            className="gk-row"
            style={{ gridTemplateColumns: '1fr 130px 80px 70px 70px 60px' }}
          >
            <span className="gk-cell">{c.email}</span>
            <span className="gk-cell">{c.full_name ?? '—'}</span>
            <span className="gk-cell muted">{c.store_credit?.toFixed(2)} €</span>
            <span className="gk-cell">
              <span className={`ab ${c.role === 'admin' ? 'ab-amber' : 'ab-muted'}`}>{c.role}</span>
            </span>
            <span className="gk-cell muted">{new Date(c.created_at).toLocaleDateString('fr-FR')}</span>
            <span className="gk-cell" style={{ color: 'rgba(212,144,12,0.5)', fontSize: '10px' }}>Voir →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
