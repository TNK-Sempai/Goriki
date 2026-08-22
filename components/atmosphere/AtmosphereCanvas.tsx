'use client'

import { useEffect, useRef } from 'react'
import type { Universe } from '@/lib/universe-theme'

/**
 * Atmosphère — DEUX cartographies, une par univers.
 *
 * Doctrine CLAUDE.md depuis le premier brief : One Piece et Pokémon n'ont pas
 * la même atmosphère. Ce n'est pas un dégradé de la même image :
 *
 *   · One Piece → NAVIGATION. Rose des vents gravée, anneaux gradués en degrés,
 *     relèvements filant vers le large. Registre du carnet de bord.
 *   · Pokémon   → CLASSIFICATION. Silhouette de Pokéball, viseur d'appareil
 *     (équerres d'angle), réglette graduée, arcs de balayage. Registre de
 *     l'index, de la fiche technique.
 *
 * Les deux motifs se croisent en fondu : `t` va de 0 (One Piece) à 1 (Pokémon),
 * et pendant la bascule les deux coexistent brièvement — c'est le morph
 * (signatures motion 4 et 5).
 *
 * ⚠️ Le réseau de nœuds 9×7 relié par des courbes a été SUPPRIMÉ : dessiné
 * identiquement sur tous les écrans, ce quadrillage de points et de lignes
 * écrasait les différences de composition d'un écran à l'autre. Ne pas le
 * réintroduire — le fond ne porte que le motif d'univers et le gradient radial
 * de `globals.css`.
 *
 * Purement décoratif : `aria-hidden`, et entièrement figé sous
 * `prefers-reduced-motion` (aucune boucle rAF, aucune parallaxe).
 */

const INK = (a: number) => `rgba(26,22,17,${Math.max(0, a).toFixed(3)})`

/* ── ONE PIECE ─────────────────────────────────────────────────────────────
   Rose des vents : 4 branches cardinales longues + 4 intercardinales courtes,
   anneaux concentriques et graduations tous les 5°.                          */
function drawCompass(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  spin: number,
  alpha: number,
) {
  g.save()
  g.translate(cx, cy)
  g.rotate(spin)

  // Chaque pointe est un losange effilé, moitié claire / moitié sombre :
  // c'est ce contraste qui donne l'aspect « gravure ».
  const spike = (len: number, halfWidth: number, rot: number) => {
    g.save()
    g.rotate(rot)
    g.beginPath()
    g.moveTo(0, -len)
    g.lineTo(halfWidth, 0)
    g.lineTo(0, 0)
    g.closePath()
    g.fillStyle = INK(alpha * 0.55)
    g.fill()
    g.beginPath()
    g.moveTo(0, -len)
    g.lineTo(-halfWidth, 0)
    g.lineTo(0, 0)
    g.closePath()
    g.fillStyle = INK(alpha * 0.22)
    g.fill()
    g.restore()
  }

  for (let i = 0; i < 4; i++) spike(R * 0.94, R * 0.085, (i * Math.PI) / 2)
  for (let i = 0; i < 4; i++) spike(R * 0.52, R * 0.06, Math.PI / 4 + (i * Math.PI) / 2)

  g.lineWidth = 1
  const rings: Array<[number, number]> = [[0.3, 0.9], [1.06, 0.7], [1.14, 0.45]]
  for (const [rad, a] of rings) {
    g.beginPath()
    g.arc(0, 0, R * rad, 0, Math.PI * 2)
    g.strokeStyle = INK(alpha * a)
    g.stroke()
  }

  for (let d = 0; d < 360; d += 5) {
    const major = d % 45 === 0
    const a0 = (d * Math.PI) / 180
    const r0 = R * 1.06
    const r1 = R * (major ? 1.14 : 1.1)
    g.beginPath()
    g.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0)
    g.lineTo(Math.cos(a0) * r1, Math.sin(a0) * r1)
    g.strokeStyle = INK(alpha * (major ? 0.85 : 0.4))
    g.stroke()
  }

  g.beginPath()
  g.arc(0, 0, R * 0.055, 0, Math.PI * 2)
  g.fillStyle = INK(alpha * 0.8)
  g.fill()

  g.restore()
}

/** Relèvements : lignes fines partant de la rose vers le large. */
function drawBearings(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  spin: number,
  alpha: number,
) {
  g.lineWidth = 1
  g.strokeStyle = INK(alpha)
  for (let i = 0; i < 6; i++) {
    const a0 = spin + (i * Math.PI) / 3 + 0.35
    g.beginPath()
    g.moveTo(cx + Math.cos(a0) * R * 1.2, cy + Math.sin(a0) * R * 1.2)
    g.lineTo(cx + Math.cos(a0) * R * 3.4, cy + Math.sin(a0) * R * 3.4)
    g.stroke()
  }
}

/* ── POKÉMON ───────────────────────────────────────────────────────────────
   Pokéball gravée + appareillage de fiche : viseur, réglette, arcs de
   balayage. Aucune rose des vents ne doit subsister de ce côté.              */
