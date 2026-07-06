import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Navbar from '@/components/blocks/Navbar'
import Footer from '@/components/blocks/Footer'
import CardFlip from '@/components/product/CardFlip'
import WishlistButton from '@/components/product/WishlistButton'
import AddToCartButton from '@/components/product/AddToCartButton'
import SameSetGrid from '@/components/product/SameSetGrid'
import { formatPrice } from '@/lib/utils'
import Link from 'next/link'
import type { Metadata } from 'next'

interface Props { params: Promise<{ slug: string }> }

async function getListing(slug: string) {
  const supabase = await createClient()

  // Chercher dans pokemon_listings
  const { data: pkm } = await supabase
    .from('pokemon_listings')
    .select(`
      id, price, quantity, condition, front_photo_url, back_photo_url, image_api, needs_photo,
      pokemon_cards!inner(id, number, name_fr, rarity, card_type, attribute, category, set_id,
        pokemon_sets!inner(id, code, name_fr)),
      pokemon_variant_types!inner(id, code, label)
    `)
    .eq('id', slug)
    .single()

  if (pkm) return { listing: pkm, tcg: 'pokemon' as const }

  // Chercher dans onepiece_listings
  const { data: op } = await supabase
    .from('onepiece_listings')
    .select(`
      id, price, quantity, condition, front_photo_url, back_photo_url, image_api, needs_photo,
      onepiece_cards!inner(id, number, name_fr, rarity, card_type, color, set_id,
        onepiece_sets!inner(id, code, name_fr)),
      onepiece_variant_types!inner(id, code, label)
    `)
    .eq('id', slug)
    .single()

  if (op) return { listing: op, tcg: 'onepiece' as const }

  // Chercher dans sealed_products
  const { data: sealed } = await supabase
    .from('sealed_products')
    .select('*')
    .eq('id', slug)
    .single()

  if (sealed) return { listing: sealed, tcg: 'sealed' as const }

  return null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const result = await getListing(slug)
  if (!result) return { title: 'Produit introuvable' }

  const { listing, tcg } = result
  let name = ''
  if (tcg === 'pokemon') name = (listing as any).pokemon_cards?.name_fr
  else if (tcg === 'onepiece') name = (listing as any).onepiece_cards?.name_fr
  else name = (listing as any).name

  return { title: name, description: `${name} — disponible sur Goriki` }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const result = await getListing(slug)
  if (!result) notFound()

  const { listing, tcg } = result as any
  const supabase = await createClient()

  const card = listing.pokemon_cards ?? listing.onepiece_cards
  const variant = listing.pokemon_variant_types ?? listing.onepiece_variant_types
  const set = card?.pokemon_sets ?? card?.onepiece_sets
  const name = card?.name_fr ?? listing.name
  const frontUrl = listing.front_photo_url ?? listing.image_api ?? null
  const backUrl = listing.back_photo_url ?? null
  const cartImageUrl = frontUrl && tcg !== 'sealed' && !frontUrl.match(/\.(png|jpg|webp|svg)$/)
    ? frontUrl + '/high.webp'
    : frontUrl

  // Cartes du même set
  let sameSet: any[] = []
  if (tcg === 'pokemon' && card?.set_id) {
    const { data } = await supabase
      .from('pokemon_listings')
      .select('id, price, image_api, front_photo_url, pokemon_cards!inner(name_fr, number, set_id), pokemon_variant_types!inner(label)')
      .eq('is_active', true).gt('quantity', 0)
      .eq('pokemon_cards.set_id', card.set_id)
      .neq('id', listing.id)
      .limit(12)
    sameSet = data ?? []
  } else if (tcg === 'onepiece' && card?.set_id) {
    const { data } = await supabase
      .from('onepiece_listings')
      .select('id, price, image_api, front_photo_url, onepiece_cards!inner(name_fr, number, set_id), onepiece_variant_types!inner(label)')
      .eq('is_active', true).gt('quantity', 0)
      .eq('onepiece_cards.set_id', card.set_id)
      .neq('id', listing.id)
      .limit(12)
    sameSet = data ?? []
  }

  return (
    <>
      <Navbar />
      <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
        <div style={{ padding: '24px 40px 0', marginBottom: '24px' }}>
          {set && (
            <div style={{ fontSize: '10px', color: 'var(--muted)', display: 'flex', gap: '6px', alignItems: 'center' }}>
              <Link href={`/catalogue/${tcg}`} style={{ color: 'var(--muted)', textDecoration: 'none', textTransform: 'capitalize' }}>
                {tcg}
              </Link>
              <span>›</span>
              <Link href={`/catalogue/${tcg}/${card?.set_id}`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>
                {set.name_fr}
              </Link>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '40px', padding: '0 40px 40px' }}>
          {/* Visuel */}
          <div style={{ flexShrink: 0 }}>
            <CardFlip frontUrl={frontUrl} backUrl={backUrl} altText={name} />
          </div>

          {/* Infos */}
          <div style={{ flex: 1 }}>
            {set && (
              <div style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--amber)', marginBottom: '6px' }}>
                {tcg === 'pokemon' ? 'Pokémon' : 'One Piece'} · {set.code} · #{card?.number}
              </div>
            )}
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '26px',
                color: 'var(--cream)',
                fontWeight: 600,
                lineHeight: 1.15,
                marginBottom: '14px',
              }}
            >
              {name}
            </h1>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
              {card?.rarity && (
                <span style={{ fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)', background: 'var(--surface-1)', padding: '3px 8px', borderRadius: '2px' }}>
                  {card.rarity}
                </span>
              )}
              {variant && (
                <span style={{ fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)', background: 'var(--surface-1)', padding: '3px 8px', borderRadius: '2px' }}>
                  {variant.label}
                </span>
              )}
              {listing.condition && (
                <span style={{ fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)', background: 'var(--surface-1)', padding: '3px 8px', borderRadius: '2px' }}>
                  {listing.condition}
                </span>
              )}
              {listing.front_photo_url && (
                <span style={{ fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--amber)', background: 'rgba(200,134,10,0.08)', padding: '3px 8px', borderRadius: '2px', border: '1px solid rgba(200,134,10,0.2)' }}>
                  Photo réelle
                </span>
              )}
            </div>

            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '32px',
                color: 'var(--amber)',
                fontWeight: 700,
                marginBottom: '6px',
              }}
            >
              {formatPrice(listing.price)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '24px' }}>
              {listing.quantity} disponible{listing.quantity > 1 ? 's' : ''}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '28px' }}>
              <AddToCartButton
                listingId={listing.id}
                tcg={tcg}
                name={name}
                variantLabel={variant?.label}
                price={listing.price}
                maxQuantity={listing.quantity}
                imageUrl={cartImageUrl}
              />
              {tcg !== 'sealed' && (
                <WishlistButton itemType={tcg} itemId={listing.id} variantTypeId={variant?.id ?? null} />
              )}
            </div>

            {/* Détails */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              {[
                card?.card_type && { k: 'Type', v: card.card_type },
                card?.attribute && { k: 'Attribut', v: card.attribute },
                card?.color && { k: 'Couleur', v: card.color },
                card?.category && { k: 'Catégorie', v: card.category },
              ].filter(Boolean).map((row: any) => (
                <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-dim)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{row.k}</span>
                  <span style={{ fontSize: '10px', color: 'var(--cream)', fontWeight: 500 }}>{row.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Du même set */}
        <SameSetGrid listings={sameSet} />
      </main>
      <Footer />
    </>
  )
}
