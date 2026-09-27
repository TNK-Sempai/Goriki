import { PREFIXE_ADMIN } from './constants'

/**
 * Quel fond porte une route : SOURCE UNIQUE.
 *
 * POURQUOI CE FICHIER EXISTE
 * Deux couches lisent cette décision : le wallpaper des pages neutres et le
 * canvas d'atmosphère. Tant que la règle vivait en double, une route ajoutée
 * pouvait recevoir les deux fonds, ou aucun. Le code le redoutait déjà : les
 * commentaires d'`AtmosphereLayer` insistaient sur le fait que ses préfixes
 * devaient rester identiques à ceux des layouts d'univers. Ils sont désormais
 * écrits une seule fois.
 *
 * LES QUATRE NATURES
 *   · `univers` : les rayons Pokémon et One Piece, qui portent leur propre
 *     cartographie dessinée. Rien d'autre ne doit s'y superposer.
 *   · `neutre` : tout le reste du parcours public et du compte, qui reçoit le
 *     wallpaper commun.
 *   · `aucun` : le back-office et le tunnel de paiement, où rien ne doit
 *     distraire. Décision antérieure, conservée telle quelle.
 *   · `fiche` : `/{uuid}`. L'univers ne se lit PAS dans le chemin, il faut la
 *     base pour savoir si c'est une carte Pokémon, One Piece ou un scellé.
 *     `app/[slug]/layout.tsx` tranche lui-même et les couches globales se
 *     retirent.
 */
export type NatureDeFond = 'univers' | 'neutre' | 'aucun' | 'fiche'

const UNIVERS = ['/catalogue/pokemon', '/catalogue/onepiece']
const SANS_FOND = [PREFIXE_ADMIN, '/checkout']

/**
 * Le test porte sur la forme d'un UUID en segment unique : les autres routes
 * racine (`/panier`, `/login`, `/cgv`...) sont des segments statiques, que Next
 * fait gagner sur `[slug]` et qu'aucun UUID n'imite.
 */
const FICHE_PRODUIT = /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function natureDuFond(pathname: string): NatureDeFond {
  if (SANS_FOND.some(p => pathname.startsWith(p))) return 'aucun'
  if (UNIVERS.some(p => pathname.startsWith(p))) return 'univers'
  if (FICHE_PRODUIT.test(pathname)) return 'fiche'
  return 'neutre'
}

/**
 * Pages où le voile du wallpaper est RENFORCÉ.
 *
 * Ce sont les écrans qu'on vient lire, pas regarder : documents légaux, espace
 * client, panier. L'illustration y reste présente mais recule nettement,
 * ailleurs elle peut respirer. C'est une décision de lisibilité : sur un
 * paragraphe de contrat, un fond dessiné fatigue vite.
 */
const DENSES = ['/cgv', '/mentions-legales', '/confidentialite', '/retractation', '/compte', '/panier']

export const fondDense = (pathname: string): boolean =>
  DENSES.some(p => pathname === p || pathname.startsWith(`${p}/`))

/**
 * L'accueil garde le canvas d'atmosphère PAR-DESSUS le wallpaper.
 *
 * Il ne sert plus de fond : il ne subsiste que pour la signature motion n° 4,
 * le morph qui s'intensifie pendant la transition vers un univers. Partout
 * ailleurs le wallpaper le remplace, ce qui supprime au passage une boucle
 * d'animation sur une vingtaine d'écrans qui n'en avaient pas l'usage.
 */
export const gardeLeCanvas = (pathname: string): boolean => pathname === '/'
