import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Navbar from '@/components/blocks/Navbar'
import Footer from '@/components/blocks/Footer'
import FilterPanel from '@/components/catalogue/FilterPanel'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import { Suspense } from 'react'

interface Props {
  params: Promise<{ set: string }>
  searchParams: Promise<Record<string, string>>
}

export default async function OnePieceSetPage({ params, searchParams }: Props) {
  const { set: setId } = await params
  const sp = await searchParams
  const supabase = await createClient()

  const { data: setData } = await supabase
    .from('onepiece_sets')
    .select('id, code, name_fr, card_count')
    .eq('id', setId)
    .single()

  if (!setData) notFound()

  const [{ data: rarities }, { data: variants }, { data: allSets }] = await Promise.all([
    supabase.from('onepiece_cards').select('rarity').eq('set_id', setId).not('rarity', 'is', null),
    supabase.from('onepiece_variant_types').select('code, label').or(`set_id.eq.${setId},set_id.is.null`),
    supabase.from('onepiece_sets').select('id, code, name_fr').eq('is_active', true).order('name_fr'),
  ])

  const uniqueRarities = [...new Set((rarities ?? []).map(r => r.rarity).filter(Boolean))] as string[]

  let query = supabase
    .from('onepiece_listings')
    .select(`
      id, price, quantity, condition, front_photo_url, image_api, needs_photo,
      onepiece_cards!inner(id, number, name_fr, rarity, card_type, set_id),
      onepiece_variant_types!inner(id, code, label)
    `)
    .eq('is_active', true)
    .gt('quantity', 0)
    .eq('onepiece_cards.set_id', setId)

  if (sp.rarity) query = query.eq('onepiece_cards.rarity', sp.rarity)
  if (sp.variant) query = query.eq('onepiece_variant_types.code', sp.variant)

  const { data: listings } = await query.order('onepiece_cards(number)').limit(96)

  const flatListings = (listings ?? []).map(l => ({
    ...l,
    onepiece_cards: Array.isArray(l.onepiece_cards) ? l.onepiece_cards[0] : l.onepiece_cards,
    onepiece_variant_types: Array.isArray(l.onepiece_variant_types) ? l.onepiece_variant_types[0] : l.onepiece_variant_types,
  }))

  return (
    <>
      <Navbar />
      <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
        <div style={{ padding: '24px 40px 0' }}>
          <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '6px', display: 'flex', gap: '6px' }}>
            <Link href="/catalogue/onepiece" style={{ color: 'var(--muted)', textDecoration: 'none' }}>One Piece</Link>
            <span>›</span>
            <span style={{ color: 'var(--cream)' }}>{setData.name_fr}</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--cream)', fontWeight: 600, marginBottom: '2px' }}>
            {setData.name_fr}
          </h1>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
            {flatListings.length} cartes disponibles
          </div>
        </div>

        <div style={{ display: 'flex', gap: 0, padding: '24px 40px 40px' }}>
          <Suspense>
            <FilterPanel rarities={uniqueRarities} variants={variants ?? []} sets={allSets ?? []} />
          </Suspense>

          <div style={{ flex: 1, paddingLeft: '28px', borderLeft: '1px solid var(--border)' }}>
            {flatListings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)', fontSize: '13px' }}>
                Aucune carte disponible pour ces filtres.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '8px' }}>
                {flatListings.map(listing => {
                  const card = listing.onepiece_cards as any
                  const variant = listing.onepiece_variant_types as any
                  const img = listing.front_photo_url ?? listing.image_api
                  return (
                    <Link key={listing.id} href={`/${listing.id}`} style={{ textDecoration: 'none' }}>
                      <div className="set-tile">
                        <div
                          style={{
                            aspectRatio: '2.5/3.5',
                            background: 'linear-gradient(160deg,#3D3060,#0A0810)',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {img && (
                            <img src={img} alt={card?.name_fr} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          )}
                        </div>
                        <div style={{ padding: '7px 9px' }}>
                          <div style={{ fontSize: '10px', color: 'var(--cream)', lineHeight: 1.25, marginBottom: '2px' }}>
                            {card?.name_fr}
                          </div>
                          <div style={{ fontSize: '9px', color: 'var(--muted)', marginBottom: '3px' }}>
                            #{card?.number} · {card?.rarity}
                            {variant?.label && ` · ${variant.label}`}
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
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
