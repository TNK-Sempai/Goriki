import { headers } from 'next/headers'
import KPICard from '@/components/admin/KPICard'
import StatsCharts from '@/components/admin/StatsCharts'
import { formatPrice } from '@/lib/utils'

type Stats = {
  kpis: { totalOrders: number; totalRevenue: number; pkmListings: number; opListings: number; needsPhoto: number }
  monthlyRevenue: { label: string; total: number }[]
  statusCounts: Record<string, number>
  recentOrders: unknown[]
}

const EMPTY_STATS: Stats = {
  kpis: { totalOrders: 0, totalRevenue: 0, pkmListings: 0, opListings: 0, needsPhoto: 0 },
  monthlyRevenue: [],
  statusCounts: {},
  recentOrders: [],
}

const STATUS_LABELS: Record<string, string> = {
  pending:   'En attente',
  paid:      'Payée',
  preparing: 'Préparation',
  shipped:   'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
  refunded:  'Remboursée',
}

export default async function AdminStats() {
  const cookie = (await headers()).get('cookie') ?? ''

  let stats: Stats = EMPTY_STATS
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/stats`, {
      headers: { cookie },
      cache: 'no-store',
    })
    if (res.ok) stats = await res.json()
  } catch {
    // Fallback — stats vides
  }

  const { kpis, monthlyRevenue, statusCounts } = stats
  const totalStatus = Object.values(statusCounts).reduce((s, n) => s + n, 0)

  return (
    <div className="gk-corps">
      <div className="gk-entete-ecran">
        <div>
          <div className="gk-titre">Statistiques</div>
          <div className="gk-eyebrow-texte">Analyse détaillée de l&apos;activité Goriki</div>
        </div>
      </div>

      {/* KPIs */}
      <div className="gk-kpis">
        <KPICard label="Chiffre d'affaires" value={formatPrice(kpis.totalRevenue)} accent sub="commandes payées" />
        <KPICard label="Commandes" value={kpis.totalOrders} sub="au total" />
        <KPICard label="Pokémon en stock" value={kpis.pkmListings} sub="listings actifs" />
        <KPICard label="One Piece en stock" value={kpis.opListings} sub="listings actifs" />
      </div>

      {/* Graphiques */}
      <StatsCharts monthlyRevenue={monthlyRevenue} statusCounts={statusCounts} />

      {/* Détail par statut */}
      <div className="gk-sep" style={{ marginTop: '16px' }}>
        Répartition par statut <div className="gk-sep-line" />
      </div>

      {totalStatus === 0 ? (
        <div style={{ fontSize: '11px', color: 'var(--muted)', padding: '20px 0' }}>Aucune commande à analyser.</div>
      ) : (
        <div className="gk-panneau">
          <div className="gk-heads" style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px' }}>
            <span className="gk-label">Statut</span>
            <span className="gk-label">Part</span>
            <span className="gk-label">Nombre</span>
          </div>
          {Object.entries(statusCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([status, count]) => (
              <div key={status} className="gk-row" style={{ gridTemplateColumns: '1fr 80px 80px', cursor: 'default' }}>
                <span className="gk-cell">{STATUS_LABELS[status] ?? status}</span>
                <span className="gk-cell muted">{Math.round((count / totalStatus) * 100)} %</span>
                <span className="gk-cell amber">{count}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
