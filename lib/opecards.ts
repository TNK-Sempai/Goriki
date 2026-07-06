const OPECARDS_BASE = 'https://api.opecards.fr'

export interface OPESet {
  id: string
  name: string
  code: string
  releaseDate?: string
  cardCount?: number
  image?: string
}

export interface OPECard {
  id: string
  number: string
  name: string
  image?: string
  rarity?: string
  type?: string
  color?: string
  power?: number
  life?: number
}

export async function fetchOPESets(): Promise<OPESet[]> {
  const res = await fetch(`${OPECARDS_BASE}/sets`, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`OPECards sets error: ${res.status}`)
  return res.json()
}

export async function fetchOPESet(setId: string): Promise<OPESet & { cards: OPECard[] }> {
  const res = await fetch(`${OPECARDS_BASE}/sets/${setId}/cards`, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`OPECards set error: ${res.status}`)
  return res.json()
}
