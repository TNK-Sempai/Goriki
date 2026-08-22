import Link from 'next/link'
import PageContainer from '@/components/layout/PageContainer'
import { formatPrice } from '@/lib/utils'

/**
 * Rangée « du même set » en pied de fiche carte.
 *
 * Réécrite avec le vocabulaire du site clair : la version précédente utilisait
 * encore `card`, `text-cream`, `font-display text-xl` et un `hover:scale-105`
 * générique — tous hérités de la DA sombre d'origine, et le `scale` est
 * explicitement proscrit comme seule interaction (CLAUDE.md).
 */
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
    <PageContainer as="section" className="hair pb-16 pt-10 lg:pb-20">
      <h2 className="display-sub m-0 mb-5">Du même set</h2>
      <div className="grid grid-cols-3 gap-3.5 sm:grid-cols-4 lg:grid-cols-6">
        {listings.slice(0, 12).map(l => {
          const card = l.pokemon_cards ?? l.onepiece_cards
          const img = l.front_photo_url ?? l.image_api
          return (
            <Link key={l.id} href={`/${l.id}`} data-card-hover className="group flex flex-col">
              <div className="relative mb-2 aspect-[2.5/3.5] overflow-hidden rounded-[8px] shadow-[0_12px_24px_-14px_rgba(26,22,17,0.5)]">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element -- vignette dense de rangée
                  <img
                    src={img}
                    alt={card?.name_fr ?? ''}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:-translate-y-1"
                  />
                ) : (
                  <div className="scan-pending h-full w-full" />
                )}
              </div>
              <span className="data text-[8px]">{card?.number}</span>
              <span className="line-clamp-1 text-[12px] font-medium leading-tight text-ink">{card?.name_fr}</span>
              <span className="mt-1 text-[13px] font-semibold text-ink">{formatPrice(l.price)}</span>
            </Link>
          )
        })}
      </div>
    </PageContainer>
  )
}
