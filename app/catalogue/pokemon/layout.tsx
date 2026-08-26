import type { ReactNode } from 'react'
import { PokemonBallBackground } from '@/components/blocks/PokemonBallBackground'

/**
 * Fond géométrique Poké Ball de TOUTES les routes Pokémon — index des sets,
 * séries, et détail d'un set.
 *
 * Même patron que `app/catalogue/onepiece/layout.tsx` : monté une seule fois
 * pour les trois routes, et `AtmosphereLayer` exclut le préfixe
 * `/catalogue/pokemon` en bloc pour éviter le doublon de motif. Le layout et
 * l'exclusion partagent le même préfixe : ils ne peuvent pas diverger, et une
 * route ajoutée plus tard hérite des deux.
 *
 * UNE DIFFÉRENCE AVEC LE FOND ONE PIECE, ASSUMÉE. La carte marine est en
 * `-z-10` et se glisse sous un contenu resté en flux normal. Ce composant-ci est
 * en `z-0` : à cette profondeur, un `fixed` se peint AU-DESSUS du contenu
 * statique, qui n'est pas positionné. Le contenu doit donc remonter — d'où le
 * `relative z-10` ci-dessous, posé ICI plutôt que dans chaque page.
 *
 * Le SVG ne porte aucun rectangle de fond : le parchemin et le dégradé radial du
 * site transparaissent à travers le motif. Ne pas en ajouter « pour cadrer ».
 */
export default function PokemonCatalogueLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PokemonBallBackground />
      <div className="relative z-10">{children}</div>
    </>
  )
}
