'use client'

import {
  createContext, useContext, useState, useCallback, useEffect, type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import { getUniverse, type Universe, type UniverseTheme } from '@/lib/universe-theme'

interface UniverseContextValue {
  universe: Universe
  theme: UniverseTheme
  setUniverse: (u: Universe) => void
  toggle: () => void
  /** Monte à 1 pendant une bascule d'univers, retombe à 0 — pilote l'intensité du morph. */
  transitioning: boolean
}

const UniverseContext = createContext<UniverseContextValue | null>(null)

/** La route porte l'univers courant : `/catalogue/onepiece/...` → onepiece. */
function universeFromPathname(pathname: string): Universe | null {
  if (pathname.includes('/onepiece')) return 'onepiece'
  if (pathname.includes('/pokemon')) return 'pokemon'
  return null
}

export function UniverseProvider({
  children,
  initial = 'onepiece',
}: {
  children: ReactNode
  initial?: Universe
}) {
  const pathname = usePathname()
  // Initialisation PARESSEUSE depuis la route : au chargement direct de
  // `/catalogue/pokemon`, l'univers est correct des le premier rendu. Sans ca,
  // le provider partait sur One Piece puis basculait en effect — le canvas
  // dessinait donc la mauvaise cartographie, et une fausse transition de
  // 1,2 s se declenchait a chaque arrivee directe sur une page d'univers.
  const [universe, setUniverse] = useState<Universe>(
    () => universeFromPathname(pathname) ?? initial
  )
  const [transitioning, setTransitioning] = useState(false)

  // Synchronisation sur la route : c'est ce qui déclenche le morph quand on
  // quitte la home pour un univers. Sans ça, le canvas ne changeait jamais d'état.
  useEffect(() => {
    const next = universeFromPathname(pathname)
    if (!next || next === universe) return
    // Synchronisation d'un système EXTERNE (la route) vers l'état visuel, une
    // seule fois par bascule et jamais en cascade : `next === universe` coupe
    // court dès le rendu suivant, et le drapeau retombe seul au bout de 1,2 s.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUniverse(next)
    setTransitioning(true)
    const id = setTimeout(() => setTransitioning(false), 1200)
    return () => clearTimeout(id)
  }, [pathname, universe])

  const toggle = useCallback(
    () => setUniverse(u => (u === 'onepiece' ? 'pokemon' : 'onepiece')),
    []
  )

  return (
    <UniverseContext.Provider
      value={{ universe, theme: getUniverse(universe), setUniverse, toggle, transitioning }}
    >
      {children}
    </UniverseContext.Provider>
  )
}

export function useUniverse(): UniverseContextValue {
  const ctx = useContext(UniverseContext)
  if (!ctx) throw new Error('useUniverse doit être utilisé dans un <UniverseProvider>')
  return ctx
}
