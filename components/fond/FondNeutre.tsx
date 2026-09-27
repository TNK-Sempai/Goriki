/**
 * La nappe illustrée des pages neutres.
 *
 * Volontairement muet : il ne porte QUE la classe. L'image, le point de
 * bascule entre la version large et la version portrait, la taille et le voile
 * vivent dans `.fond-neutre` (`styles/globals.css`). Un composant qui
 * calculerait sa largeur en JavaScript aurait deux défauts que le CSS n'a pas :
 * il chargerait la mauvaise image le temps de l'hydratation, et il pourrait
 * charger les deux.
 *
 * Deux points de montage, un seul rendu :
 *   · `FondNeutreAuto`, monté une fois dans le layout racine, décide d'après la
 *     route pour tout le parcours public et le compte ;
 *   · `app/[slug]/layout.tsx` le monte lui-même pour un produit scellé, parce
 *     que l'univers d'une fiche ne se lit pas dans son chemin mais en base.
 *
 * `dense` renforce le voile sur les écrans qu'on vient lire. Le composant ne
 * décide pas lequel : c'est `fondDense()` dans `lib/fond.ts`.
 */
export default function FondNeutre({ dense = false }: { dense?: boolean }) {
  return <div aria-hidden="true" className="fond-neutre" data-dense={dense ? 'true' : undefined} />
}
