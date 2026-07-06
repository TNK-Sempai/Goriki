import Link from 'next/link'
import { formatPrice } from '@/lib/utils'

interface CardTileProps {
  listing: {
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
  }
}

export default function CardTile({ listing }: CardTileProps) {
  const card = listing.pokemon_cards ?? listing.onepiece_cards
  const variant = listing.pokemon_variant_types ?? listing.onepiece_variant_types
  const imageUrl = listing.front_photo_url ?? listing.image_api

  return (
    <Link
      href={`/${listing.id}`}
      className="card group flex flex-col hover:border-goriki transition-all hover:-translate-y-0.5"
    >
      {/* Image */}
      <div className="relative aspect-[2.5/3.5] bg-surface-2 rounded-md overflow-hidden mb-3">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={card?.name_fr ?? ''}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-xs">
            Pas d&apos;image
          </div>
        )}
        {listing.front_photo_url && (
          <span className="absolute top-1.5 left-1.5 badge badge-amber text-[9px]">Photo réelle</span>
        )}
      </div>

      {/* Infos */}
      <div className="flex-1 flex flex-col">
        <p className="text-cream text-xs font-medium leading-tight mb-1 line-clamp-2">
          {card?.name_fr}
        </p>
        <p className="text-muted text-[11px] mb-2">
          #{card?.number} · {card?.rarity ?? '—'}
        </p>
        {variant && (
          <span className="badge badge-muted text-[9px] mb-2 self-start">{variant.label}</span>
        )}
        <div className="mt-auto flex items-center justify-between">
          <p className="text-amber font-display text-base">{formatPrice(listing.price)}</p>
          <p className="text-muted text-[10px]">×{listing.quantity}</p>
        </div>
      </div>
    </Link>
  )
}
