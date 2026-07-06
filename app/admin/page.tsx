import { createClient } from '@/lib/supabase/server'
import { formatPrice } from '@/lib/utils'
import Link from 'next/link'
import StatsCharts from '@/components/admin/StatsCharts'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const [
    { count: totalOrders },
    { data: revenueData },
    { count: pkmListings },
    { count: opListings },
    { count: needsPhoto },
    { data: recentOrders },
    { data: ordersByStatus },
  ] = await Promise.all([
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('total, created_at').eq('status', 'paid'),
    supabase.from('pokemon_listings').select('*', { count: 'exact', head: true }).gt('quantity', 0).eq('is_active', true),
    supabase.from('onepiece_listings').select('*', { count: 'exact', head: true }).gt('quantity', 0).eq('is_active', true),
    supabase.from('pokemon_listings').select('*', { count: 'exact', head: true }).eq('needs_photo', true),
    supabase.from('orders').select('id, total, status, created_at, profiles(email)').order('created_at', { ascending: false }).limit(5),
    supabase.from('orders').select('status'),
  ])

  const totalRevenue = revenueData?.reduce((sum, o) => sum + (o.total ?? 0), 0) ?? 0

  const now = new Date()
  const monthlyRevenue = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
    const total = revenueData?.filter(o => {
      const od = new Date(o.created_at)
      return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear()
    }).reduce((sum, o) => sum + (o.total ?? 0), 0) ?? 0
    return { label, total }
  })

  const statusCounts = (ordersByStatus ?? []).reduce((acc: Record<string, number>, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1
    return acc
  }, {})

  const STATUS_FR: Record<string, string> = {
    pending: 'En attente', paid: 'Payée', preparing: 'En préparation',
    shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée', refunded: 'Remboursée',
  }
  const STATUS_CLASS: Record<string, string> = {
    pending: 'ab ab-muted', paid: 'ab ab-amber', preparing: 'ab ab-amber',
    shipped: 'ab ab-green', delivered: 'ab ab-green',
    cancelled: 'ab ab-red', refunded: 'ab ab-red',
  }

  return (
    <div>
      {/* Header row */}
      <div className="admin-header-row">
        <div>
          <div className="admin-title">Dashboard</div>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--muted)' }}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Alert photos manquantes */}
      {(needsPhoto ?? 0) > 0 && (
        <div className="admin-alert">
          <div className="admin-alert-dot" />
          {needsPhoto} carte{(needsPhoto ?? 0) > 1 ? 's' : ''} avec photo manquante (prix ≥ 1€)
        </div>
      )}

      {/* KPIs */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi">
          <span className="admin-kpi-label">Chiffre d&apos;affaires</span>
          <span className="admin-kpi-val amber">{formatPrice(totalRevenue)}</span>
          <span className="admin-kpi-sub">commandes payées</span>
        </div>
        <div className="admin-kpi">
          <span className="admin-kpi-label">Commandes</span>
          <span className="admin-kpi-val">{totalOrders ?? 0}</span>
          <span className="admin-kpi-sub">au total</span>
        </div>
        <div className="admin-kpi">
          <span className="admin-kpi-label">Pokémon en stock</span>
          <span className="admin-kpi-val">{pkmListings ?? 0}</span>
          <span className="admin-kpi-sub">listings actifs</span>
        </div>
        <div className="admin-kpi">
          <span className="admin-kpi-label">One Piece en stock</span>
          <span className="admin-kpi-val">{opListings ?? 0}</span>
          <span className="admin-kpi-sub">listings actifs</span>
        </div>
      </div>

      {/* Charts */}
      <StatsCharts monthlyRevenue={monthlyRevenue} statusCounts={statusCounts} />

      {/* Commandes récentes */}
      <div className="admin-sep" style={{ marginTop: '16px' }}>
        Commandes récentes <div className="admin-sep-line" />
        <Link href="/admin/commandes" className="admin-table-action">Voir tout →</Link>
      </div>

      {(recentOrders ?? []).length === 0 ? (
        <div style={{ fontSize: '11px', color: 'var(--muted)', padding: '20px 0' }}>
          Aucune commande pour l&apos;instant.
        </div>
      ) : (
        <div className="admin-table">
          <div className="admin-col-heads" style={{ display: 'grid', gridTemplateColumns: '90px 1fr 100px 100px 70px' }}>
            <span className="admin-col-head">#</span>
            <span className="admin-col-head">Client</span>
            <span className="admin-col-head">Total</span>
            <span className="admin-col-head">Statut</span>
            <span className="admin-col-head">Date</span>
          </div>
          {(recentOrders ?? []).map((o: any) => (
            <Link
              key={o.id}
              href={`/admin/commandes/${o.id}`}
              className="admin-row"
              style={{ gridTemplateColumns: '90px 1fr 100px 100px 70px' }}
            >
              <span className="admin-cell mono">{o.id.slice(0, 8)}</span>
              <span className="admin-cell">{o.profiles?.email ?? '—'}</span>
              <span className="admin-cell amber">{formatPrice(o.total)}</span>
              <span className="admin-cell">
                <span className={STATUS_CLASS[o.status] ?? 'ab ab-muted'}>
                  {STATUS_FR[o.status] ?? o.status}
                </span>
              </span>
              <span className="admin-cell muted">
                {new Date(o.created_at).toLocaleDateString('fr-FR')}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
