import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/blocks/Navbar'
import Footer from '@/components/blocks/Footer'
import Link from 'next/link'
import PokemonCatalogueClient from '@/components/catalogue/PokemonCatalogueClient'

export default async function CataloguePokemonPage() {
  const supabase = await createClient()
  const { data: sets } = await supabase
    .from('pokemon_sets')
    .select('id, code, name_fr, image_url, symbol_url, card_count, release_date')
    .eq('is_active', true)
    .order('release_date', { ascending: false })

  return (
    <>
      <Navbar />
      <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>

        {/* TCG Switch */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {[
            { href: '/catalogue/pokemon', label: 'Pokémon', active: true },
            { href: '/catalogue/onepiece', label: 'One Piece', active: false },
            { href: '/catalogue/scelles', label: 'Scellés', active: false },
          ].map(tab => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`tcg-tab${tab.active ? ' active' : ''}`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div style={{ padding: '28px 40px 0' }}>
          <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '6px' }}>Catalogue</div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '22px',
              color: 'var(--cream)',
              fontWeight: 600,
              marginBottom: '2px',
            }}
          >
            Pokémon TCG
          </h1>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{(sets ?? []).length} sets disponibles</div>
        </div>

        <PokemonCatalogueClient sets={sets ?? []} />
      </main>
      <Footer />
    </>
  )
}
