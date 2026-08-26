'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { prixDepuis } from '@/lib/utils'
import { surfaceBehaviour, shineGradient } from '@/lib/rarity'

/**
 * Tuile de carte du catalogue — DEUX états.
 *
 * Le catalogue montre l'intégralité d'un set, pas seulement le stock : une
 * carte qu'on ne vend pas reste visible, parce que c'est le set qu'on donne à
 * parcourir, pas l'inventaire.
 *
 *   · DISPONIBLE (listing actif, stock > 0, prix > 0) — traitement normal, avec
 *     la card physics : inclinaison, reflet piloté par la rareté, prix affiché.
 *   · INDISPONIBLE — visuellement en retrait (opacité réduite, désaturation
 *     légère), AUCUN prix affiché, et l'appel « ♡ Je la cherche ». Elle n'a pas
 *     de physique : une carte qu'on ne peut pas acheter ne doit pas se
 *     comporter comme une pièce qu'on manipule.
 *
 * Aucun prix n'est jamais affiché sur une carte non achetable — un « 0,00 € »
 * la faisait passer pour gratuite.
 */

/**
 * Une version imprimée de la carte (Normale, Reverse, Pokéball…), avec la ligne
 * de stock qui lui correspond.
 *
 * ⚠️ Le VISUEL est le même d'une variante à l'autre dans la quasi-totalité des
 * cas : sur les 8 770 cartes Pokémon à plusieurs variantes, 14 seulement ont un
 * `image_api` distinct — la source ne photographie pas séparément un reverse.
 * Ce qui change réellement, c'est le STOCK (1 202 cartes ont des quantités
 * différentes selon la variante). Le switch ne promet donc pas un changement
 * d'illustration : il donne accès à la bonne LIGNE de stock, et à sa fiche.
 */
export interface VariantOption {
  code: string
  label: string
  imageUrl: string | null
  listingId: string | null
  available: boolean
  price: number | null
  condition: string | null
  quantity: number
  hasRealScan: boolean
  /**
   * Le visuel montré est celui de la CARTE, faute de visuel propre à cette
   * variante. Vrai pour 3 702 des 29 210 variantes — un affichage sur huit.
   */
  imageEstRepli: boolean
}

export interface CardEntry {
  cardId: string
  number: string
  name: string
  rarity: string | null
  imageUrl: string | null
  /** Fiche à ouvrir au clic. Toujours renseignée : l'import crée une ligne par carte. */
  listingId: string | null
  available: boolean
  price: number | null
  condition: string | null
  variantLabel: string | null
  quantity: number
  /** Un vrai scan maison existe (par opposition au visuel d'éditeur) */
  hasRealScan: boolean
  /**
   * Versions imprimées disponibles pour CETTE carte, dans l'ordre du set.
   * Vide quand l'univers n'en gère pas (One Piece, hors périmètre) ou quand la
   * carte n'en a qu'une : le switch ne s'affiche qu'à partir de deux.
   */
  variants: VariantOption[]
}

