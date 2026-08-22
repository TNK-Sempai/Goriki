import CardTile from './CardTile'
import Reveal from '@/components/motion/Reveal'
import CardCursor from '@/components/motion/CardCursor'

interface CardGridProps {
  listings: {
    id: string
    price: number
    quantity: number
    condition: string
    front_photo_url: string | null
    image_api: string | null
    needs_photo: boolean
    pokemon_cards?: { id: string; number: string; name_fr: string; rarity: string | null }
    onepiece_cards?: { id: string; number: string; name_fr: string; rarity: string | null }
    pokemon_variant_types?: { code: string; label: string }
    onepiece_variant_types?: { code: string; label: string }
  }[]
  loading?: boolean
  emptyLabel?: string
}

/**
 * Grille de cartes du catalogue — enfin branchée (dormante depuis l'origine).
 * `index` est transmis à `CardTile` pour l'entrée en cascade de la card physics.
 */
export default function CardGrid({ listings, loading = false, emptyLabel }: CardGridProps) {
  const grid = 'grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'

  if (loading) {
    return (
      <div className={grid}>
        {[...Array(15)].map((_, i) => (
          <div key={i} className="scan-pending aspect-[2.5/3.5] rounded-panel" />
        ))}
      </div>
    )
  }

  if (listings.length === 0) {
    return (
      <div className="glass rounded-block px-8 py-16 text-center">
        <p className="m-0 text-[14px] text-ink-70">
          {emptyLabel ?? 'Aucune carte ne correspond à ces filtres.'}
        </p>
      </div>
    )
  }

  return (
    <>
      <CardCursor />
      <Reveal className={grid} stagger={0.035} y={14}>
        {listings.map((listing, i) => (
          <CardTile key={listing.id} listing={listing} index={i} />
        ))}
      </Reveal>
    </>
  )
}
