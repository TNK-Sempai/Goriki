'use client'

import { useState } from 'react'

/**
 * Scène de scan — colonne gauche de la case 4 de la planche de référence.
 *
 * La planche pose une BANDE DE VIGNETTES verticale à l'extrême gauche, le scan
 * en grand à côté, et une rangée de contrôles en dessous (Recto/Verso, zoom,
 * plein écran). C'est cette anatomie qui est reproduite ici.
 *
 * `CardViewer` (manipulation 3D, signature motion n° 6) reste utilisé dès qu'un
 * VRAI scan verso existe — cf. la règle photo du CLAUDE.md. Ce composant sert
 * les pièces qui n'ont qu'un recto : il ne simule pas un verso qui n'existe pas,
 * il affiche la bande avec la seule vignette disponible.
 */
export default function ScanStage({
  images,
  altText,
  reference,
}: {
  /** Scans réellement disponibles, recto d'abord */
  images: { url: string; label: string }[]
  altText: string
  reference: string
}) {
  const [active, setActive] = useState(0)
  const [zoom, setZoom] = useState(false)

  const current = images[active]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3">
        {/* Bande de vignettes — verticale, à gauche du scan. */}
        <div className="flex shrink-0 flex-col gap-2">
          {images.map((img, i) => (
            <button
              key={img.label}
              type="button"
              onClick={() => setActive(i)}
              aria-label={img.label}
              aria-pressed={i === active}
              className="overflow-hidden rounded-[6px] border transition-colors"
              style={{
                borderColor: i === active ? 'var(--color-ochre)' : 'rgba(26,22,17,0.14)',
                opacity: i === active ? 1 : 0.72,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- vignette de la bande de scans */}
              <img src={img.url} alt="" aria-hidden className="h-[74px] w-[53px] object-cover" />
            </button>
          ))}
        </div>

        {/* Scan principal */}
        <div className="glass flex flex-1 items-center justify-center overflow-hidden rounded-panel-lg p-5">
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element -- scan transformé au zoom
            <img
              src={current.url}
              alt={altText}
              onClick={() => setZoom(z => !z)}
              className="max-h-[440px] w-auto cursor-zoom-in rounded-[8px] object-contain shadow-[0_30px_60px_-26px_rgba(26,22,17,0.6)] transition-transform duration-500"
              style={{ transform: zoom ? 'scale(1.35)' : 'none' }}
            />
          ) : (
            <div className="scan-pending flex aspect-[2.5/3.5] w-[240px] items-center justify-center rounded-[8px]">
              <span className="data text-[9px]">scan à venir</span>
            </div>
          )}
        </div>
      </div>

      {/* Rangée de contrôles */}
      <div className="flex flex-wrap items-center gap-2">
        {images.map((img, i) => (
          <button
            key={img.label}
            type="button"
            onClick={() => setActive(i)}
            className="pill font-mono !text-[10px] uppercase !tracking-[0.1em]"
            data-active={i === active}
          >
            {img.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setZoom(z => !z)}
          className="pill font-mono !text-[10px] uppercase !tracking-[0.1em]"
          data-active={zoom}
        >
          {zoom ? 'Réduire' : 'Zoom'}
        </button>
        <span className="data ml-auto text-[9px]">{reference}</span>
      </div>
    </div>
  )
}
