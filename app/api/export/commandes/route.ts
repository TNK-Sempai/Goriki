import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cs) { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, total, shipping_cost, store_credit_used, created_at, profiles(email, full_name), order_items(item_type, quantity, price_at_purchase, item_snapshot)')
    .order('created_at', { ascending: false })
    .limit(500)

  const rows = (orders ?? []).flatMap(o => {
    const profile = o.profiles as { email?: string; full_name?: string } | null
    return (o.order_items as { item_type: string; quantity: number; price_at_purchase: number; item_snapshot: { name?: string } | null }[]).map(item => ({
      order_id: o.id.slice(0, 8),
      date: new Date(o.created_at).toLocaleDateString('fr-FR'),
      status: o.status,
      client_email: profile?.email ?? '',
      client_nom: profile?.full_name ?? '',
      article: item.item_snapshot?.name ?? item.item_type,
      type: item.item_type,
      quantite: item.quantity,
      prix_unitaire: item.price_at_purchase.toFixed(2),
      sous_total: (item.price_at_purchase * item.quantity).toFixed(2),
      total_commande: o.total.toFixed(2),
      frais_livraison: (o.shipping_cost ?? 0).toFixed(2),
      credit_utilise: (o.store_credit_used ?? 0).toFixed(2),
    }))
  })

  const headers = [
    'order_id', 'date', 'status', 'client_email', 'client_nom',
    'article', 'type', 'quantite', 'prix_unitaire', 'sous_total',
    'total_commande', 'frais_livraison', 'credit_utilise',
  ]

  const csv = [
    headers.join(';'),
    ...rows.map(row => headers.map(h => `"${String(row[h as keyof typeof row]).replace(/"/g, '""')}"`).join(';')),
  ].join('\n')

  const date = new Date().toISOString().split('T')[0]

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="goriki-commandes-${date}.csv"`,
    },
  })
}
