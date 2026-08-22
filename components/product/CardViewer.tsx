'use client'

import { useEffect, useRef, useState } from 'react'
import { shineGradient, rarityTier } from '@/lib/rarity'

/**
 * Viewer d'inspection — pour les cartes ≥ 1 € disposant d'un scan verso.
 * Règle photo du CLAUDE.md : flip seulement si photo verso. Sans verso, la
 * fiche sert `ScanStage` (bande de vignettes + zoom). `CardFlip` n'est plus
 * appelé nulle part depuis la refonte du 2026-08-21 — cf. signalement au LOG.
 *
 * Drag = rotation X/Y · molette = zoom · double-clic = reset.
 *
 * Issu du handoff Claude Design. Le comportement est repris à l'identique ;
 * les rayons plats (4 px) du handoff sont remappés sur les paliers v3.
 * Le fond sombre est VOULU : c'est une cabine d'inspection, en contraste avec
 * le parchemin de la page — ce n'est pas un reliquat de l'ancienne DA.
 */

interface CardViewerProps {
  frontUrl: string
  backUrl: string
  altText: string
  reference: string
  rarity?: string | null
  /** défauts enregistrés, en % de la surface du recto */
  defects?: { x: number; y: number; label: string }[]
}

const HOME = { rx: -5, ry: 16, zoom: 1 }

