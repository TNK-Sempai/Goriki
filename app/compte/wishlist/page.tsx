import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import { Heart } from 'lucide-react'

export default async function WishlistPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/compte/wishlist')

  const { data: items } = await supabase
    .from('wishlist_items')
    .select('id, item_type, item_id, variant_type_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Enrichir avec les données des listings
  const enriched = await Promise.all((items ?? []).map(async (item) => {
    if (item.item_type === 'pokemon') {
      const { data } = await supabase
        .from('pokemon_listings')
        .select('id, price, quantity, image_api, front_photo_url, pokemon_cards(name_fr, number), pokemon_variant_types(label)')
        .eq('id', item.item_id)
        .single()
      return { ...item, listing: data }
    }
    if (item.item_type === 'onepiece') {
      const { data } = await supabase
        .from('onepiece_listings')
        .select('id, price, quantity, image_api, front_photo_url, onepiece_cards(name_fr, number), onepiece_variant_types(label)')
        .eq('id', item.item_id)
        .single()
      return { ...item, listing: data }
    }
    if (item.item_type === 'sealed') {
      const { data } = await supabase
        .from('sealed_products')
        .select('id, price, quantity, image_url, name')
        .eq('id', item.item_id)
        .single()
      return { ...item, listing: data }
    }
    return { ...item, listing: null }
  }))

  return (
    <>
      <main className="min-h-screen bg-base">
        <div className="container-goriki py-12 max-w-3xl">
          <div className="flex items-center gap-3 mb-8">
            <Link href="/compte" className="text-muted hover:text-amber transition-colors text-sm">← Compte</Link>
            <span className="text-muted">/</span>
            <h1 className="font-display text-2xl text-cream">Wishlist</h1>
          </div>

          {enriched.length === 0 ? (
            <div className="card text-center py-16">
              <Heart size={36} className="text-muted mx-auto mb-4" />
              <p className="text-muted mb-4">Votre wishlist est vide.</p>
              <Link href="/catalogue" className="btn btn-primary btn-sm">Voir le catalogue</Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {enriched.map((item) => {
                const l = item.listing as Record<string, unknown> | null
                if (!l) return null
                const name = (l.pokemon_cards as { name_fr?: string } | null)?.name_fr
                  ?? (l.onepiece_cards as { name_fr?: string } | null)?.name_fr
                  ?? (l.name as string | undefined)
                  ?? '—'
                const img = (l.front_photo_url as string | null)
                  ?? (l.image_api as string | null)
                  ?? (l.image_url as string | null)
                const variant = (l.pokemon_variant_types as { label?: string } | null)?.label
                  ?? (l.onepiece_variant_types as { label?: string } | null)?.label

                return (
                  <Link key={item.id} href={`/${item.item_id}`} className="card hover:border-goriki transition-all group">
                    {img && (
                      <img src={img} alt={name} className="w-full aspect-[2.5/3.5] object-cover rounded mb-2" loading="lazy" />
                    )}
                    <p className="text-cream text-xs font-medium line-clamp-2">{name}</p>
                    {variant && <p className="text-muted text-[10px] mt-0.5">{variant}</p>}
                    <p className="text-amber text-sm mt-2">{formatPrice(l.price as number)}</p>
                    {(l.quantity as number) === 0 && (
                      <span className="badge badge-danger text-[9px] mt-1">Épuisé</span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
