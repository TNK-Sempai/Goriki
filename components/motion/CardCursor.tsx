'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

/**
 * Curseur d'inspection — signature « Catalogue ».
 *
 * Au survol d'une carte de la grille, le curseur devient une pastille « VOIR → ».
 * Le repérage se fait par `[data-card-hover]` : aucun composant n'a besoin de
 * connaître ce curseur, il suffit de porter l'attribut.
 *
 * Guards : monté uniquement si pointeur fin ET mouvement autorisé — sur mobile
 * et sous `prefers-reduced-motion`, le composant ne rend rien et n'écoute rien.
 */

/** Souscription aux media queries qui conditionnent le curseur personnalisé. */
function subscribeToPointer(onChange: () => void) {
  const fine = window.matchMedia('(pointer: fine)')
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  fine.addEventListener('change', onChange)
  reduced.addEventListener('change', onChange)
  return () => {
    fine.removeEventListener('change', onChange)
    reduced.removeEventListener('change', onChange)
  }
}

function isFinePointer() {
  return (
    window.matchMedia('(pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export default function CardCursor() {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)

  // `useSyncExternalStore` plutôt qu'un state posé en effect : la valeur est
  // lue directement de la plateforme, sans rendu en cascade, et vaut `false`
  // au rendu serveur.
  const enabled = useSyncExternalStore(subscribeToPointer, isFinePointer, () => false)

  useEffect(() => {
    if (!enabled) return

    let raf = 0
    const pos = { x: 0, y: 0 }
    const target = { x: 0, y: 0 }

    function onMove(e: PointerEvent) {
      target.x = e.clientX
      target.y = e.clientY
      const el = (e.target as HTMLElement | null)?.closest?.('[data-card-hover]')
      setActive(Boolean(el))
    }

    function loop() {
      // Suivi amorti : le curseur traîne légèrement, ce qui le rend lisible.
      pos.x += (target.x - pos.x) * 0.22
      pos.y += (target.y - pos.y) * 0.22
      if (ref.current) {
        ref.current.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%)`
      }
      raf = requestAnimationFrame(loop)
    }

    window.addEventListener('pointermove', onMove)
    raf = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[60] flex items-center justify-center rounded-full font-mono text-[9px] tracking-[0.14em]"
      style={{
        width: active ? 62 : 0,
        height: active ? 62 : 0,
        opacity: active ? 1 : 0,
        background: 'rgba(26,22,17,0.9)',
        color: '#E8E1D8',
        transition: 'width 0.25s cubic-bezier(0.22,1,0.36,1), height 0.25s cubic-bezier(0.22,1,0.36,1), opacity 0.2s ease',
      }}
    >
      {active ? 'VOIR →' : null}
    </div>
  )
}
