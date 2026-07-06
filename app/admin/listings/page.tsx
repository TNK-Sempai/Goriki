import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ListingsPage() {
  const supabase = await createClient()

  const [{ count: pkmCount }, { count: opCount }] = await Promise.all([
    supabase.from('pokemon_listings').select('*', { count: 'exact', head: true }).gt('quantity', 0),
    supabase.from('onepiece_listings').select('*', { count: 'exact', head: true }).gt('quantity', 0),
  ])

  const [{ count: pkmPhoto }, { count: opPhoto }] = await Promise.all([
    supabase.from('pokemon_listings').select('*', { count: 'exact', head: true }).eq('needs_photo', true),
    supabase.from('onepiece_listings').select('*', { count: 'exact', head: true }).eq('needs_photo', true),
  ])

  const stats = [
    { label: 'Pokémon en stock', value: pkmCount ?? 0, photo: pkmPhoto ?? 0 },
    { label: 'One Piece en stock', value: opCount ?? 0, photo: opPhoto ?? 0 },
  ]

  return (
    <div>
      <div className="admin-header-row">
        <div>
          <div className="admin-title">Listings</div>
          <div className="admin-sub">Gérer les prix, quantités et visibilité</div>
        </div>
        <Link href="/admin/listings/masse" className="btn btn-primary btn-sm">
          Édition en masse
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', maxWidth: '440px' }}>
        {stats.map((stat) => (
          <div key={stat.label} className="admin-kpi">
            <span className="admin-kpi-label">{stat.label}</span>
            <span className="admin-kpi-val">{stat.value}</span>
            {stat.photo > 0 ? (
              <span className="admin-kpi-sub" style={{ color: '#f87171' }}>{stat.photo} photos manquantes</span>
            ) : (
              <span className="admin-kpi-sub">listings actifs</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
