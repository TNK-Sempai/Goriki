import Link from 'next/link'
import Navbar from '@/components/blocks/Navbar'
import Footer from '@/components/blocks/Footer'

export default function CataloguePage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-base">
        <div className="container-goriki py-12">
          <h1 className="font-display text-3xl text-cream mb-2">Catalogue</h1>
          <p className="text-muted mb-10">Choisissez votre univers TCG</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl">
            {[
              { href: '/catalogue/pokemon', label: 'Pokémon TCG', color: 'text-yellow-400' },
              { href: '/catalogue/onepiece', label: 'One Piece TCG', color: 'text-red-400' },
              { href: '/catalogue/scelles', label: 'Scellés & Accessoires', color: 'text-amber' },
            ].map(l => (
              <Link key={l.href} href={l.href} className={`card hover:border-goriki transition-all font-display text-xl ${l.color}`}>
                {l.label} →
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
