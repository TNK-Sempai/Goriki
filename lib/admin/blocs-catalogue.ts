import type { SetNettoyage } from '@/components/admin/catalogue/types'
import { etatDeLEcart } from '@/components/admin/catalogue/types'

/**
 * ─── GROUPEMENT DU CATALOGUE PAR BLOC ─────────────────────────────────────
 *
 * Un collectionneur ne pense pas en suite chronologique plate, il pense en
 * BLOCS. Et la liste plate n'est pas seulement moins familière : elle est
 * activement illisible, parce que trois blocs s'étalent sur toute la période et
 * hachent tous les autres en s'intercalant — Kits du dresseur (2004 → 2017),
 * Collection McDonald's (2011 → 2024), POP (2003 → 2009). Groupés, ils cessent
 * de couper les blocs qu'ils traversent.
 *
 * Ordre : les blocs par la date de leur PREMIER set, les sets par parution
 * croissante à l'intérieur. Un bloc sans aucune date part en fin.
 *
 * Le tri chronologique plat n'est pas supprimé — il reste l'ordre de travail,
 * accessible d'un clic. Seul le défaut change.
 *
 * Logique PURE et hors du composant : c'est ce qui permet de la confronter
 * directement aux 185 sets de la base sans monter de rendu.
 */

export interface Bloc {
  nom: string
  sets: SetNettoyage[]
  /** Date du premier set — clé de tri des blocs. `''` quand le bloc n'a aucune date. */
  premier: string
  dernier: string
  cartes: number
  corrigees: number
  aCompleter: number
}

/** Année de début → année de fin, réduite à une seule quand elles coïncident. */
export function periode(b: Bloc): string {
  if (!b.premier) return '—'
  const a = b.premier.slice(0, 4)
  const z = b.dernier.slice(0, 4)
  return a === z ? a : `${a} – ${z}`
}

/**
 * `lignes` doit arriver TRIÉE par parution croissante : l'ordre d'insertion
 * dans chaque seau est alors l'ordre de parution, et aucun second tri n'est
 * nécessaire à l'intérieur d'un bloc.
 */
export function grouperEnBlocs(lignes: SetNettoyage[]): Bloc[] {
  const seaux = new Map<string, SetNettoyage[]>()
  for (const s of lignes) {
    const nom = s.serie_name?.trim() || 'Sans bloc'
    const seau = seaux.get(nom)
    if (seau) seau.push(s)
    else seaux.set(nom, [s])
  }

  return [...seaux.entries()]
    .map(([nom, sets]) => {
      const dates = sets.map(s => s.release_date).filter((d): d is string => !!d)
      return {
        nom,
        sets,
        premier: dates[0] ?? '',
        dernier: dates[dates.length - 1] ?? '',
        cartes: sets.reduce((n, s) => n + s.cartes, 0),
        corrigees: sets.reduce((n, s) => n + s.cartes_corrigees, 0),
        aCompleter: sets.filter(s => etatDeLEcart(s) === 'manquant').length,
      }
    })
    .sort((a, b) => {
      if (!a.premier && !b.premier) return a.nom.localeCompare(b.nom)
      if (!a.premier) return 1
      if (!b.premier) return -1
      return a.premier.localeCompare(b.premier)
    })
}

/**
 * Ordre de travail : chronologique croissant sur la parution. Sans date, en fin
 * de liste, départagé par le code.
 *
 * Écrit ici et non dans le composant parce que `grouperEnBlocs` en DÉPEND :
 * les deux modes d'affichage partagent le même tri de base, et les séparer
 * ferait diverger l'ordre à l'intérieur des blocs de celui de la liste plate.
 */
export function comparerParParution(a: SetNettoyage, b: SetNettoyage): number {
  if (!a.release_date && !b.release_date) return a.code.localeCompare(b.code)
  if (!a.release_date) return 1
  if (!b.release_date) return -1
  return a.release_date.localeCompare(b.release_date)
}
