'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

/**
 * Vitrine des nouveautés — colonne droite du hero.
 *
 * REPREND À L'IDENTIQUE l'éventail du hero par défaut (`HeroDeck`) : mêmes
 * positions de slot, mêmes rotations, mêmes échelles, mêmes ombres portées,
 * même perspective, même parallaxe au pointeur. Aucune tuile, aucune bordure,
 * aucun encadré produit — la carte est posée dans l'espace, pas dans une boîte.
 *
 *   SLOTS   x −168 / +172 / +4    rot −15° / +12° / −3°   scale 0,80 / 0,84 / 1
 *   ombres  0 46px 80px −30px (tête) · 0 30px 60px −28px (fond)
 *   largeur min(272px, 46vw) en tête · min(232px, 40vw) en fond
 *
 * SEUL AJOUT au style de `HeroDeck` : un flou léger sur les cartes d'arrière-plan.
 * Il rapproche la composition de la référence verrouillée
 * (`reference-home-goriki.png`), où les cartes du fond sont nettement moins
 * nettes que celle de tête — `HeroDeck` les rendait toutes piquées.
 *
 * UNE SEULE composition à la fois : les sets défilent en fondu, jamais côte à
 * côte. Sous `prefers-reduced-motion`, le défilement est neutralisé et le
 * premier set reste affiché.
 *
 * Aucun prix, aucun nom de carte : c'est une vitrine de nouveauté. Seul le nom
 * du set est nommé, et le stock reste dit tel quel.
 */

export interface Nouveaute {
  setId: string
  universe: 'pokemon' | 'onepiece'
  code: string
  name: string
  releaseDate: string | null
  /** Jusqu'à 3 visuels du set, le plus rare en tête */
  images: string[]
  /** Pièces réellement en vente dans ce set */
  dispo: number
}

const LIBELLE = { pokemon: 'Pokémon', onepiece: 'One Piece' } as const

/** Positions de repos — valeurs reprises telles quelles de `HeroDeck`. */
const SLOTS = [
  { x: -168, y: 42, rot: -15, scale: 0.8, z: 1, depth: 0.45 },
  { x: 172, y: 26, rot: 12, scale: 0.84, z: 2, depth: 0.65 },
  { x: 4, y: -12, rot: -3, scale: 1, z: 3, depth: 1 },
]

const DUREE_PALIER = 5200
/** Après une navigation manuelle, le défilement se tait — sinon la main de
 *  l'utilisateur serait annulée par le palier suivant une seconde plus tard. */
const PAUSE_MANUELLE = 12000

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

function subscribeReduced(onChange: () => void) {
  const m = window.matchMedia('(prefers-reduced-motion: reduce)')
  m.addEventListener('change', onChange)
  return () => m.removeEventListener('change', onChange)
}