export default function CardTile({ card }: { card: CardEntry; index?: number }) {
  const behaviour = surfaceBehaviour(card.rarity)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [vIndex, setVIndex] = useState(0)
  const frameRef = useRef<HTMLDivElement>(null)

  // UNE SEULE tuile par carte : le switch change la version AFFICHÉE, il ne
  // duplique jamais la tuile dans la grille.
  const plusieurs = card.variants.length > 1
  const v = card.variants[vIndex] ?? null

  // La variante retenue prime ; sans variante, on retombe sur les champs de la
  // carte — c'est le cas de One Piece, laissé intact par cette mission.
  const imageUrl = v?.imageUrl ?? card.imageUrl
  const listingId = v?.listingId ?? card.listingId
  const available = v ? v.available : card.available
  const price = v ? v.price : card.price
  const condition = v ? v.condition : card.condition
  const quantity = v ? v.quantity : card.quantity
  const variantLabel = v ? v.label : card.variantLabel
  const hasRealScan = v ? v.hasRealScan : card.hasRealScan
  // 3 702 variantes sur 29 210 n'ont pas de visuel propre : on montre celui de
  // la carte, et on le DIT plutôt que de laisser croire à un scan de la version.
  const imageEstRepli = v?.imageEstRepli ?? false

  const bascule = (pas: number) => {
    const n = card.variants.length
    setVIndex(i => ((i + pas) % n + n) % n)
  }

  // La physique n'appartient qu'aux pièces réellement achetables.
  const physique = available
  const active = physique && pointer !== null && behaviour.tier > 0
  const mx = pointer?.x ?? 0.5
  const my = pointer?.y ?? 0.5

  const handleMove = (e: React.PointerEvent) => {
    if (!physique) return
    const r = frameRef.current?.getBoundingClientRect()
    if (!r) return
    setPointer({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height })
  }

  const transform = active
    ? `perspective(900px) rotateY(${((mx - 0.5) * behaviour.tiltAmp).toFixed(2)}deg) rotateX(${((0.5 - my) * behaviour.tiltAmp).toFixed(2)}deg) translateY(-${behaviour.lift}px)`
    : physique && pointer
      ? 'translateY(-2px)'
      : 'none'

  const imageTransform = active && behaviour.parallax
    ? `scale(1.04) translate(${((0.5 - mx) * behaviour.parallax).toFixed(1)}px, ${((0.5 - my) * behaviour.parallax).toFixed(1)}px)`
    : 'none'

  const href = listingId ? `/${listingId}` : '#'

  return (
    // Le PANNEAU porte le cadre et la physique ; le lien ne couvre que le
    // contenu cliquable. Le switch est ainsi un FRÈRE du lien et non un bouton
    // imbriqué dans une ancre — ce qui serait du HTML invalide et rendrait la
    // tuile inutilisable au clavier.
    <div
      ref={frameRef}
      onPointerMove={handleMove}
      onPointerLeave={() => setPointer(null)}
      data-card-hover={physique ? '' : undefined}
      className={`group relative flex flex-col rounded-panel p-3.5 ${physique ? 'glass' : 'glass-light'}`}
      style={{
        transform,
        transformStyle: 'preserve-3d',
        // Le retrait visuel de l'indisponible : présent, lisible, mais en
        // arrière-plan de l'attention.
        opacity: physique ? 1 : 0.62,
        borderColor: active && behaviour.glowEdge ? 'rgba(200,134,10,0.55)' : undefined,
        boxShadow: active
          ? `0 ${18 + behaviour.tier * 8}px ${36 + behaviour.tier * 14}px -${14 + behaviour.tier * 2}px rgba(26,22,17,${0.24 + behaviour.tier * 0.06})`
          : undefined,
        transition: pointer
          ? 'transform 0.1s linear, box-shadow 0.25s ease, border-color 0.25s ease, opacity 0.25s ease'
          : 'transform 0.5s cubic-bezier(0.22,1,0.36,1), box-shadow 0.4s ease, border-color 0.3s ease, opacity 0.25s ease',
      }}
    >
      <Link
        href={href}
        aria-label={available ? card.name : `${card.name} — indisponible`}
        className="flex flex-1 flex-col"
      >
        <div className="relative mb-3 aspect-[2.5/3.5] overflow-hidden rounded-control">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- parallaxe pilotée au pixel : next/image impose son propre wrapper transformé
            <img
              src={imageUrl}
              alt={card.name}
              loading="lazy"
              draggable={false}
              className="h-full w-full object-cover"
              style={{
                transform: imageTransform,
                // Une carte indisponible se retire aussi par la couleur.
                filter: physique ? undefined : 'saturate(0.75)',
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

          {imageEstRepli && variantLabel && (
            <span
              className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 px-2 py-1.5"
              style={{ background: 'linear-gradient(to top, rgba(20,17,13,0.92), rgba(20,17,13,0.72) 62%, rgba(20,17,13,0))' }}
            >
              <span className="font-mono text-[8px] uppercase leading-none tracking-[0.14em] text-parchment">{variantLabel}</span>
              <span aria-hidden className="font-mono text-[8px] leading-none text-[rgba(248,244,236,0.55)]">·&nbsp;visuel de base</span>
            </span>
          )}

          {physique && (
            <div
              className="surface-shine"
              style={{
                opacity: pointer ? (behaviour.shine === 'foil' ? 0.6 : behaviour.shine === 'soft' ? 0.34 : 0.16) : 0,
                background: shineGradient(behaviour.shine === 'foil' ? 'foil' : 'soft', mx),
              }}
            />
          )}

          <div className="pointer-events-none absolute inset-x-1.5 top-1.5 flex items-start justify-between gap-1.5">
            {hasRealScan && (
              <span className="data rounded-control bg-[rgba(26,22,17,0.88)] px-2 py-1 text-[8px] text-parchment">
                Scan réel
              </span>
            )}
            {card.rarity && (
              <span
                className="data ml-auto rounded-control px-1.5 py-1 text-[8px]"
                style={
                  physique && behaviour.tier === 3
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
          <p className="mb-1 line-clamp-2 text-xs font-semibold leading-tight text-ink">{card.name}</p>
          <p className="data mb-2 text-[10px] normal-case tracking-normal">
            #{card.number}
            {available && condition ? ` · ${condition}` : ''}
          </p>
          {/* Le switch nomme déjà la version : pas de badge en double. */}
          {available && variantLabel && !plusieurs && (
            <span className="badge badge-muted mb-2 self-start text-[9px]">{variantLabel}</span>
          )}

          <div className="mt-auto flex items-center justify-between gap-2">
            {available ? (
              <>
                <p className="text-base font-semibold text-ink">{prixDepuis(price)}</p>
                <p className="data text-[10px] tracking-normal">×{quantity}</p>
              </>
            ) : (
              // Pas de prix : la carte n'est pas à vendre. L'appel à l'action est
              // la recherche, et la tuile entière y mène.
              <span className="data flex items-center gap-1.5 text-[9px] text-ink-55">
                <span aria-hidden>♡</span> Je la cherche
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Switch de version — discret, dans le registre mono du reste du site.
          N'apparaît qu'à partir de deux versions : une carte qui n'existe qu'en
          Normale n'a rien à basculer. Le compteur « 1/2 » dit d'emblée qu'il y a
          autre chose à voir, ce qu'aucune tuile ne disait jusqu'ici. */}
      {plusieurs && (
        <div className="mt-2.5 flex items-center justify-between gap-1 border-t border-[rgba(26,22,17,0.1)] pt-2">
          <button
            type="button"
            onClick={() => bascule(-1)}
            aria-label={`${card.name} — version précédente`}
            className="data px-1 py-0.5 text-[10px] leading-none text-ink-55 transition-colors hover:text-ink"
          >
            ‹
          </button>

          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="data shrink-0 text-[9px] text-ink-55" aria-live="polite">
              {vIndex + 1}/{card.variants.length}
            </span>
            <span className="truncate text-[10px] leading-tight text-ink-70">{variantLabel}</span>
          </span>

          <button
            type="button"
            onClick={() => bascule(1)}
            aria-label={`${card.name} — version suivante`}
            className="data px-1 py-0.5 text-[10px] leading-none text-ink-55 transition-colors hover:text-ink"
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}
