import Navbar from '@/components/blocks/Navbar'
import Footer from '@/components/blocks/Footer'
import HeroCarousel from '@/components/blocks/HeroCarousel'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'

export default async function HomePage() {
  const supabase = await createClient()

  const [{ data: pkmSets }, { data: opSets }, { data: recentPkm }, { data: recentOp }] =
    await Promise.all([
      supabase.from('pokemon_sets').select('id, code, name_fr, image_url').eq('is_active', true).order('release_date', { ascending: false }).limit(6),
      supabase.from('onepiece_sets').select('id, code, name_fr, image_url').eq('is_active', true).order('release_date', { ascending: false }).limit(6),
      supabase.from('pokemon_listings').select(`
        id, price, image_api, front_photo_url,
        pokemon_cards!inner(name_fr, number, rarity, set_id,
          pokemon_sets!inner(code, name_fr))
      `).eq('is_active', true).gt('quantity', 0).gt('price', 0).order('price', { ascending: false }).limit(6),
      supabase.from('onepiece_listings').select(`
        id, price, image_api, front_photo_url,
        onepiece_cards!inner(name_fr, number, rarity, set_id,
          onepiece_sets!inner(code, name_fr))
      `).eq('is_active', true).gt('quantity', 0).gt('price', 0).order('price', { ascending: false }).limit(6),
    ])

  const carouselSets = [
    ...(pkmSets ?? []).slice(0, 3).map(s => ({ ...s, tcg: 'pokemon' as const })),
    ...(opSets ?? []).slice(0, 3).map(s => ({ ...s, tcg: 'onepiece' as const })),
  ]

  return (
    <>
      <Navbar />
      <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>

        {/* HERO CAROUSEL */}
        <HeroCarousel sets={carouselSets} />

        {/* TICKER */}
        <div className="ticker-wrap">
          <div className="ticker-track">
            {[...Array(2)].map((_, repeat) => (
              <span key={repeat} style={{ display: 'contents' }}>
                {(opSets ?? []).map(s => (
                  <span key={`${repeat}-op-${s.id}`} className="ticker-item">
                    <strong>One Piece</strong> {s.name_fr} · {s.code}
                  </span>
                ))}
                {(pkmSets ?? []).map(s => (
                  <span key={`${repeat}-pkm-${s.id}`} className="ticker-item">
                    <strong>Pokémon</strong> {s.name_fr} · {s.code}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>

        {/* POKÉMON RÉCENTS */}
        {(recentPkm ?? []).length > 0 && (
          <section style={{ padding: '48px 40px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '14px', height: '1px', background: 'var(--amber)' }} />
                <span style={{ fontSize: '9px', letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--amber)' }}>
                  Pokémon · Singles
                </span>
              </div>
              <Link
                href="/catalogue/pokemon"
                style={{ fontSize: '10px', color: 'var(--muted)', textDecoration: 'none', letterSpacing: '1px' }}
              >
                Voir tout →
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '8px' }}>
              {(recentPkm ?? []).map((listing: any) => {
                const card = Array.isArray(listing.pokemon_cards) ? listing.pokemon_cards[0] : listing.pokemon_cards
                const set = Array.isArray(card?.pokemon_sets) ? card?.pokemon_sets[0] : card?.pokemon_sets
                const img = listing.front_photo_url ?? listing.image_api
                return (
                  <Link key={listing.id} href={`/${listing.id}`} style={{ textDecoration: 'none' }}>
                    <div className="set-tile">
                      <div
                        style={{
                          aspectRatio: '2.5/3.5',
                          background: 'linear-gradient(160deg,#583C18,#100804)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        {img && (
                          <img src={img} alt={card?.name_fr} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                      </div>
                      <div style={{ padding: '8px 10px' }}>
                        <div style={{ fontSize: '10px', color: 'var(--cream)', fontWeight: 400, lineHeight: 1.25, marginBottom: '2px' }}>
                          {card?.name_fr}
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--muted)', marginBottom: '3px' }}>
                          {set?.code} · {card?.rarity}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--amber)', fontWeight: 500 }}>
                          {formatPrice(listing.price)}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* ONE PIECE RÉCENTS */}
        {(recentOp ?? []).length > 0 && (
          <section style={{ padding: '36px 40px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '14px', height: '1px', background: 'var(--amber)' }} />
                <span style={{ fontSize: '9px', letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--amber)' }}>
                  One Piece · Singles
                </span>
              </div>
              <Link
                href="/catalogue/onepiece"
                style={{ fontSize: '10px', color: 'var(--muted)', textDecoration: 'none', letterSpacing: '1px' }}
              >
                Voir tout →
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '8px' }}>
              {(recentOp ?? []).map((listing: any) => {
                const card = Array.isArray(listing.onepiece_cards) ? listing.onepiece_cards[0] : listing.onepiece_cards
                const set = Array.isArray(card?.onepiece_sets) ? card?.onepiece_sets[0] : card?.onepiece_sets
                const img = listing.front_photo_url ?? listing.image_api
                return (
                  <Link key={listing.id} href={`/${listing.id}`} style={{ textDecoration: 'none' }}>
                    <div className="set-tile">
                      <div
                        style={{
                          aspectRatio: '2.5/3.5',
                          background: 'linear-gradient(160deg,#3D3060,#0A0810)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        {img && (
                          <img src={img} alt={card?.name_fr} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                      </div>
                      <div style={{ padding: '8px 10px' }}>
                        <div style={{ fontSize: '10px', color: 'var(--cream)', fontWeight: 400, lineHeight: 1.25, marginBottom: '2px' }}>
                          {card?.name_fr}
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--muted)', marginBottom: '3px' }}>
                          {set?.code} · {card?.rarity}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--amber)', fontWeight: 500 }}>
                          {formatPrice(listing.price)}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        <div style={{ height: '48px' }} />
      </main>
      <Footer />
    </>
  )
}
