import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import PageContainer from '@/components/layout/PageContainer'
import CardViewer from '@/components/product/CardViewer'
import ScanStage from '@/components/product/ScanStage'
import InspectionPanel from '@/components/product/InspectionPanel'
import WishlistButton from '@/components/product/WishlistButton'
import JeLaChercheButton from '@/components/product/JeLaChercheButton'
import AddToCartButton from '@/components/product/AddToCartButton'
import SameSetGrid from '@/components/product/SameSetGrid'
import { PHOTO_PRICE_THRESHOLD } from '@/lib/constants'
import { formatPrice } from '@/lib/utils'

/**
 * Fiche carte — case 4 de la planche de référence.
 *
 * Cette page n'avait JAMAIS été portée : elle rendait encore des styles inline
 * et le vocabulaire sombre d'origine (`var(--cream)`, `var(--font-display)` en
 * dur, `var(--surface-1)`), au milieu d'un site clair.
 *
 * Composition de la planche : fil d'ariane, puis deux colonnes —
 *   · à gauche, bande de vignettes verticale + scan en grand + contrôles ;
 *   · à droite, nom, référence et rareté, état, PRIX en grand, disponibilité,
 *     « Ajouter au panier » pleine largeur, « Want to Buy », puis le panneau
 *     INSPECTION ;
 * enfin, la rangée « du même set ».
 *
 * Divergences de données assumées :
 *   · La planche montre un basculement Recto/Verso. `back_photo_url` est NULL
 *     sur la totalité des listings : la bande n'affiche que les scans qui
 *     existent réellement, et `CardViewer` (manipulation 3D) n'est monté que si
 *     un vrai verso est présent — règle photo du CLAUDE.md.
 *   · La planche affiche une variation de cote (« +12,4 % »). Aucun historique
 *     de prix n'existe en base.
 *   · La planche coche un relevé d'inspection (Surface/Coins/Bords/Centrage).
 *     Aucune colonne d'inspection n'existe : `InspectionPanel` se retire de
 *     lui-même, et l'origine réelle du visuel est indiquée à la place.
 */

interface Props { params: Promise<{ slug: string }> }

interface CardLike {
  id: string
  number: string
  name_fr: string
  rarity: string | null
  card_type?: string | null
  attribute?: string | null
  category?: string | null
  color?: string | null
  set_id: string
  pokemon_sets?: { id: string; code: string; name_fr: string }
  onepiece_sets?: { id: string; code: string; name_fr: string }
}

interface ListingLike {
  id: string
  price: number
  quantity: number
  condition: string | null
  front_photo_url: string | null
  back_photo_url: string | null
  image_api: string | null
  /** Colonne des produits SCELLÉS — ils n'ont ni `front_photo_url` ni `image_api`. */
  image_url?: string | null
  /** Galerie des produits scellés (migration 0030). `image_url` en est le premier élément. */
  image_urls?: string[] | null
  name?: string
  pokemon_cards?: CardLike
  onepiece_cards?: CardLike
  pokemon_variant_types?: { id: string; code: string; label: string }
  onepiece_variant_types?: { id: string; code: string; label: string }
}

