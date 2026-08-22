import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'

interface Props { params: Promise<{ id: string }> }

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente', paid: 'Payée', preparing: 'En préparation',
  shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée', refunded: 'Remboursée',
}

export default async function CommandeDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: order } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!order) notFound()

  return (
    <>
      <main className="min-h-screen bg-base">
        <div className="container-goriki py-12 max-w-2xl">
          <div className="flex items-center gap-3 mb-8">
            <Link href="/compte/commandes" className="text-muted hover:text-amber transition-colors text-sm">← Commandes</Link>
          </div>

          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="font-display text-2xl text-cream mb-1">Commande</h1>
              <p className="text-muted font-mono text-xs">{order.id}</p>
              <p className="text-muted text-xs mt-1">
                {new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <span className="badge badge-amber">{STATUS_LABELS[order.status] ?? order.status}</span>
          </div>

          {/* Articles */}
          <div className="card mb-4">
            <h2 className="text-sm font-medium text-cream mb-4">Articles ({order.order_items?.length ?? 0})</h2>
            <div className="space-y-3">
              {order.order_items?.map((item: { id: string; item_snapshot: { name?: string } | null; item_type: string; quantity: number; price_at_purchase: number }) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-dim last:border-0">
                  <div>
                    <p className="text-cream text-sm">{item.item_snapshot?.name ?? item.item_type}</p>
                    <p className="text-muted text-xs">× {item.quantity}</p>
                  </div>
                  <p className="text-amber text-sm">{formatPrice(item.price_at_purchase * item.quantity)}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-4 mt-2 border-t border-dim">
              <p className="text-muted text-sm">Total</p>
              <p className="font-display text-xl text-amber">{formatPrice(order.total)}</p>
            </div>
          </div>

          {/* Suivi */}
          {order.tracking_number && (
            <div className="card mb-4">
              <h2 className="text-sm font-medium text-cream mb-2">Numéro de suivi</h2>
              <p className="text-amber font-mono text-sm">{order.tracking_number}</p>
            </div>
          )}

          {/* Adresse */}
          {order.shipping_address && (
            <div className="card">
              <h2 className="text-sm font-medium text-cream mb-2">Adresse de livraison</h2>
              <pre className="text-muted text-xs leading-relaxed whitespace-pre-wrap">
                {JSON.stringify(order.shipping_address, null, 2)}
              </pre>
            </div>
          )}

          {/* Bouton télécharger facture */}
          <div className="mt-6">
            <a
              href={`/api/invoice/${order.id}`}
              download
              className="btn btn-outline btn-sm inline-flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Télécharger la facture
            </a>
          </div>
        </div>
      </main>
    </>
  )
}
