import { Bloc, Coquille } from '@/components/layout/Squelette'

/**
 * Attente des écrans de catalogue — index des rayons, liste des sets d'un
 * univers, grille de cartes d'un set, scellés.
 *
 * Une seule frontière pour tout `/catalogue` : ces écrans partagent la même
 * composition (titre + champ, rangée de filtres, grille de tuiles en verre),
 * donc le même squelette les sert tous sans mentir sur aucun. En écrire un par
 * segment aurait multiplié les fichiers pour une différence que personne ne
 * voit pendant les 300 ms où il s'affiche.
 *
 * Les proportions sont reprises de `SetsIndex` — hauteur de visuel 168 px,
 * grille 1/2/3 colonnes — pour que le contenu réel se pose SUR le squelette
 * plutôt que de le déplacer. Un squelette aux mauvaises dimensions provoque un
 * saut de mise en page à l'arrivée, ce qui ajoute une brutalité au lieu d'en
 * retirer une.
 */
export default function ChargementCatalogue() {
  return (
    <Coquille>
      <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between lg:mb-9">
        <Bloc className="h-[38px] w-[220px] rounded-[8px]" />
        <Bloc className="h-[42px] w-full rounded-control sm:w-[300px]" />
      </div>

      <div className="mb-7 flex flex-wrap gap-2 lg:mb-9">
        {/* Largeurs écrites en toutes lettres : Tailwind v4 scanne le source
            statiquement, une classe construite (`w-[${'${l}'}px]`) ne serait
            jamais générée et les pilules n'auraient aucune largeur. */}
        {['w-[72px]', 'w-[96px]', 'w-[84px]', 'w-[110px]', 'w-[68px]'].map(l => (
          <Bloc key={l} className={`h-[32px] rounded-control ${l}`} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="glass flex flex-col overflow-hidden rounded-panel-lg">
            <Bloc className="h-[168px] w-full rounded-none" />
            <div className="flex flex-1 flex-col gap-2 px-4 py-3.5">
              <Bloc className="h-[13px] w-[64px]" />
              <Bloc className="h-[12px] w-[70%]" />
              <Bloc className="mt-2 h-[3px] w-full" />
              <Bloc className="mt-1.5 h-[9px] w-[52px]" />
            </div>
          </div>
        ))}
      </div>
    </Coquille>
  )
}
