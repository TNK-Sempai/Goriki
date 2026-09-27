import type { ReactNode } from 'react'
import { OnePieceMapBackground } from '@/components/blocks/OnePieceMapBackground.v3'

/**
 * Fond cartographique de TOUTES les routes One Piece — index des sets, séries,
 * et détail d'un set.
 *
 * Monté ici plutôt que page par page : les trois routes doivent porter le même
 * fond, et `natureDuFond()` (`lib/fond.ts`) classe le préfixe
 * `/catalogue/onepiece` en `univers`, ce qui écarte en bloc le wallpaper commun
 * et le canvas d'atmosphère pour éviter la double rose des vents. Un montage
 * page par page laisserait une route sans aucun motif dès qu'on en ajoute une,
 * alors que le classement par préfixe, lui, s'appliquerait quand même.
 *
 * `fixed inset-0 -z-10` : le fond ne défile pas et reste sous le contenu. Le
 * parchemin du site est porté par `<body>`, dont l'arrière-plan est propagé au
 * canevas de la page — il ne recouvre donc pas ses propres enfants, et la carte
 * se voit. Le rect de mer étant passé dans le groupe d'opacité, le dégradé
 * radial du site reste visible en transparence sous la carte.
 */
export default function OnePieceCatalogueLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <OnePieceMapBackground />
      {children}
    </>
  )
}
