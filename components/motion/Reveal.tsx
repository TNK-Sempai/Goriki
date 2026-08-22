'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * Reveal en cascade à l'entrée dans le viewport — signature « Home ».
 *
 * Anime les enfants DIRECTS, pas le conteneur : la grille garde sa mise en page,
 * seules les cartes montent. Guards : SSR (init en effect), reduced-motion
 * (les éléments restent simplement visibles), cleanup par `ctx.revert()` qui
 * restaure les styles inline posés par GSAP.
 */
export default function Reveal({
  children,
  className = '',
  stagger = 0.08,
  y = 18,
}: {
  children: ReactNode
  className?: string
  stagger?: number
  y?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const el = ref.current
    if (!el) return

    // Sans mouvement : rien n'est masqué, rien n'est animé.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    gsap.registerPlugin(ScrollTrigger)

    const ctx = gsap.context(() => {
      gsap.from(Array.from(el.children), {
        opacity: 0,
        y,
        duration: 0.55,
        ease: 'power2.out',
        stagger,
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          once: true,
        },
      })
    }, el)

    return () => ctx.revert()
  }, [stagger, y])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