function isReduced() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function moisAn(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export default function NouveautesHero({ sets }: { sets: Nouveaute[] }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [index, setIndex] = useState(0)
  const [pause, setPause] = useState(false)
  const minuteurPause = useRef<ReturnType<typeof setTimeout> | null>(null)

  const parallaxeActive = useSyncExternalStore(subscribe, canAnimate, () => false)
  const reduced = useSyncExternalStore(subscribeReduced, isReduced, () => true)

  // Défilement : une composition remplace l'autre, jamais côte à côte.
  // Neutralisé sous `prefers-reduced-motion`, et inutile s'il n'y a qu'un set.
  useEffect(() => {
    if (reduced || pause || sets.length < 2) return
    const id = setInterval(() => {
      setIndex(i => (i + 1) % sets.length)
    }, DUREE_PALIER)
    return () => clearInterval(id)
  }, [reduced, pause, sets.length])

  useEffect(() => () => { if (minuteurPause.current) clearTimeout(minuteurPause.current) }, [])

  // Toute navigation manuelle — flèches comme repères — suspend le défilement.
  // La pause vaut aussi sous `prefers-reduced-motion` : elle ne coûte rien là où
  // il n'y a rien à suspendre, et la règle reste la même partout.
  const naviguer = (vers: number) => {
    const n = sets.length
    setIndex(((vers % n) + n) % n)
    setPause(true)
    if (minuteurPause.current) clearTimeout(minuteurPause.current)
    minuteurPause.current = setTimeout(() => setPause(false), PAUSE_MANUELLE)
  }

  const onMove = (e: React.PointerEvent) => {
    if (!parallaxeActive) return
    const r = stageRef.current?.getBoundingClientRect()
    if (!r) return
    setPointer({ x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 })
  }

  const px = pointer?.x ?? 0
  const py = pointer?.y ?? 0

  if (sets.length === 0) {
    return (
      <div className="flex min-h-[380px] items-center justify-center lg:min-h-[560px]">
        <div className="scan-pending flex aspect-[2.5/3.5] w-[262px] items-center justify-center rounded-[14px]">
          <span className="data text-[9px]">nouveautés à venir</span>
        </div>
      </div>
    )
  }

  const courant = sets[Math.min(index, sets.length - 1)]
  // La carte la plus rare passe DEVANT : on remplit les slots de fond d'abord.
  const visuels = courant.images.slice(0, 3)
  const slots = SLOTS.slice(3 - visuels.length)
  const ordonnees = [...visuels].reverse()

  return (
    <div
      ref={stageRef}
      onPointerMove={onMove}
      onPointerLeave={() => setPointer(null)}
      className="relative flex min-h-[380px] flex-col items-center justify-center [--eventail:0.58] sm:[--eventail:0.78] lg:min-h-[520px] lg:[--eventail:0.6] xl:[--eventail:1]"
      style={{ perspective: 1600 }}
    >
      <Link
        href={`/catalogue/${courant.universe}/${courant.setId}`}
        data-card-hover
        aria-label={`${courant.code} — ${courant.name}`}
        className="relative flex w-full flex-1 items-center justify-center"
      >
        {ordonnees.map((src, i) => {
          const s = slots[i]
          const lead = i === ordonnees.length - 1
          return (
            <div
              // La clé porte le set : changer de set remonte les nœuds, ce qui
              // relance l'animation d'apparition en fondu.
              key={`${courant.setId}-${i}`}
              className="absolute overflow-hidden rounded-[14px]"
              style={{
                width: lead ? 'min(272px, 46vw)' : 'min(232px, 40vw)',
                aspectRatio: '2.5 / 3.5',
                zIndex: s.z,
                transform: [
                  // `--eventail` vaut exactement 1 à partir de `xl` : le calc s'y
                  // réduit donc à la valeur brute de `HeroDeck`. En dessous, il
                  // resserre l'écartement, les largeurs, elles, clampent déjà en vw.
                  // Entre 1024 et 1279 px, la moitié droite du hero ne fait que
                  // 490 px environ : à 1, les cartes de fond déborderaient sur le
                  // texte, d'où 0,6.
                  `translate3d(calc(${s.x}px * var(--eventail, 1) + ${(px * 34 * s.depth).toFixed(2)}px), calc(${s.y}px * var(--eventail, 1) + ${(py * 22 * s.depth).toFixed(2)}px), 0)`,
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
                // Profondeur : seule la carte de tête est piquée.
                filter: lead ? undefined : 'blur(2.5px)',
                opacity: lead ? 1 : 0.85,
                animation: reduced ? undefined : 'var(--animate-fade-in)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- surface transformée en 3D : next/image impose un wrapper qui casse le preserve-3d */}
              <img
                src={src}
                alt=""
                aria-hidden
                draggable={false}
                loading={index === 0 ? 'eager' : 'lazy'}
                className="h-full w-full object-cover"
              />
            </div>
          )
        })}
      </Link>

      {/* Sous la composition : le SET, pas la carte. Aucun prix. */}
      <Link
        href={`/catalogue/${courant.universe}/${courant.setId}`}
        className="relative z-10 mt-2 flex flex-col items-center text-center"
      >
        <span className="flex items-center gap-2">
          <span className="corner-tag" data-tone="ochre">Nouveau</span>
          <span className="data text-[9px]">{LIBELLE[courant.universe]}</span>
        </span>
        <span className="display-sub mt-2.5">{courant.code}</span>
        <span className="mt-1 text-[13px] leading-tight text-ink-70">{courant.name}</span>
        <span className="data mt-1.5 text-[8px]">
          {moisAn(courant.releaseDate) ?? 'date inconnue'}
          {courant.dispo > 0 ? ` · ${courant.dispo} dispo` : ' · bientôt'}
        </span>
      </Link>

      {/* Navigation — muette s'il n'y a qu'un set. Les flèches reprennent le
          registre des « Voir tout → » du site : glyphe en mono, pas de bouton
          plein. Elles encadrent les repères de palier. */}
      {sets.length > 1 && (
        <div className="relative z-10 mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => naviguer(index - 1)}
            aria-label="Set précédent"
            className="data px-1 py-1 text-[11px] leading-none text-ink-55 transition-colors hover:text-ink"
          >
            ←
          </button>

          <div className="flex items-center gap-1.5">
            {sets.map((s, i) => (
              <button
                key={s.setId}
                type="button"
                onClick={() => naviguer(i)}
                aria-label={`Voir ${s.code}`}
                aria-current={i === index}
                className="h-1.5 w-1.5 rounded-full transition-colors"
                style={{ background: i === index ? 'var(--color-ochre)' : 'rgba(26,22,17,0.18)' }}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => naviguer(index + 1)}
            aria-label="Set suivant"
            className="data px-1 py-1 text-[11px] leading-none text-ink-55 transition-colors hover:text-ink"
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}
