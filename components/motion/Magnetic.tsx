'use client'

import { useRef, type ReactNode } from 'react'

/**
 * Attraction magnétique légère — signature du CTA principal de la home.
 *
 * L'élément suit le curseur de quelques pixels puis revient à sa place. Volontairement
 * discret : c'est une invitation, pas un jouet.
 *
 * Guards : effet strictement souris (annulé sur pointeur grossier), neutralisé
 * sous `prefers-reduced-motion`, et `will-change` posé au survol / retiré à la
 * sortie — jamais permanent, conformément à la doctrine.
 */
export default function Magnetic({
  children,
  strength = 0.28,
  className = '',
}: {
  children: ReactNode
  strength?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)

  function allowed() {
    if (typeof window === 'undefined') return false
    if (window.matchMedia('(pointer: coarse)').matches) return false
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
    return true
  }

  function onEnter() {
    if (!allowed() || !ref.current) return
    ref.current.style.willChange = 'transform'
  }

  function onMove(e: React.PointerEvent) {
    if (!allowed() || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    ref.current.style.transition = 'transform 0.08s linear'
    ref.current.style.transform = `translate(${(dx * strength).toFixed(1)}px, ${(dy * strength).toFixed(1)}px)`
  }

  function onLeave() {
    if (!ref.current) return
    ref.current.style.transition = 'transform 0.45s cubic-bezier(0.22,1,0.36,1)'
    ref.current.style.transform = 'translate(0px, 0px)'
    ref.current.style.willChange = 'auto'
  }

  return (
    <span
      ref={ref}
      onPointerEnter={onEnter}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`inline-block ${className}`}
    >
      {children}
    </span>
  )
}
