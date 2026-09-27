'use client'

import { usePathname } from 'next/navigation'
import AtmosphereCanvas from './AtmosphereCanvas'
import { useUniverse } from '@/components/universe/UniverseProvider'
import { gardeLeCanvas } from '@/lib/fond'

/**
 * Le canvas d'atmosphère, réduit à ce qu'il sait faire de mieux : le MORPH.
 *
 * CE QUI A CHANGÉ (mission NOVA). Jusqu'ici cette couche servait de fond par
 * défaut à tout le parcours public : elle peignait sa cartographie à 72 %
 * d'opacité sur une vingtaine d'écrans. Ce rôle revient désormais au wallpaper
 * commun (`FondNeutre`), qui est une illustration et non un tracé procédural.
 *
 * Le canvas reste sur la SEULE page d'accueil, et invisible au repos. Il n'y
 * subsiste que pour la signature motion n° 4 : pendant la transition vers un
 * univers, le morph monte à pleine intensité, puis s'efface. C'est la
 * demande exacte du propriétaire, « conservé au-dessus uniquement pour le morph
 * de transition ».
 *
 * Deux conséquences voulues. La cartographie ne se superpose plus jamais au
 * wallpaper en régime permanent, et la boucle `requestAnimationFrame` du canvas
 * ne tourne plus que sur une page au lieu de vingt.
 *
 * Le choix de la route vit dans `lib/fond.ts`, avec celui du wallpaper : les
 * deux couches ne peuvent pas diverger, et une route ajoutée plus tard est
 * traitée une seule fois.
 */
function AtmosphereMorph() {
  const { universe, transitioning } = useUniverse()

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        opacity: transitioning ? 1 : 0,
        transition: 'opacity 0.9s cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      <AtmosphereCanvas universe={universe} intensity={transitioning ? 1 : 0} />
    </div>
  )
}

export default function AtmosphereLayer() {
  const pathname = usePathname()

  if (!gardeLeCanvas(pathname)) return null

  return <AtmosphereMorph />
}
