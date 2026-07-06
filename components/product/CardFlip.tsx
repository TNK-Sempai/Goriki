'use client'

import { useState } from 'react'
import ZoomModal from './ZoomModal'

interface CardFlipProps {
  frontUrl: string | null
  backUrl: string | null
  altText: string
}

export default function CardFlip({ frontUrl, backUrl, altText }: CardFlipProps) {
  const [flipped, setFlipped] = useState(false)
  const [zoomed, setZoomed] = useState(false)

  const hasBack = !!backUrl
  // Image visible actuellement (recto ou verso si retourné)
  const visibleUrl = flipped && backUrl ? backUrl : frontUrl

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Flip container */}
      <div
        className="relative cursor-pointer select-none"
        style={{ width: 280, height: 390, perspective: 1000 }}
        onClick={() => hasBack && setFlipped(f => !f)}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Recto */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              borderRadius: 12,
              overflow: 'hidden',
              background: 'var(--surface-2)',
            }}
          >
            {frontUrl ? (
              <img src={frontUrl} alt={altText} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted text-sm">
                Pas d&apos;image
              </div>
            )}
          </div>

          {/* Verso */}
          {hasBack && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                borderRadius: 12,
                overflow: 'hidden',
                background: 'var(--surface-2)',
              }}
            >
              <img src={backUrl!} alt={`${altText} — verso`} className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      </div>

      {hasBack && (
        <p className="text-muted text-xs">
          {flipped ? 'Cliquez pour voir le recto' : 'Cliquez pour voir le verso'}
        </p>
      )}

      {visibleUrl && (
        <button
          onClick={() => setZoomed(true)}
          className="btn btn-ghost btn-sm text-xs text-muted"
        >
          Voir en grand
        </button>
      )}

      {zoomed && visibleUrl && (
        <ZoomModal imageUrl={visibleUrl} alt={altText} onClose={() => setZoomed(false)} />
      )}
    </div>
  )
}
