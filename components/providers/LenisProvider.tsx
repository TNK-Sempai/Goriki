'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import Lenis from 'lenis'

/**
 * Smooth scroll — couche 1 du motion system.
 *
 * Les quatre guards de la doctrine sont tous ici :
 *  - SSR       : l'init vit dans un `useEffect`, jamais au rendu.
 *  - StrictMode: `lenisRef` empêche la double initialisation du double-montage.
 *  - Touch     : le lissage est désactivé sur pointeur grossier — sur mobile il
 *                casse le scroll natif et le rend poisseux.
 *  - Reduced   : `prefers-reduced-motion: reduce` neutralise complètement Lenis.
 *
 * Le scroll natif reste la référence : Lenis ne fait que l'interpoler.
 */
export default function LenisProvider({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (lenisRef.current) return // StrictMode : deuxième montage ignoré

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarse = window.matchMedia('(pointer: coarse)').matches
    if (reduced || coarse) return

    const lenis = new Lenis({
      duration: 1.05,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })
    lenisRef.current = lenis

    let raf = 0
    const loop = (time: number) => {
      lenis.raf(time)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  return <>{children}</>
}
