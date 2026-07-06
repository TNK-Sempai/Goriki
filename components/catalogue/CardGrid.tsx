import CardTile from './CardTile'

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
}

export default function CardGrid({ listings, loading = false }: CardGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {[...Array(24)].map((_, i) => (
          <div key={i} className="skeleton aspect-[2.5/3.5] rounded-md" />
        ))}
      </div>
    )
  }

  if (listings.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-muted">Aucune carte trouvée pour ces filtres.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {listings.map((listing) => (
        <CardTile key={listing.id} listing={listing} />
      ))}
    </div>
  )
}
