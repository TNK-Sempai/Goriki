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

// Domaine api.opecards.fr mort (DNS ne résout plus) — distingue explicitement
// « API injoignable » d'une simple erreur HTTP ponctuelle sur un endpoint.
export class OPECardsUnavailableError extends Error {
  constructor(message = 'API OPECards injoignable (domaine mort — DNS ne résout plus). Import One Piece indisponible.') {
    super(message)
    this.name = 'OPECardsUnavailableError'
  }
}

async function opeFetch<T>(path: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${OPECARDS_BASE}${path}`, { next: { revalidate: 3600 } })
  } catch {
    // fetch qui rejette (TypeError) = échec réseau/DNS, pas une erreur HTTP
    throw new OPECardsUnavailableError()
  }
  if (!res.ok) throw new Error(`OPECards error ${res.status} sur ${path}`)
  return res.json()
}

export async function fetchOPESets(): Promise<OPESet[]> {
  return opeFetch<OPESet[]>('/sets')
}

export async function fetchOPESet(setId: string): Promise<OPESet & { cards: OPECard[] }> {
  return opeFetch<OPESet & { cards: OPECard[] }>(`/sets/${setId}/cards`)
}
