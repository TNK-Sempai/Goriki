import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/blocks/Navbar'
import Footer from '@/components/blocks/Footer'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import { ShoppingBag, Heart, User, RefreshCw, Archive } from 'lucide-react'

export default async function ComptePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/compte')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, store_credit, created_at')
    .eq('id', user.id)
    .single()

  const { count: orderCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const { count: wishlistCount } = await supabase
    .from('wishlist_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const MENU = [
    { href: '/compte/commandes', label: 'Mes commandes', icon: ShoppingBag, value: `${orderCount ?? 0} commande${(orderCount ?? 0) > 1 ? 's' : ''}`, v2: false },
    { href: '/compte/wishlist',  label: 'Wishlist',       icon: Heart,       value: `${wishlistCount ?? 0} carte${(wishlistCount ?? 0) > 1 ? 's' : ''}`, v2: false },
    { href: '/compte/rachat',    label: 'Rachat',         icon: RefreshCw,   value: 'Bientôt disponible', v2: true },
    { href: '/compte/depot-vente', label: 'Dépôt-vente', icon: Archive,     value: 'Bientôt disponible', v2: true },
  ]

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-base">
        <div className="container-goriki py-12 max-w-3xl">
          {/* Header */}
          <div className="flex items-start justify-between mb-10">
            <div>
              <h1 className="font-display text-2xl text-cream mb-1">
                {profile?.full_name ?? profile?.email}
              </h1>
              <p className="text-muted text-sm">{profile?.email}</p>
              <p className="text-muted text-xs mt-1">
                Membre depuis {new Date(profile?.created_at ?? '').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            {(profile?.store_credit ?? 0) > 0 && (
              <div className="card text-right">
                <p className="text-muted text-xs mb-1">Crédit boutique</p>
                <p className="font-display text-xl text-amber">{formatPrice(profile?.store_credit ?? 0)}</p>
              </div>
            )}
          </div>

          {/* Menu */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {MENU.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`card flex items-center gap-4 transition-all ${item.v2 ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'hover:border-goriki'}`}
              >
                <div className={`p-2.5 rounded-lg ${item.v2 ? 'bg-surface-2' : 'bg-amber/10'}`}>
                  <item.icon size={18} className={item.v2 ? 'text-muted' : 'text-amber'} />
                </div>
                <div>
                  <p className="text-cream text-sm font-medium">{item.label}</p>
                  <p className="text-muted text-xs mt-0.5">{item.value}</p>
                </div>
                {item.v2 && <span className="ml-auto badge badge-muted text-[9px]">V2</span>}
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
