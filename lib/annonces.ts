/**
 * Ce qu'est une annonce CHIFFRÉE, et quand une annonce masquée faute de prix
 * revient en vente. SOURCE UNIQUE des deux règles.
 *
 * POURQUOI CE FICHIER EXISTE
 * « Prix à zéro » ne veut pas dire « gratuit », il veut dire « pas encore
 * chiffré ». La règle était déjà écrite à sept endroits, chacun avec sa propre
 * formulation : `price > 0` dans les requêtes publiques, `prix <= 0` dans
 * l'admin, `!Number.isFinite` dans les formateurs. Un huitième lecteur, la
 * grille du catalogue, l'avait tout simplement oubliée, et 108 annonces
 * Pokémon en stock à 0 € s'affichaient en boutique. La règle vit maintenant
 * ici, et les gardes serveur s'y réfèrent.
 *
 * Les deux univers se disent pareil, malgré ce que laissait entendre le brief :
 * `onepiece_listings.price` et `pokemon_listings.price` sont tous deux NOT NULL
 * (défaut 0 côté Pokémon). Aucune annonce n'a de prix NULL en base. Le type
 * accepte quand même `null` et `undefined` : une jointure absente, un champ non
 * demandé dans un `select`, et la valeur arrive indéfinie sans qu'aucune erreur
 * ne soit levée.
 */

/** Un prix existe s'il est un nombre fini strictement positif. Rien d'autre. */
export function estChiffre(prix: number | null | undefined): boolean {
  return typeof prix === 'number' && Number.isFinite(prix) && prix > 0
}

export interface AnnonceVendable {
  price: number | null | undefined
  quantity: number | null | undefined
  is_active: boolean | null | undefined
}

/**
 * Vendable = visible, en stock ET chiffrée. Les trois, toujours.
 *
 * Le masquage par `is_active` est déjà appliqué par la RLS pour un visiteur,
 * mais un administrateur connecté lit TOUT : le garde doit donc rester dans le
 * code, sinon la boutique changerait de contenu selon qui la regarde.
 */
export function estVendable(a: AnnonceVendable): boolean {
  return a.is_active === true && (a.quantity ?? 0) > 0 && estChiffre(a.price)
}

/** Refus opposé au client. Un seul libellé, panier et paiement. */
export const REFUS_NON_CHIFFREE = (nom: string) => `${nom} n'est pas encore en vente`

export interface EtatAnnonce {
  price: number | null | undefined
  quantity: number | null | undefined
  is_active: boolean | null | undefined
}

/**
 * Une annonce masquée faute de prix doit-elle repasser en vente ?
 *
 * ARBITRAGE DU PROPRIÉTAIRE (2026-09-27). Aucune colonne n'enregistre POURQUOI
 * une annonce est masquée, et il a tranché : la combinaison fait foi. Une
 * annonce masquée, à zéro, avec du stock, EST une annonce en attente de prix.
 * Vérifié en base au moment de la décision : sur les 937 annonces masquées, 937
 * répondaient à cette signature, et aucune annonce masquée ne portait de prix.
 *
 * Trois conditions sur l'état AVANT, et elles sont cumulatives :
 *   · masquée : on ne touche jamais à une annonce déjà en vente ;
 *   · non chiffrée : une annonce masquée AVEC un prix l'a été pour une autre
 *     raison, et on la laisse tranquille ;
 *   · en stock : sans stock il n'y a rien à mettre en vente.
 *
 * Et deux sur ce qui est enregistré :
 *   · le prix devient réel ;
 *   · le stock reste réel après la mise à jour, car la même sauvegarde peut
 *     très bien remettre le stock à zéro.
 *
 * CE QUE LA RÈGLE NE FAIT PAS, ET POURQUOI. Elle ne regarde pas la case
 * « actif » envoyée par l'écran de saisie. J'avais commencé par là, en me
 * disant qu'un `is_active: false` explicite devait l'emporter. Le test l'a
 * démenti : la fiche d'annonce renvoie TOUJOURS la valeur courante, donc
 * `false` sur une annonce masquée, sans que personne ait touché à la case. La
 * respecter aurait désactivé l'automatisme précisément là où il est demandé.
 * Et dans l'autre sens, un `is_active: true` explicite donne déjà le même
 * résultat que l'automatisme. Le paramètre ne pouvait donc jamais changer
 * l'issue : une branche morte qui avait l'air d'un garde-fou.
 *
 * Conséquence assumée : chiffrer une annonce masquée la met en vente. Pour la
 * chiffrer en la gardant masquée, il faut décocher « actif » et enregistrer une
 * seconde fois.
 */
export function doitRepasserEnVente(
  avant: EtatAnnonce,
  apres: { price: number | null | undefined; quantity: number | null | undefined },
): boolean {
  if (avant.is_active !== false) return false
  if (estChiffre(avant.price)) return false
  if ((avant.quantity ?? 0) <= 0) return false
  if (!estChiffre(apres.price)) return false
  if ((apres.quantity ?? 0) <= 0) return false
  return true
}
