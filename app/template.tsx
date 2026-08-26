/**
 * Transition de page — signature « Home → Univers ».
 *
 * ⚠️ Ce fichier DOIT rester `template.tsx`. Placé dans `layout.tsx`, il ne
 * serait pas remonté à la navigation et la transition ne jouerait JAMAIS
 * (erreur critique documentée par le motion system).
 *
 * ── CE QUI A CHANGÉ, ET POURQUOI ────────────────────────────────────────
 *
 * La version précédente enveloppait `children` dans un
 * `<AnimatePresence mode="wait" initial={false}>` avec une animation de sortie.
 * Elle ne jouait rien du tout. Mesuré image par image sur un build de
 * production : entre le clic et l'arrivée de la page suivante, AUCUN état
 * intermédiaire, et le contenu apparaissait déjà à `opacity: 1`.
 *
 * La raison tient en une phrase : un `template.tsx` est REMONTÉ à chaque
 * navigation, donc l'`AnimatePresence` l'était aussi. Il ne voyait jamais
 * d'enfant « sortir » — il se montait à neuf, avec un enfant en premier
 * montage, que `initial={false}` avait justement pour effet de ne pas animer.
 * Les deux réglages s'annulaient l'un l'autre.
 *
 * L'animation de sortie, elle, n'aurait rien arrangé même si elle avait pu
 * jouer : `mode="wait"` attend la fin de la sortie avant de monter la page
 * suivante. On aurait ajouté une attente là où le problème rapporté était
 * déjà la lenteur.
 *
 * ── CE QUE FAIT CE FICHIER MAINTENANT ───────────────────────────────────
 *
 * Rien de visible, et c'est voulu. Sa seule fonction est d'être remonté :
 * cela garantit un sous-arbre neuf à chaque navigation, donc un élément
 * `<main>` neuf, donc le rejeu de l'animation d'apparition définie en CSS
 * (`styles/globals.css`, règle `main`). Un seul mécanisme d'apparition pour
 * tout le site, en CSS — pas de seconde grammaire d'animation, pas de coût
 * JavaScript par page, et l'extinction sous `prefers-reduced-motion` est déjà
 * assurée par la règle globale qui ramène toute animation à 0,01 ms.
 *
 * Ce mécanisme couvre les DEUX moments de la navigation, ce que le wrapper
 * animé ne pouvait pas faire : l'arrivée du squelette de `loading.tsx`, puis
 * son remplacement par le contenu réel. Chacun monte son propre `<main>`.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
