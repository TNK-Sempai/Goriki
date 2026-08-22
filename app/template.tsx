'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { useSyncExternalStore } from 'react'

/**
 * Transition de page — signature « Home → Univers ».
 *
 * ⚠️ Ce fichier DOIT rester `template.tsx`. Placé dans `layout.tsx`,
 * `AnimatePresence` ne serait jamais remonté à la navigation et la transition
 * ne jouerait JAMAIS (erreur critique documentée par le motion system).
 *
 * Le morph d'`AtmosphereCanvas` s'intensifie en parallèle : `UniverseProvider`
 * lève `transitioning` sur changement d'univers, `AtmosphereLayer` densifie le
 * réseau pendant ~1,2 s. C'est le moment où l'univers se révèle.
 *
 * Sous `prefers-reduced-motion`, le contenu est rendu tel quel, sans wrapper animé.
 */

function subscribe(onChange: () => void) {
  const m = window.matchMedia('(prefers-reduced-motion: reduce)')
  m.addEventListener('change', onChange)
  return () => m.removeEventListener('change', onChange)
}

const reducedSnapshot = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const reduced = useSyncExternalStore(subscribe, reducedSnapshot, () => false)

  if (reduced) return <>{children}</>

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
