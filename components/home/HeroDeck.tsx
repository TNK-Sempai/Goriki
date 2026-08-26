'use client'

import Link from 'next/link'
import { useRef, useState, useSyncExternalStore } from 'react'
import { prixOuEpuise } from '@/lib/utils'
import { shineGradient, rarityTier } from '@/lib/rarity'

/**
 * Éventail de cartes du hero — composition de la planche de référence.
 *
 * La planche ne pose PAS une carte produit isolée au centre d'une colonne :
 * elle pose trois cartes en éventail, celle du milieu grande et redressée,
 * les deux autres en retrait et inclinées, avec des ombres portées franches,
 * une pastille de prix flottante et une annotation manuscrite « Scan HD
 * recto / verso ». C'est ce qui donne au hero sa masse visuelle à droite.
 *
 * Guards : parallaxe active seulement au pointeur fin et hors
 * `prefers-reduced-motion` ; `will-change` uniquement pendant le survol.
 */

export interface DeckCard {
  id: string
  name: string
  ref: string
  price: number
  imageUrl: string | null
  rarity: string | null
}

function subscribe(onChange: () => void) {
  const fine = window.matchMedia('(pointer: fine)')
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  fine.addEventListener('change', onChange)
  reduced.addEventListener('change', onChange)
  return () => {
    fine.removeEventListener('change', onChange)
    reduced.removeEventListener('change', onChange)
  }
}

function canAnimate() {
  return (
    window.matchMedia('(pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Position de repos de chaque carte de l'éventail (planche : 2 en retrait, 1 devant). */
const SLOTS = [
  { x: -168, y: 42, rot: -15, scale: 0.8, z: 1, depth: 0.45 },
  { x: 172, y: 26, rot: 12, scale: 0.84, z: 2, depth: 0.65 },
  { x: 4, y: -12, rot: -3, scale: 1, z: 3, depth: 1 },
]

export default function HeroDeck({ cards }: { cards: DeckCard[] }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const enabled = useSyncExternalStore(subscribe, canAnimate, () => false)

  // La planche montre 3 cartes. Moins de stock ⇒ on dessine ce qu'on a,
  // en gardant la carte principale au premier plan.
  const deck = cards.slice(0, 3)
  const slots = SLOTS.slice(3 - deck.length)
  const hero = deck[deck.length - 1]

  const onMove = (e: React.PointerEvent) => {
    if (!enabled) return
    const r = stageRef.current?.getBoundingClientRect()
    if (!r) return
    setPointer({ x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 })
  }

  const px = pointer?.x ?? 0
  const py = pointer?.y ?? 0

  return (
    <div
      ref={stageRef}
      onPointerMove={onMove}
      onPointerLeave={() => setPointer(null)}
      className="relative flex min-h-[380px] items-center justify-center lg:min-h-[560px]"
      style={{ perspective: 1600 }}
    >
      {/* Coordonnées de navigation — détail cartographique de la planche. */}
      <span className="data pointer-events-none absolute bottom-[18%] right-0 hidden text-[9px] text-ink-55 lg:block">
        34°03′N 118°15′W
      </span>

      {deck.map((card, i) => {
        const s = slots[i]
        const foil = rarityTier(card.rarity) >= 2
        const lead = i === deck.length - 1
        return (
          <Link
            key={card.id}
            href={`/${card.id}`}
            data-card-hover
            aria-label={card.name}
            className="absolute block overflow-hidden rounded-[14px]"
            style={{
              width: lead ? 'min(272px, 46vw)' : 'min(232px, 40vw)',
              aspectRatio: '2.5 / 3.5',
              zIndex: s.z,
              transform: [
                `translate3d(${s.x + px * 34 * s.depth}px, ${s.y + py * 22 * s.depth}px, 0)`,
                `rotateY(${(px * 14 * s.depth).toFixed(2)}deg)`,
                `rotateX(${(-py * 10 * s.depth).toFixed(2)}deg)`,
                `rotate(${s.rot}deg)`,
                `scale(${s.scale})`,
              ].join(' '),
              transformStyle: 'preserve-3d',
              transition: pointer
                ? 'transform 0.12s linear'
                : 'transform 0.8s cubic-bezier(0.22,1,0.36,1)',
              willChange: pointer ? 'transform' : 'auto',
              boxShadow: lead
                ? '0 46px 80px -30px rgba(26,22,17,0.55), 0 0 0 1px rgba(26,22,17,0.08)'
                : '0 30px 60px -28px rgba(26,22,17,0.45), 0 0 0 1px rgba(26,22,17,0.06)',
            }}
          >
            {card.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- surface transformée en 3D : next/image impose un wrapper qui casse le preserve-3d
              <img
                src={card.imageUrl}
                alt={card.name}
                draggable={false}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="scan-pending flex h-full w-full items-center justify-center">
                <span className="data text-[9px]">scan à venir</span>
              </div>
            )}
            {foil && (
              <div
                className="surface-shine"
                style={{ opacity: pointer ? 0.42 : 0.16, background: shineGradient('foil', px + 0.5) }}
              />
            )}
          </Link>
        )
      })}

      {/* Pastille de prix flottante sous la carte de tête (planche, écran 1). */}
      {hero && (
        <div
          className="pointer-events-none absolute bottom-[6%] z-10 rounded-[10px] bg-[#FBF8F2] px-4 py-2.5 shadow-[0_18px_34px_-16px_rgba(26,22,17,0.5)]"
          style={{ transform: `translate3d(${px * 16}px, ${py * 10}px, 0)` }}
        >
          <span className="text-[15px] font-semibold text-ink">{prixOuEpuise(hero.price)}</span>
          <span className="data ml-2 text-[9px] text-ink-55">{hero.ref}</span>
        </div>
      )}

      {/* Annotation manuscrite de la planche : elle nomme la promesse du site. */}
      <span className="pointer-events-none absolute bottom-[26%] left-0 hidden max-w-[92px] text-[12px] italic leading-[1.35] text-ink-55 lg:block">
        Scan HD
        <br />
        recto / verso
      </span>
    </div>
  )
}