async function getListing(slug: string) {
  const supabase = await createClient()

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

  if (pkm) return { listing: pkm as unknown as ListingLike, tcg: 'pokemon' as const }

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

  if (op) return { listing: op as unknown as ListingLike, tcg: 'onepiece' as const }

  const { data: sealed } = await supabase
    .from('sealed_products')
    .select('*')
    .eq('id', slug)
    .single()

  if (sealed) return { listing: sealed as unknown as ListingLike, tcg: 'sealed' as const }

  return null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const result = await getListing(slug)
  if (!result) return { title: 'Produit introuvable' }
  const { listing } = result
  const name = listing.pokemon_cards?.name_fr ?? listing.onepiece_cards?.name_fr ?? listing.name ?? ''
  return { title: name, description: `${name} — disponible sur Goriki` }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const result = await getListing(slug)
  if (!result) notFound()

  const { listing, tcg } = result
  const supabase = await createClient()

  const card = listing.pokemon_cards ?? listing.onepiece_cards
  const variant = listing.pokemon_variant_types ?? listing.onepiece_variant_types
  const set = card?.pokemon_sets ?? card?.onepiece_sets
  const name = card?.name_fr ?? listing.name ?? 'Produit'
  // Deux schémas cohabitent derrière cette page : les listings de cartes
  // portent `front_photo_url` / `image_api`, les produits scellés portent
  // `image_url`. Omettre le troisième maillon laissait les scellés sans visuel —
  // silencieusement, car `getListing` caste en `ListingLike` où la colonne
  // n'était pas déclarée.
  const frontUrl = listing.front_photo_url ?? listing.image_api ?? listing.image_url ?? null
  const backUrl = listing.back_photo_url ?? null

  // Viewer d'inspection réservé aux pièces ≥ 1 € disposant d'un VRAI scan verso
  // (règle photo du CLAUDE.md).
  const useViewer = listing.price >= PHOTO_PRICE_THRESHOLD && !!backUrl && !!frontUrl
  const reference = [set?.code, card?.number ? `#${card.number}` : null].filter(Boolean).join(' · ') || name

  // Relevé d'inspection : aucune colonne en base à ce jour — le panneau
  // se retire de lui-même tant que la donnée n'existe pas.
  const inspection = null

  const cartImageUrl = frontUrl && tcg !== 'sealed' && !frontUrl.match(/\.(png|jpg|webp|svg)$/)
    ? frontUrl + '/high.webp'
    : frontUrl

  // Une carte a deux faces ; un produit scellé a une galerie de photos. Les deux
  // alimentent le MÊME composant `ScanStage` (bande de vignettes + visuel
  // principal + zoom) — un seul exemplaire de ce pattern dans le code.
  const galerie = (listing.image_urls ?? []).filter(Boolean)
  const scans: { url: string; label: string }[] =
    tcg === 'sealed' && galerie.length > 0
      ? galerie.map((url, i) => ({
          url,
          label: galerie.length > 1 ? `Photo ${i + 1}` : 'Visuel',
        }))
      : ([
          frontUrl ? { url: frontUrl, label: 'Recto' } : null,
          backUrl ? { url: backUrl, label: 'Verso' } : null,
        ].filter(Boolean) as { url: string; label: string }[])

  let sameSet: unknown[] = []
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

  const FICHE = [
    card?.card_type ? { k: 'Type', v: card.card_type } : null,
    card?.attribute ? { k: 'Attribut', v: card.attribute } : null,
    card?.color ? { k: 'Couleur', v: card.color } : null,
    card?.category ? { k: 'Catégorie', v: card.category } : null,
    variant ? { k: 'Version', v: variant.label } : null,
  ].filter(Boolean) as { k: string; v: string }[]

  // ── Exemplaires physiques de la MÊME carte + variante ─────────────────────
  // Au-dessus de 1 €, chaque pièce est scannée individuellement : plusieurs
  // lignes peuvent coexister pour un même état (migration 0027). On les propose
  // comme des destinations — chaque exemplaire a déjà sa propre URL, donc son
  // propre scan et son propre prix. Une carte fongible ou un exemplaire unique
  // ne déclenche aucun affichage supplémentaire.
  let exemplaires: {
    id: string
    price: number
    condition: string | null
    quantity: number
    image: string | null
  }[] = []

  if (tcg !== 'sealed' && card) {
    const table = tcg === 'pokemon' ? 'pokemon_listings' : 'onepiece_listings'
    const variantId = variant?.id
    if (variantId) {
      const { data } = await supabase
        .from(table)
        .select('id, price, condition, quantity, front_photo_url, image_api, copy_index')
        .eq('card_id', card.id)
        .eq('variant_type_id', variantId)
        .eq('is_active', true)
        .gt('quantity', 0)
        .gt('price', 0)
        .order('price', { ascending: true })
      exemplaires = (data ?? []).map(e => ({
        id: e.id,
        price: e.price as number,
        condition: e.condition as string | null,
        quantity: e.quantity as number,
        image: (e.front_photo_url as string | null) ?? (e.image_api as string | null),
      }))
    }
  }

  const epuise = listing.quantity <= 0

  return (
    <>
      <SiteHeader />

      <main className="font-grotesk text-ink">
        <PageContainer as="nav" className="pt-8">
          <span className="data text-[9px]">
            <Link href={`/catalogue/${tcg}`} className="capitalize hover:text-ochre">
              {tcg === 'pokemon' ? 'Pokémon' : tcg === 'onepiece' ? 'One Piece' : 'Scellés'}
            </Link>
            {set && (
              <>
                <span className="mx-1.5 text-ink-55">/</span>
                <Link href={`/catalogue/${tcg}/${card?.set_id}`} className="hover:text-ochre">
                  {set.code}
                </Link>
              </>
            )}
            {card?.number && (
              <>
                <span className="mx-1.5 text-ink-55">/</span>
                <span className="text-ink">{card.number}</span>
              </>
            )}
          </span>
        </PageContainer>

        <PageContainer as="section" className="pb-14 pt-6 lg:pb-20">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,50fr)_minmax(0,50fr)] lg:gap-12">
            {/* ── Scan ─────────────────────────────────────────────────── */}
            <div>
              {useViewer ? (
                <CardViewer
                  frontUrl={frontUrl!}
                  backUrl={backUrl!}
                  altText={name}
                  reference={reference}
                  rarity={card?.rarity}
                />
              ) : (
                <ScanStage images={scans} altText={name} reference={reference} />
              )}
            </div>

            {/* ── Achat ────────────────────────────────────────────────── */}
            <div className="flex flex-col">
              <h1 className="m-0 text-[30px] font-semibold leading-[1.08] tracking-[-0.025em] text-ink lg:text-[36px]">
                {name}
              </h1>

              <span className="data mt-2.5 text-[9px]">
                {[set?.code, card?.number, card?.rarity].filter(Boolean).join(' · ')}
              </span>

              <div className="mt-4 flex flex-wrap gap-2">
                {listing.condition && <span className="pill" data-active="true">{listing.condition}</span>}
                {variant && <span className="pill">{variant.label}</span>}
                {listing.front_photo_url && <span className="pill">Scan réel</span>}
              </div>

              <p className="m-0 mt-6 text-[38px] font-semibold leading-none tracking-[-0.03em] text-ink lg:text-[44px]">
                {formatPrice(listing.price)}
              </p>
              <p className="m-0 mt-2.5 text-[13px] text-ink-70">
                {epuise
                  ? 'Épuisé pour le moment'
                  : `${listing.quantity} exemplaire${listing.quantity > 1 ? 's' : ''} disponible${listing.quantity > 1 ? 's' : ''}`}
              </p>

              {exemplaires.length > 1 && (
                <div className="hair mt-6 pt-5">
                  <span className="data text-[9px]">
                    {exemplaires.length} exemplaires disponibles — chacun scanné séparément
                  </span>
                  <div className="mt-3 flex flex-col gap-2">
                    {exemplaires.map((e, i) => {
                      const courant = e.id === listing.id
                      return (
                        <Link
                          key={e.id}
                          href={`/${e.id}`}
                          aria-current={courant ? 'true' : undefined}
                          className={`flex items-center gap-3 rounded-control border px-3 py-2.5 transition-colors ${
                            courant
                              ? 'border-[rgba(200,134,10,0.55)] bg-[rgba(200,134,10,0.08)]'
                              : 'border-[rgba(26,22,17,0.14)] bg-[rgba(255,255,255,0.5)] hover:bg-white'
                          }`}
                        >
                          {e.image ? (
                            // eslint-disable-next-line @next/next/no-img-element -- vignette d'option, dense
                            <img
                              src={e.image}
                              alt=""
                              aria-hidden
                              loading="lazy"
                              className="h-12 w-[34px] shrink-0 rounded-[3px] object-cover"
                            />
                          ) : (
                            <span className="scan-pending h-12 w-[34px] shrink-0 rounded-[3px]" />
                          )}
                          <span className="flex min-w-0 flex-1 flex-col leading-tight">
                            <span className="text-[13px] font-medium text-ink">
                              Exemplaire {i + 1} · {e.condition ?? '—'}
                            </span>
                            <span className="data mt-0.5 text-[8px]">
                              {courant ? 'affiché ci-dessus' : 'voir son scan'}
                            </span>
                          </span>
                          <span className="shrink-0 text-[15px] font-semibold text-ink">
                            {formatPrice(e.price)}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="mt-7 flex flex-col gap-2.5">
                <AddToCartButton
                  listingId={listing.id}
                  tcg={tcg}
                  name={name}
                  variantLabel={variant?.label}
                  price={listing.price}
                  maxQuantity={listing.quantity}
                  imageUrl={cartImageUrl}
                />

                {/* Pièce indisponible : le seul point d'ajout à la want list
                    depuis le parcours public (décision d'architecture 59). */}
                {epuise && card && tcg !== 'sealed' && (
                  <JeLaChercheButton cardType={tcg} cardId={card.id} />
                )}

                {tcg !== 'sealed' && (
                  <WishlistButton itemType={tcg} itemId={listing.id} variantTypeId={variant?.id ?? null} />
                )}
              </div>

              {/* Panneau d'inspection : rendu par le composant dédié dès que la
                  donnée existera en base. En attendant, on dit franchement d'où
                  vient le visuel plutôt que de cocher un relevé inexistant. */}
              <div className="mt-7">
                <InspectionPanel inspection={inspection} price={listing.price} />
                {!inspection && (
                  <section className="glass rounded-panel-lg p-5">
                    {/* Un scellé ne s'inspecte pas : la boîte n'est jamais ouverte.
                        Lui servir le discours « scanné recto-verso » des cartes
                        n'avait aucun sens. */}
                    <h2 className="display-sub m-0">
                      {tcg === 'sealed' ? 'État du produit' : 'Inspection'}
                    </h2>
                    <p className="m-0 mt-3 max-w-[46ch] text-[13px] leading-[1.6] text-ink-70">
                      {tcg === 'sealed'
                        ? "Produit scellé d'origine, jamais ouvert. Expédition avec emballage renforcé."
                        : listing.front_photo_url
                          ? 'Cette pièce a été scannée par nos soins. Le relevé détaillé (surface, coins, bords, centrage) sera publié ici.'
                          : "Visuel fourni par l'éditeur. Les pièces au-dessus d'un euro sont scannées recto-verso avant expédition."}
                    </p>
                    <span className="data mt-4 block text-[9px]">
                      {tcg === 'sealed'
                        ? 'Scellé d’usine · emballage renforcé'
                        : 'Scan HD recto / verso · chaque détail visible avant achat'}
                    </span>
                  </section>
                )}
              </div>

              {FICHE.length > 0 && (
                <dl className="hair m-0 mt-7 flex flex-col pt-5">
                  {FICHE.map(row => (
                    <div
                      key={row.k}
                      className="flex items-center justify-between border-b border-[rgba(26,22,17,0.09)] py-2.5 last:border-0"
                    >
                      <dt className="data text-[9px]">{row.k}</dt>
                      <dd className="m-0 text-[13px] text-ink">{row.v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
        </PageContainer>

        <SameSetGrid listings={sameSet as never} />
      </main>

      <SiteFooter />
    </>
  )
}
