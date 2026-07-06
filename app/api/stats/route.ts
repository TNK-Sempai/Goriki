import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cs) { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

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
    supabase.from('orders').select('total, created_at').eq('status', 'paid').order('created_at'),
    supabase.from('pokemon_listings').select('*', { count: 'exact', head: true }).gt('quantity', 0).eq('is_active', true),
    supabase.from('onepiece_listings').select('*', { count: 'exact', head: true }).gt('quantity', 0).eq('is_active', true),
    supabase.from('pokemon_listings').select('*', { count: 'exact', head: true }).eq('needs_photo', true),
    supabase.from('orders').select('id, total, status, created_at, profiles(email)').order('created_at', { ascending: false }).limit(5),
    supabase.from('orders').select('status'),
  ])

  // Calcul CA total
  const totalRevenue = revenueData?.reduce((sum, o) => sum + (o.total ?? 0), 0) ?? 0

  // CA par mois (6 derniers mois)
  const now = new Date()
  const monthlyRevenue = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
    const total = revenueData
      ?.filter(o => {
        const od = new Date(o.created_at)
        return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear()
      })
      .reduce((sum, o) => sum + (o.total ?? 0), 0) ?? 0
    return { label, total }
  })

  // Commandes par statut
  const statusCounts = (ordersByStatus ?? []).reduce((acc: Record<string, number>, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1
    return acc
  }, {})

  return NextResponse.json({
    kpis: {
      totalOrders: totalOrders ?? 0,
      totalRevenue,
      pkmListings: pkmListings ?? 0,
      opListings: opListings ?? 0,
      needsPhoto: needsPhoto ?? 0,
    },
    monthlyRevenue,
    statusCounts,
    recentOrders: recentOrders ?? [],
  })
}
