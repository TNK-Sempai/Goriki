import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/blocks/Navbar'
import Footer from '@/components/blocks/Footer'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  pending:   { label: 'En attente',  class: 'badge-muted' },
  paid:      { label: 'Payée',       class: 'badge-amber' },
  preparing: { label: 'Préparation', class: 'badge-amber' },
  shipped:   { label: 'Expédiée',    class: 'badge-success' },
  delivered: { label: 'Livrée',      class: 'badge-success' },
  cancelled: { label: 'Annulée',     class: 'badge-danger' },
  refunded:  { label: 'Remboursée',  class: 'badge-danger' },
}

export default async function CommandesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/compte/commandes')

  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, total, created_at, shipping_cost')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-base">
        <div className="container-goriki py-12 max-w-3xl">
          <div className="flex items-center gap-3 mb-8">
            <Link href="/compte" className="text-muted hover:text-amber transition-colors text-sm">← Compte</Link>
            <span className="text-muted">/</span>
            <h1 className="font-display text-2xl text-cream">Mes commandes</h1>
          </div>

          {(!orders || orders.length === 0) ? (
            <div className="card text-center py-16">
              <p className="text-muted mb-4">Aucune commande pour l&apos;instant.</p>
              <Link href="/catalogue" className="btn btn-primary btn-sm">Voir le catalogue</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map(o => {
                const st = STATUS_LABELS[o.status] ?? { label: o.status, class: 'badge-muted' }
                return (
                  <Link
                    key={o.id}
                    href={`/compte/commandes/${o.id}`}
                    className="card flex items-center justify-between hover:border-goriki transition-all"
                  >
                    <div>
                      <p className="text-muted font-mono text-xs mb-1">{o.id.slice(0, 8)}…</p>
                      <p className="text-muted text-xs">{new Date(o.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`badge ${st.class}`}>{st.label}</span>
                      <p className="text-amber font-display text-lg">{formatPrice(o.total)}</p>
                      <span className="text-muted text-sm">→</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
