'use client'

import { usePathname } from 'next/navigation'
import AtmosphereCanvas from './AtmosphereCanvas'
import { useUniverse } from '@/components/universe/UniverseProvider'

/**
 * Monte le canvas d'atmosphère derrière tout le parcours PUBLIC.
 *
 * C'est la pièce qui manquait : `AtmosphereCanvas` existait depuis le portage
 * visuel mais n'était importé nulle part — le morph d'univers ne tournait donc
 * sur aucun écran.
 *
 * Exclu de l'admin (verrouillé en dark, ces halos y seraient parasites) et des
 * écrans de paiement, où rien ne doit distraire.
 */
const EXCLUDED = ['/admin', '/checkout']

export default function AtmosphereLayer() {
  const pathname = usePathname()
  const { universe, transitioning } = useUniverse()

  if (EXCLUDED.some(p => pathname.startsWith(p))) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        opacity: transitioning ? 1 : 0.72,
        transition: 'opacity 0.9s cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      <AtmosphereCanvas universe={universe} intensity={transitioning ? 1 : 0} />
    </div>
  )
}
