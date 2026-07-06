import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/blocks/Navbar'
import Footer from '@/components/blocks/Footer'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'

export default async function CatalogueScelles() {
  const supabase = await createClient()
  const { data: products } = await supabase
    .from('sealed_products')
    .select('*')
    .eq('is_active', true)
    .gt('quantity', 0)
    .order('tcg_type')

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-base">
        <div className="container-goriki py-12">
          <h1 className="font-display text-3xl text-cream mb-2">Scellés & Accessoires</h1>
          <p className="text-muted mb-10">{products?.length ?? 0} produits disponibles</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {(products ?? []).map(p => (
              <Link key={p.id} href={`/${p.id}`} className="card hover:border-goriki transition-all group">
                {p.image_url && (
                  <img src={p.image_url} alt={p.name} className="h-32 object-contain mx-auto mb-3" loading="lazy" />
                )}
                <span className="badge badge-muted text-[9px] mb-2">{p.type} · {p.tcg_type}</span>
                <p className="text-cream text-sm font-medium">{p.name}</p>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-amber font-display text-lg">{formatPrice(p.price)}</p>
                  <p className="text-muted text-xs">×{p.quantity}</p>
                </div>
              </Link>
            ))}
            {(!products || products.length === 0) && (
              <p className="text-muted text-sm col-span-full text-center py-10">
                Aucun produit disponible pour l&apos;instant.
              </p>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
