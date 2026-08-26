const TCGDEX_BASE = 'https://api.tcgdex.net/v2/fr'

// GET /sets et GET /sets/{id} renvoient la même forme de set (le second ajoute `cards`).
// GET /sets/{id} ne renvoie que des RÉSUMÉS de cartes (id, localId, name, image) —
// le détail complet (rarity, category, types, variants) nécessite GET /cards/{id}.
//
// `serie` et `releaseDate` sont OPTIONNELS, et ce n'est pas de la prudence :
// vérifié sur l'API, `GET /sets` ne renvoie que `id`, `name`, `cardCount` et les
// visuels — jamais `serie`. Seul `GET /sets/{id}` la porte. Les déclarer
// obligatoires laissait croire qu'on pouvait filtrer la LISTE par série ; on ne
// peut pas, il faut passer par `fetchSerie`.
export interface TCGdexSet {
  id: string
  name: string
  serie?: { id: string; name: string }
  cardCount: { total: number; official: number }
  releaseDate?: string
  logo?: string
  symbol?: string
}

/** Une série et les sets qui la composent — `GET /series/{id}`. */
export interface TCGdexSerie {
  id: string
  name: string
  sets: { id: string; name: string }[]
}

export interface TCGdexCardBrief {
  id: string
  localId: string
  name: string
  image?: string
}

export interface TCGdexCardVariants {
  normal?: boolean
  reverse?: boolean
  holo?: boolean
  firstEdition?: boolean
  wPromo?: boolean
}

export interface TCGdexCardDetail {
  id: string
  localId: string
  name: string
  image?: string
  rarity?: string
  category?: string
  types?: string[]
  stage?: string
  hp?: number
  illustrator?: string
  variants?: TCGdexCardVariants
}

export async function fetchSets(): Promise<TCGdexSet[]> {
  const res = await fetch(`${TCGDEX_BASE}/sets`, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`TCGdex sets error: ${res.status}`)
  return res.json()
}

export async function fetchSerie(serieId: string): Promise<TCGdexSerie> {
  const res = await fetch(`${TCGDEX_BASE}/series/${serieId}`, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`TCGdex serie error: ${res.status}`)
  return res.json()
}

export async function fetchSet(setId: string): Promise<TCGdexSet & { cards: TCGdexCardBrief[] }> {
  const res = await fetch(`${TCGDEX_BASE}/sets/${setId}`, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`TCGdex set error: ${res.status}`)
  return res.json()
}

export async function fetchCard(cardId: string): Promise<TCGdexCardDetail> {
  const res = await fetch(`${TCGDEX_BASE}/cards/${cardId}`, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`TCGdex card error: ${res.status}`)
  return res.json()
}