function drawPokeball(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  alpha: number,
) {
  g.save()
  g.translate(cx, cy)
  g.lineWidth = 1

  // Sphère
  g.beginPath()
  g.arc(0, 0, R, 0, Math.PI * 2)
  g.strokeStyle = INK(alpha * 0.9)
  g.stroke()

  // Hémisphère supérieur légèrement appuyé : c'est ce qui rend la Pokéball
  // reconnaissable sans aucune couleur.
  g.beginPath()
  g.arc(0, 0, R, Math.PI, 0)
  g.strokeStyle = INK(alpha * 0.45)
  g.lineWidth = 3
  g.stroke()
  g.lineWidth = 1

  // Bande équatoriale
  g.beginPath()
  g.moveTo(-R, 0)
  g.lineTo(-R * 0.3, 0)
  g.moveTo(R * 0.3, 0)
  g.lineTo(R, 0)
  g.strokeStyle = INK(alpha * 0.9)
  g.stroke()

  // Bouton central : deux anneaux + pastille
  for (const [rad, a] of [[0.3, 0.9], [0.2, 0.6]] as Array<[number, number]>) {
    g.beginPath()
    g.arc(0, 0, R * rad, 0, Math.PI * 2)
    g.strokeStyle = INK(alpha * a)
    g.stroke()
  }
  g.beginPath()
  g.arc(0, 0, R * 0.07, 0, Math.PI * 2)
  g.fillStyle = INK(alpha * 0.8)
  g.fill()

  // Arcs de balayage — le motif « scan » du Pokédex, en pointillé.
  g.setLineDash([4, 7])
  for (const rad of [1.18, 1.34]) {
    g.beginPath()
    g.arc(0, 0, R * rad, -0.7, 1.5)
    g.strokeStyle = INK(alpha * 0.4)
    g.stroke()
  }
  g.setLineDash([])

  g.restore()
}

/** Viseur d'appareil : quatre équerres d'angle + réglette graduée. */
function drawIndexFrame(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  alpha: number,
) {
  const half = R * 1.55
  const arm = R * 0.3
  g.save()
  g.translate(cx, cy)
  g.lineWidth = 1
  g.strokeStyle = INK(alpha * 0.7)

  const corner = (sx: number, sy: number) => {
    g.beginPath()
    g.moveTo(sx * half, sy * half - sy * arm)
    g.lineTo(sx * half, sy * half)
    g.lineTo(sx * half - sx * arm, sy * half)
    g.stroke()
  }
  corner(-1, -1)
  corner(1, -1)
  corner(-1, 1)
  corner(1, 1)

  // Réglette graduée le long du bord droit — registre « fiche technique ».
  for (let i = -6; i <= 6; i++) {
    const major = i % 3 === 0
    const y = (i / 6) * half * 0.78
    g.beginPath()
    g.moveTo(half, y)
    g.lineTo(half - (major ? R * 0.14 : R * 0.07), y)
    g.strokeStyle = INK(alpha * (major ? 0.75 : 0.35))
    g.stroke()
  }

  g.restore()
}

export default function AtmosphereCanvas({
  universe,
  intensity = 0,
  className = '',
}: {
  universe: Universe
  /** 0 = repos, 1 = bascule d'univers : le tracé se densifie le temps du morph. */
  intensity?: number
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const targetRef = useRef(universe === 'pokemon' ? 1 : 0)
  const intensityRef = useRef(intensity)
  // Reference vers la fonction de dessin : sous `prefers-reduced-motion` il n'y
  // a AUCUNE boucle rAF, le canvas n'est donc peint qu'une fois. Sans ce rappel
  // explicite, un changement d'univers ne repeignait jamais — l'utilisateur en
  // mouvement reduit restait bloque sur la cartographie One Piece.
  const drawRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    targetRef.current = universe === 'pokemon' ? 1 : 0
    drawRef.current?.()
  }, [universe])

  useEffect(() => {
    intensityRef.current = intensity
  }, [intensity])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const pointer = { x: 0.5, y: 0.5 }
    let t = targetRef.current
    let spin = 0
    let raf = 0

    function onPointerMove(e: PointerEvent) {
      const rect = canvas?.getBoundingClientRect()
      if (!rect) return
      pointer.x = (e.clientX - rect.left) / rect.width
      pointer.y = (e.clientY - rect.top) / rect.height
    }

    function draw() {
      const c = ref.current
      if (!c) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = c.clientWidth
      const h = c.clientHeight
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr)
        c.height = Math.round(h * dpr)
      }
      const g = c.getContext('2d')
      if (!g) return

      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)

      t = reduced ? targetRef.current : t + (targetRef.current - t) * 0.045
      const ease = t * t * (3 - 2 * t)
      const boost = intensityRef.current
      const px = reduced ? 0 : pointer.x - 0.5
      const py = reduced ? 0 : pointer.y - 0.5
      if (!reduced) spin += 0.00035

      // Taille calée sur la LARGEUR (bornée par la hauteur) : sur un viewport
      // très haut, un rayon dérivé de min(w,h) ferait exploser le motif.
      const R = Math.min(w * 0.135, h * 0.3)
      const cx = w * 0.855 + px * 26
      const cy = h * 0.32 + py * 20
      const base = 0.3 + boost * 0.24

      // Fondu croisé strict : à `ease = 1`, la rose est à ZÉRO. C'est le
      // défaut corrigé — elle restait visible à ~0,135 sur les pages Pokémon.
      const aOnePiece = base * (1 - ease)
      const aPokemon = base * ease

      if (aOnePiece > 0.004) {
        drawCompass(g, cx, cy, R, spin, aOnePiece)
        drawBearings(g, cx, cy, R, spin, aOnePiece * 0.14)
      }
      if (aPokemon > 0.004) {
        drawPokeball(g, cx, cy, R * 0.86, aPokemon)
        drawIndexFrame(g, cx, cy, R * 0.86, aPokemon * 0.75)
      }

      if (!reduced) raf = requestAnimationFrame(draw)
    }

    drawRef.current = draw
    if (!reduced) window.addEventListener('pointermove', onPointerMove)
    draw()

    return () => {
      drawRef.current = null
      window.removeEventListener('pointermove', onPointerMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  )
}
