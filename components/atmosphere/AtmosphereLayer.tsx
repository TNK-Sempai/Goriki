'use client'

import { usePathname } from 'next/navigation'
import AtmosphereCanvas from './AtmosphereCanvas'
import { useUniverse } from '@/components/universe/UniverseProvider'
import { PREFIXE_ADMIN } from '@/lib/constants'

/**
 * Le canvas d'atmosphère lui-même, SANS le filtrage par route.
 *
 * Extrait pour la fiche produit : elle vit à la racine (`/{id}`) et choisit son
 * fond d'après l'univers résolu en base, pas d'après son chemin. Son layout
 * monte donc soit un motif d'univers, soit CE composant pour un scellé — qui
 * n'a pas de cartographie à lui.
 *
 * Partout ailleurs, c'est `AtmosphereLayer` ci-dessous qui décide, et lui seul.
 */
export function AtmosphereBackdrop() {
  const { universe, transitioning } = useUniverse()

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

/**
 * Monte le canvas d'atmosphère derrière tout le parcours PUBLIC.
 *
 * C'est la pièce qui manquait : `AtmosphereCanvas` existait depuis le portage
 * visuel mais n'était importé nulle part — le morph d'univers ne tournait donc
 * sur aucun écran.
 *
 * Exclu de l'admin (verrouillé en dark, ces halos y seraient parasites) et des
 * écrans de paiement, où rien ne doit distraire.
 *
 * Exclu AUSSI des deux rayons d'univers, qui portent désormais leur PROPRE
 * cartographie dessinée, plus détaillée que ce canvas :
 *   · `/catalogue/onepiece` → carte marine et sa rose des vents ;
 *   · `/catalogue/pokemon`  → fond géométrique Poké Ball.
 * Sans ces exclusions, deux motifs du même univers se superposeraient. Chaque
 * préfixe est le MÊME que celui du layout qui monte le fond correspondant : les
 * deux ne peuvent pas diverger, et une route ajoutée plus tard hérite des deux.
 *
 * Partout ailleurs — home, dépôt-vente, scellés, rachat, compte… — la couche
 * reste active : ces écrans n'ont pas de fond dessiné à eux.
 */
const EXCLUDED = [PREFIXE_ADMIN, '/checkout', '/catalogue/onepiece', '/catalogue/pokemon']

/**
 * La fiche produit fait exception au raisonnement par préfixe, et c'est
 * structurel : depuis ARCHI-01 elle est indexée sur l'id de la variante, à la
 * RACINE du site (`/{uuid}`). Il n'y a aucun préfixe à exclure, et l'univers ne
 * se lit pas dans le chemin — il faut la base pour savoir si `/{uuid}` est une
 * carte Pokémon, une One Piece ou un scellé.
 *
 * On rend donc la main : sur toutes les routes de cette forme,
 * `app/[slug]/layout.tsx` monte lui-même le fond qui convient — motif
 * d'univers, ou `AtmosphereBackdrop` pour un scellé, qui n'en a pas. Un seul
 * fond par page, comme ailleurs.
 *
 * Le test porte sur la forme d'un UUID en segment unique : les autres routes
 * racine du site (`/panier`, `/login`, `/recherche`…) sont des segments
 * statiques, que Next fait gagner sur `[slug]` et qu'aucun UUID n'imite.
 */
const FICHE_PRODUIT = /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function AtmosphereLayer() {
  const pathname = usePathname()

  if (EXCLUDED.some(p => pathname.startsWith(p))) return null
  if (FICHE_PRODUIT.test(pathname)) return null

  return <AtmosphereBackdrop />
}
