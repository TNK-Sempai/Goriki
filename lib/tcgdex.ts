const TCGDEX_BASE = 'https://api.tcgdex.net/v2/fr'

export interface TCGdexSet {
  id: string
  name: string
  serie: { id: string; name: string }
  cardCount: { total: number; official: number }
  releaseDate: string
  logo?: string
}

export interface TCGdexCard {
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
}

export async function fetchSets(): Promise<TCGdexSet[]> {
  const res = await fetch(`${TCGDEX_BASE}/sets`, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`TCGdex sets error: ${res.status}`)
  return res.json()
}

export async function fetchSet(setId: string): Promise<TCGdexSet & { cards: TCGdexCard[] }> {
  const res = await fetch(`${TCGDEX_BASE}/sets/${setId}`, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`TCGdex set error: ${res.status}`)
  return res.json()
}

export async function fetchCard(cardId: string): Promise<TCGdexCard> {
  const res = await fetch(`${TCGDEX_BASE}/cards/${cardId}`, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`TCGdex card error: ${res.status}`)
  return res.json()
}
