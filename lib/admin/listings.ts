/**
 * Forme d'un EXEMPLAIRE admin, telle que la sert `GET /api/listings` — et les
 * seuls accesseurs autorisés pour la lire.
 *
 * ─── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────────
 *
 * Depuis ARCHI-01, `pokemon_listings` ne porte plus `card_id`, `variant_type_id`
 * ni `image_api` : l'exemplaire rejoint la carte PAR SA VARIANTE.
 *
 *   pokemon_listings.variant_id
 *     → pokemon_card_variants (image_url générée)
 *       → pokemon_cards (name_fr, number, rarity)
 *
 * La route a suivi ; trois écrans ne l'ont pas suivie et ont continué de lire
 * `l.pokemon_cards`, `l.pokemon_variant_types` et `l.image_api`. MESURÉ sur le
 * payload réel du set SV10 (245 exemplaires) : ces trois champs valent
 * `undefined`. Rien ne lève d'erreur — une propriété absente rend `undefined`,
 * et l'écran affiche `#`, `—`, `—` et une vignette vide, pendant que stock,
 * prix, état et actif s'affichent très bien puisqu'ils sont, eux, au premier
 * niveau. C'est la signature exacte du défaut signalé.
 *
 * Trois lecteurs ont divergé séparément, donc la forme est décrite ICI, une
 * fois. Un quatrième écran qui relira l'exemplaire passera par ces accesseurs.
 *
 * One Piece n'a pas été refondu : sa chaîne reste plate (`onepiece_cards`,
 * `onepiece_variant_types`, `image_api` sur l'exemplaire). Les accesseurs
 * couvrent les DEUX univers, c'est tout leur intérêt.
 */

export interface CarteAdmin {
  id: string
  number: string
  name_fr: string
  rarity: string | null
  set_id: string
  /** Clés de tri naturel — colonnes GÉNÉRÉES, Pokémon uniquement. */
  sort_prefix?: string | null
  sort_num?: number | null
}

export interface VarianteAdmin {
  id: string
  code: string
  label: string
}

/** Le maillon Pokémon : la carte et le type de variante pendent de la VARIANTE. */
export interface VarianteJointe {
  id: string
  image_url: string | null
  pokemon_cards: CarteAdmin | CarteAdmin[]
  pokemon_variant_types: VarianteAdmin | VarianteAdmin[]
}

export interface ListingAdmin {
  id: string
  quantity: number
  price: number
  condition: string
  copy_index?: number
  needs_photo: boolean
  is_active: boolean
  front_photo_url: string | null
  back_photo_url?: string | null
  /** Pokémon — l'embed `!inner` remonte un OBJET (vérifié), le tableau est une sécurité. */
  pokemon_card_variants?: VarianteJointe | VarianteJointe[] | null
  onepiece_cards?: CarteAdmin | CarteAdmin[] | null
  onepiece_variant_types?: VarianteAdmin | VarianteAdmin[] | null
  /** One Piece uniquement : là, l'exemplaire porte encore son visuel d'API. */
  image_api?: string | null
}

/**
 * Aplatit un embed PostgREST.
 *
 * Vérifié sur le payload réel : `pokemon_card_variants` remonte un OBJET. Mais
 * PostgREST rend un objet OU un tableau selon la cardinalité qu'il déduit des
 * clés étrangères, et le projet s'est déjà fait prendre (voir le même helper
 * dans `lib/catalogue/series.ts`). On aplatit sans supposer.
 */
export function seul<T>(v: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(v)) return v[0]
  return v ?? undefined
}

/** La carte d'un exemplaire, quel que soit l'univers. */
export function carteDuListing(l: ListingAdmin): CarteAdmin | undefined {
  return seul(seul(l.pokemon_card_variants)?.pokemon_cards) ?? seul(l.onepiece_cards)
}

/** Le type de variante d'un exemplaire, quel que soit l'univers. */
export function varianteDuListing(l: ListingAdmin): VarianteAdmin | undefined {
  return seul(seul(l.pokemon_card_variants)?.pokemon_variant_types) ?? seul(l.onepiece_variant_types)
}

/**
 * Le visuel à montrer pour un exemplaire, par ordre de préférence :
 * le scan réel de la pièce, sinon le visuel de la VARIANTE (colonne générée
 * `image_url`, qui arbitre déjà entre `image_manuelle` et `image_api`), sinon
 * le champ plat de One Piece.
 *
 * Le scan passe devant : c'est la pièce qu'on vend, pas l'illustration de
 * référence.
 */
export function visuelDuListing(l: ListingAdmin): string | null {
  return l.front_photo_url ?? seul(l.pokemon_card_variants)?.image_url ?? l.image_api ?? null
}

/**
 * Ordre de lecture d'une liste d'exemplaires : par numéro de carte, puis par
 * variante, puis par exemplaire.
 *
 * Le tri se fait ICI et non dans la requête, et c'est mesuré :
 * `.order('number', { referencedTable: 'pokemon_card_variants.pokemon_cards' })`
 * est SANS EFFET sur les lignes de premier niveau — il ordonne l'intégré, pas
 * la requête. Comparé sur SV10, la suite renvoyée avec et sans ce `.order()`
 * est identique, et elle n'est pas croissante.
 *
 * `sort_prefix` / `sort_num` plutôt que `number` : ce sont des colonnes
 * générées faites pour ça, et un tri texte serait faux sur la plupart du
 * catalogue — 143 des 182 sets ont des numéros de longueurs différentes
 * (« 9 » et « 102 » dans le même set), où le texte range « 102 » avant « 9 ».
 */
export function comparerParCarte(a: ListingAdmin, b: ListingAdmin): number {
  const ca = carteDuListing(a)
  const cb = carteDuListing(b)

  const pa = ca?.sort_prefix ?? ''
  const pb = cb?.sort_prefix ?? ''
  if (pa !== pb) return pa.localeCompare(pb)

  const na = ca?.sort_num
  const nb = cb?.sort_num
  if (typeof na === 'number' && typeof nb === 'number' && na !== nb) return na - nb

  // Repli pour One Piece, qui n'a pas de clés générées : comparaison numérique
  // du numéro brut, qui range « 9 » avant « 102 » là où le texte ferait l'inverse.
  const brut = (ca?.number ?? '').localeCompare(cb?.number ?? '', 'fr', { numeric: true })
  if (brut !== 0) return brut

  const va = varianteDuListing(a)?.label ?? ''
  const vb = varianteDuListing(b)?.label ?? ''
  if (va !== vb) return va.localeCompare(vb)

  return (a.copy_index ?? 0) - (b.copy_index ?? 0)
}
