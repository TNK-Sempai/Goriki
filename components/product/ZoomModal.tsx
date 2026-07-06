'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

interface ZoomModalProps {
  imageUrl: string
  alt: string
  onClose: () => void
}

export default function ZoomModal({ imageUrl, alt, onClose }: ZoomModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 p-2 rounded-full bg-surface-1 text-muted hover:text-cream transition-colors"
        onClick={onClose}
        aria-label="Fermer"
      >
        <X size={20} />
      </button>
      <img
        src={imageUrl}
        alt={alt}
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}