export default function CardViewer({ frontUrl, backUrl, altText, reference, rarity, defects = [] }: CardViewerProps) {
  const [view, setView] = useState({ ...HOME, flipped: false })
  const [auto, setAuto] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [pointer, setPointer] = useState({ x: 0.5, y: 0.5 })
  const [showDefects, setShowDefects] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const lastRef = useRef<{ x: number; y: number } | null>(null)

  const foil = rarityTier(rarity) >= 2

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setView(v => ({ ...v, zoom: Math.min(2.6, Math.max(0.6, v.zoom - e.deltaY * 0.0013)) }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // La rotation automatique est une animation continue : neutralisée
  // sous prefers-reduced-motion (doctrine CLAUDE.md v3).
  useEffect(() => {
    if (!auto || dragging) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const tick = () => {
      setView(v => ({ ...v, ry: v.ry + 0.35 }))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [auto, dragging])

  const onMove = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    setPointer({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height })
    if (!dragging || !lastRef.current) return
    const dx = e.clientX - lastRef.current.x
    const dy = e.clientY - lastRef.current.y
    lastRef.current = { x: e.clientX, y: e.clientY }
    setView(v => ({
      ...v,
      ry: v.ry + dx * 0.4,
      rx: Math.min(42, Math.max(-42, v.rx - dy * 0.3)),
    }))
  }

  const controls = [
    { label: view.flipped ? 'Voir le recto' : 'Voir le verso', on: false, act: () => setView(v => ({ ...v, flipped: !v.flipped })) },
    { label: auto ? 'Rotation on' : 'Rotation off', on: auto, act: () => setAuto(a => !a) },
    { label: 'Zoom détail', on: view.zoom > 1.6, act: () => setView(v => ({ ...v, zoom: v.zoom > 1.6 ? 1 : 2.1 })) },
    { label: 'Réinitialiser', on: false, act: () => setView({ ...HOME, flipped: false }) },
  ]

  return (
    <div className="relative overflow-hidden rounded-block border border-[rgba(232,225,216,0.12)] bg-[#16120D]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(232,225,216,0.025) 0 1px, transparent 1px 34px)' }}
      />

      <div className="pointer-events-none absolute inset-x-6 top-5 flex items-start justify-between gap-3">
        <span className="data text-[10px] text-[rgba(232,225,216,0.5)]">{reference} · scan HD recto / verso</span>
        <span className="data text-[10px] text-amber">{view.flipped ? 'Verso' : 'Recto'}</span>
      </div>

      <div
        ref={stageRef}
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); lastRef.current = { x: e.clientX, y: e.clientY }; setDragging(true) }}
        onPointerMove={onMove}
        onPointerUp={() => { lastRef.current = null; setDragging(false) }}
        onPointerLeave={() => { lastRef.current = null; setDragging(false) }}
        onDoubleClick={() => setView({ ...HOME, flipped: false })}
        className="flex h-[460px] touch-none select-none items-center justify-center sm:h-[600px]"
        style={{ perspective: 1500, cursor: dragging ? 'grabbing' : 'grab' }}
      >
        <div
          className="relative aspect-[2.5/3.5] w-[240px] sm:w-[330px]"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateX(${view.rx.toFixed(1)}deg) rotateY(${(view.ry + (view.flipped ? 180 : 0)).toFixed(1)}deg) scale(${view.zoom.toFixed(2)})`,
            transition: dragging ? 'none' : 'transform 0.65s cubic-bezier(0.22,1,0.36,1)',
            // `will-change` seulement pendant la manipulation : permanent, il
            // maintiendrait une couche GPU inutile (doctrine motion).
            willChange: dragging || auto ? 'transform' : 'auto',
          }}
        >
          <div
            className="absolute inset-0 overflow-hidden rounded-control"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              // L'ombre se déporte à l'inverse de l'inclinaison : la carte pèse
              // dans l'espace au lieu de flotter. Une lueur ocre discrète
              // n'apparaît qu'à la manipulation.
              boxShadow: `${(-view.ry % 360) * 0.6}px ${60 + view.rx * 0.8}px 110px -40px rgba(0,0,0,0.75), 0 0 0 1px rgba(232,225,216,0.15)${
                dragging ? ', 0 0 40px -6px rgba(200,134,10,0.35)' : ''
              }`,
              transition: dragging ? 'none' : 'box-shadow 0.5s cubic-bezier(0.22,1,0.36,1)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- surface transformée en 3D : next/image impose un wrapper qui casse le preserve-3d */}
            <img src={frontUrl} alt={altText} draggable={false} className="h-full w-full object-cover" />
            {foil && (
              <div className="surface-shine" style={{ opacity: dragging ? 0.5 : 0.22, background: shineGradient('foil', pointer.x) }} />
            )}
            {showDefects && defects.map((d, i) => (
              <span
                key={i}
                title={d.label}
                className="absolute -ml-[7px] -mt-[7px] h-3.5 w-3.5 rounded-full border border-amber"
                style={{ left: `${d.x}%`, top: `${d.y}%`, boxShadow: '0 0 0 4px rgba(200,134,10,0.18)', animation: 'var(--animate-marker-in)' }}
              />
            ))}
          </div>

          <div
            className="absolute inset-0 overflow-hidden rounded-control"
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- idem : face arrière du même volume 3D */}
            <img src={backUrl} alt={`${altText} — verso`} draggable={false} className="h-full w-full object-cover" />
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 px-6 pb-6">
        <div className="flex w-full max-w-[420px] items-center gap-3">
          <span className="data text-[9px] text-[rgba(232,225,216,0.4)]">Zoom</span>
          <div className="relative h-0.5 flex-1 bg-[rgba(232,225,216,0.14)]">
            <div className="absolute inset-y-0 left-0 bg-[rgba(232,225,216,0.5)]" style={{ width: `${((view.zoom - 0.6) / 2) * 100}%` }} />
            <span className="absolute -ml-[4.5px] -mt-[4.5px] h-[9px] w-[9px] rounded-full bg-amber" style={{ left: `${((view.zoom - 0.6) / 2) * 100}%`, top: '50%' }} />
          </div>
          <span className="data text-[9px] tracking-[0.1em] text-[rgba(232,225,216,0.45)]">×{view.zoom.toFixed(2).replace('.', ',')}</span>
        </div>

        <p className="data text-center text-[9px] text-[rgba(232,225,216,0.35)]">
          Glissez pour inspecter · molette pour zoomer · double-clic pour réinitialiser
        </p>

        <div className="flex flex-wrap justify-center gap-2">
          {controls.map(b => (
            <button
              key={b.label}
              onClick={b.act}
              className="data rounded-control border px-5 py-2.5 text-[10px] transition-colors"
              style={
                b.on
                  ? { background: 'var(--amber)', color: '#14110D', borderColor: 'var(--amber)' }
                  : { background: 'rgba(232,225,216,0.07)', color: '#E8E1D8', borderColor: 'rgba(232,225,216,0.22)' }
              }
            >
              {b.label}
            </button>
          ))}
          {defects.length > 0 && (
            <button
              onClick={() => setShowDefects(s => !s)}
              className="data rounded-control border px-5 py-2.5 text-[10px] transition-colors"
              style={
                showDefects
                  ? { background: 'rgba(200,134,10,0.18)', color: '#E8E1D8', borderColor: 'rgba(200,134,10,0.5)' }
                  : { background: 'rgba(232,225,216,0.07)', color: '#E8E1D8', borderColor: 'rgba(232,225,216,0.22)' }
              }
            >
              {showDefects ? 'Masquer les défauts' : `Localiser les défauts (${defects.length})`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
