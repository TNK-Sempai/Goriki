import Link from 'next/link'
import { formatPrice } from '@/lib/utils'

interface SameSetGridProps {
  listings: {
    id: string
    price: number
    image_api: string | null
    front_photo_url: string | null
    pokemon_cards?: { name_fr: string; number: string }
    onepiece_cards?: { name_fr: string; number: string }
    pokemon_variant_types?: { label: string }
    onepiece_variant_types?: { label: string }
  }[]
}

export default function SameSetGrid({ listings }: SameSetGridProps) {
  if (listings.length === 0) return null

  return (
    <section className="mt-16 pt-10 border-t border-dim">
      <h2 className="font-display text-xl text-cream mb-6">Du même set</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {listings.slice(0, 12).map(l => {
          const card = l.pokemon_cards ?? l.onepiece_cards
          const variant = l.pokemon_variant_types ?? l.onepiece_variant_types
          const img = l.front_photo_url ?? l.image_api
          return (
            <Link key={l.id} href={`/${l.id}`} className="card hover:border-goriki transition-all group text-center">
              {img && (
                <img src={img} alt={card?.name_fr ?? ''} className="w-full aspect-[2.5/3.5] object-cover rounded mb-2 group-hover:scale-105 transition-transform" loading="lazy" />
              )}
              <p className="text-cream text-[11px] font-medium line-clamp-1">{card?.name_fr}</p>
              <p className="text-amber text-xs mt-1">{formatPrice(l.price)}</p>
              {variant && <p className="text-muted text-[10px]">{variant.label}</p>}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
