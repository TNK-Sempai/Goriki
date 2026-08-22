'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { formatPrice } from '@/lib/utils'
import { surfaceBehaviour, shineGradient } from '@/lib/rarity'

/**
 * Card physics — la carte a une surface et une profondeur.
 * L'amplitude de la réaction dépend de la rareté : commune = calme,
 * chase = parallaxe + reflet foil + bordure qui s'allume.
 * Aucun `scale(1.05)` générique.
 *
 * Issu du handoff Claude Design ; le comportement est repris à l'identique,
 * le vocabulaire visuel est remappé sur l'identité v3 (verre + radius à
 * paliers) — le handoff datait du système plat à 4 px.
 *
 * Props identiques à l'ancien CardTile, `index` en plus (optionnel).
 */

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
  /** conservé pour compatibilité d'appel — l'entrée en cascade est pilotée par <Reveal> */
  index?: number
}

export default function CardTile({ listing }: CardTileProps) {
  const card = listing.pokemon_cards ?? listing.onepiece_cards
  const variant = listing.pokemon_variant_types ?? listing.onepiece_variant_types
  const imageUrl = listing.front_photo_url ?? listing.image_api

  const behaviour = surfaceBehaviour(card?.rarity)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const frameRef = useRef<HTMLAnchorElement>(null)

  const active = pointer !== null && behaviour.tier > 0
  const mx = pointer?.x ?? 0.5
  const my = pointer?.y ?? 0.5

  const handleMove = (e: React.PointerEvent) => {
    const r = frameRef.current?.getBoundingClientRect()
    if (!r) return
    setPointer({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height })
  }

  const transform = active
    ? `perspective(900px) rotateY(${((mx - 0.5) * behaviour.tiltAmp).toFixed(2)}deg) rotateX(${((0.5 - my) * behaviour.tiltAmp).toFixed(2)}deg) translateY(-${behaviour.lift}px)`
    : pointer
      ? 'translateY(-2px)'
      : 'none'

  const imageTransform = active && behaviour.parallax
    ? `scale(1.04) translate(${((0.5 - mx) * behaviour.parallax).toFixed(1)}px, ${((0.5 - my) * behaviour.parallax).toFixed(1)}px)`
    : 'none'

  return (
    <div>
      <Link
        href={`/${listing.id}`}
        ref={frameRef}
        onPointerMove={handleMove}
        onPointerLeave={() => setPointer(null)}
        data-card-hover
        className="glass group flex flex-col rounded-panel p-3.5"
        style={{
          transform,
          transformStyle: 'preserve-3d',
          borderColor: active && behaviour.glowEdge ? 'rgba(200,134,10,0.55)' : undefined,
          boxShadow: active
            ? `0 ${18 + behaviour.tier * 8}px ${36 + behaviour.tier * 14}px -${14 + behaviour.tier * 2}px rgba(26,22,17,${0.24 + behaviour.tier * 0.06})`
            : undefined,
          transition: pointer
            ? 'transform 0.1s linear, box-shadow 0.25s ease, border-color 0.25s ease'
            : 'transform 0.5s cubic-bezier(0.22,1,0.36,1), box-shadow 0.4s ease, border-color 0.3s ease',
        }}
      >
        <div className="relative mb-3 aspect-[2.5/3.5] overflow-hidden rounded-control">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- parallaxe pilotée au pixel : next/image impose son propre wrapper transformé
            <img
              src={imageUrl}
              alt={card?.name_fr ?? ''}
              loading="lazy"
              draggable={false}
              className="h-full w-full object-cover"
              style={{
                transform: imageTransform,
                transition: active ? 'transform 0.12s linear' : 'transform 0.45s cubic-bezier(0.22,1,0.36,1)',
              }}
            />
          ) : (
            <div className="scan-pending flex h-full w-full items-center justify-center rounded-control">
              <span className="font-mono text-[10px] tracking-[0.12em] text-[rgba(26,22,17,0.45)]">
                scan à venir
              </span>
            </div>
          )}

          {/* Reflet : discret et systématique au survol, franchement foil sur les
              raretés chase — l'intensité reste une information sur la carte. */}
          <div
            className="surface-shine"
            style={{
              opacity: pointer ? (behaviour.shine === 'foil' ? 0.6 : behaviour.shine === 'soft' ? 0.34 : 0.16) : 0,
              background: shineGradient(behaviour.shine === 'foil' ? 'foil' : 'soft', mx),
            }}
          />

          <div className="pointer-events-none absolute inset-x-1.5 top-1.5 flex items-start justify-between gap-1.5">
            {listing.front_photo_url && (
              <span className="data rounded-control bg-[rgba(26,22,17,0.88)] px-2 py-1 text-[8px] text-parchment">
                Scan réel
              </span>
            )}
            {card?.rarity && (
              <span
                className="data ml-auto rounded-control px-1.5 py-1 text-[8px]"
                style={
                  behaviour.tier === 3
                    ? { background: 'rgba(200,134,10,0.92)', color: '#14110D' }
                    : { background: 'rgba(248,244,236,0.85)', color: 'var(--color-ink)' }
                }
              >
                {card.rarity}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col">
          <p className="mb-1 line-clamp-2 text-xs font-semibold leading-tight text-ink">{card?.name_fr}</p>
          <p className="data mb-2 text-[10px] normal-case tracking-normal">
            #{card?.number} · {listing.condition}
          </p>
          {variant && <span className="badge badge-muted mb-2 self-start text-[9px]">{variant.label}</span>}
          <div className="mt-auto flex items-center justify-between">
            <p className="text-base font-semibold text-ink">{formatPrice(listing.price)}</p>
            <p className="data text-[10px] tracking-normal">×{listing.quantity}</p>
          </div>
        </div>
      </Link>
    </div>
  )
}
