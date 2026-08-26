export interface SetNettoyage {
  set_id: string
  code: string
  name_fr: string
  serie_name: string | null
  release_date: string | null
  card_count: number | null
  cartes: number
  cartes_corrigees: number
  variantes: number
  variantes_sans_visuel: number
  champs_set_corriges: number
  types_restreints: number
  locked_fields: string[]
  /** Visuels du set. Lus à part : la RPC d agrégation est hors périmètre. */
  image_url: string | null
  symbol_url: string | null
}

export interface TypeVariante {
  id: string
  code: string
  label: string
  sort_order: number | null
  /**
   * `api` — l'un des 11 types que TCGdex décrit et qu'un réimport peut
   * reprendre. `manuel` — relevé sur une checklist et saisi ici : aucun import
   * ne le recréera s'il disparaît. La distinction n'est pas décorative, elle
   * dit ce qu'on perd en supprimant le type.
   */
  source?: 'api' | 'manuel'
}

export type EtatEcart = 'complet' | 'manquant' | 'sous-blocs'

/**
 * Nature de l'écart entre les cartes RÉELLEMENT en base et le nombre annoncé.
 *
 * Deux natures, à ne jamais confondre :
 *   · NÉGATIF — des cartes manquent à l'import. 12 sets, 346 cartes.
 *     JUMBO −160, TK-HS-R −29, TK-HS-G −29, BASEP −27, RC −25… C'est une
 *     anomalie à traiter.
 *     (Les quatre premiers de cette liste étaient auparavant B1, B2, B1A et
 *     B2A — des sets TCG Pocket, supprimés depuis. Un exemple chiffré vieillit
 *     avec la base : il se relit à chaque purge.)
 *   · POSITIF — `card_count` compte le set OFFICIEL, sans ses sous-blocs :
 *     Galeries TG (+30 sur SWSH9/10/11/12), Galerie GG (+70 sur SWSH12.5),
 *     Coffre Étincelant (+122 sur SWSH4.5), Collection Classique (+25 sur
 *     CEL25). 7 sets, 337 cartes. Ce n'est PAS une erreur.
 *
 * Les peindre pareil ferait crier au loup sur sept sets sains, et la colonne
 * cesserait d'être lue — c'est-à-dire qu'on perdrait l'outil le plus utile.
 */
export function etatDeLEcart(s: { cartes: number; card_count: number | null }): EtatEcart {
  if (s.card_count === null) return 'complet'
  const ecart = s.cartes - s.card_count
  if (ecart === 0) return 'complet'
  return ecart < 0 ? 'manquant' : 'sous-blocs'
}
