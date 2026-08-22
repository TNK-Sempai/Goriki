/**
 * Client Poneglyphe — source One Piece de Goriki.
 *
 * Remplace l'API OPECards (domaine `api.opecards.fr` mort depuis juillet 2026).
 * Poneglyphe est l'API maison : https://tanuki-poneglyph.pages.dev/v1/
 *
 * Ce module ABSORBE trois écarts entre la source et ce qu'attend l'import, pour
 * que la route n'ait pas à les connaître :
 *
 *  1. `/v1/sets/{id}.json` renvoie un objet PLAT (`set_id, name, …, cards`),
 *     pas `{ set, cards[] }`.
 *  2. La source expose toutes les versions d'une carte (Standard, Alternative
 *     Art, Version 2, SP…). Sur 3 467 lignes, seules 1 721 sont `Standard` :
 *     importer le reste écraserait des cartes, la clé d'upsert étant
 *     `(set_id, number)`. Le filtre `version === 'Standard'` est appliqué ICI,
 *     jamais en aval. Vérifié : 0 doublon (set, numéro) après filtrage.
 *  3. Dix des quarante sets exposés sont des coquilles créées par le scraper
 *     pour héberger des variantes promo isolées ; elles se reconnaissent à
 *     `card_count === null` et sont écartées. Filtre volontairement dérivé de la
 *     donnée, pas d'une liste d'exclusion en dur qui périmerait au prochain scraping.
 */

const PONEGLYPHE_BASE = 'https://tanuki-poneglyph.pages.dev'
const API_BASE = `${PONEGLYPHE_BASE}/v1`

/** Version retenue à l'import. Les autres sont ignorées — voir §2 ci-dessus. */
const IMPORTED_VERSION = 'Standard'

/** `set_type` Poneglyphe → libellé de série affiché. Data-driven, pas de regex sur les codes. */
const SERIE_LABELS: Record<string, string> = {
  OP: 'Boosters',
  EB: 'Extra Boosters',
  ST: 'Starter Decks',
  PRB: 'Premium Boosters',
  DPS: 'Double Pack Sets',
  PROMO: 'Promos',
  OTHER: 'Autres',
}

// ── Contrat consommé par la route d'import (inchangé) ───────────────────────

export interface OPESet {
  id: string
  name: string
  code: string
  releaseDate?: string
  cardCount?: number
  image?: string
  /** Dérivé de `set_type` — alimente `onepiece_sets.serie_id` / `serie_name`. */
  serieId?: string
  serieName?: string
}

export interface OPECard {
  id: string
  number: string
  name: string
  image?: string
  rarity?: string
  type?: string
  /** Couleurs aplaties pour l'affichage existant (`onepiece_cards.color`). */
  color?: string
  power?: number
  life?: number
  // Champs que l'ancien mapping OPECards perdait :
  colors?: string[]
  attribute?: string
  cost?: number
  counter?: number
  effect?: string
  triggerEffect?: string
  characterName?: string
  affiliations?: string[]
  abilities?: string[]
  version?: string
}

/** Distingue « source injoignable » d'une erreur HTTP ponctuelle. */
export class OPECardsUnavailableError extends Error {
  constructor(
    message = 'API Poneglyphe injoignable. Import One Piece indisponible.'
  ) {
    super(message)
    this.name = 'OPECardsUnavailableError'
  }
}

// ── Formes brutes renvoyées par Poneglyphe ──────────────────────────────────

interface RawSet {
  set_id: string
  name: string
  set_type: string | null
  release_date: string | null
  card_count: number | null
}

interface RawCard {
  id: string
  card_number: string
  version: string | null
  set_id: string
  name: string
  type: string | null
  colors: string[] | null
  attribute: string | null
  power: number | null
  cost: number | null
  counter: number | null
  life: number | null
  effect: string | null
  trigger_effect: string | null
  rarity: string | null
  character_name: string | null
  affiliations: string[] | null
  abilities: string[] | null
  image: string | null
  block_number: number | null
}

type RawSetDetail = RawSet & { cards: RawCard[] }

async function poneglypheFetch<T>(path: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 3600 } })
  } catch {
    // fetch qui rejette = échec réseau/DNS, pas une erreur HTTP
    throw new OPECardsUnavailableError()
  }
  if (!res.ok) throw new Error(`Poneglyphe error ${res.status} sur ${path}`)
  return res.json()
}

/** Les chemins d'image sont relatifs (`/images/xxx.webp`) et servis à la racine du domaine. */
function absoluteImage(path: string | null): string | undefined {
  if (!path) return undefined
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${PONEGLYPHE_BASE}${path.startsWith('/') ? '' : '/'}${path}`
}

function toSet(raw: RawSet, cardCount?: number): OPESet {
  const type = raw.set_type ?? 'OTHER'
  return {
    id: raw.set_id,
    code: raw.set_id,
    name: raw.name,
    // `release_date` n'est alimenté par aucun scraper Poneglyphe à ce jour :
    // on laisse vide plutôt que d'inventer une date (hors périmètre de corriger la source).
    releaseDate: raw.release_date ?? undefined,
    // `card_count` de la source ne correspond ni au total ni aux Standard
    // (concordant sur 4 sets sur 30) : on préfère le compte réellement importé.
    cardCount: cardCount ?? undefined,
    serieId: type,
    serieName: SERIE_LABELS[type] ?? type,
  }
}

function toCard(raw: RawCard): OPECard {
  const colors = raw.colors ?? []
  return {
    id: raw.id,
    number: raw.card_number,
    name: raw.name,
    image: absoluteImage(raw.image),
    rarity: raw.rarity ?? undefined,
    type: raw.type ?? undefined,
    color: colors.length ? colors.join(' / ') : undefined,
    colors: colors.length ? colors : undefined,
    power: raw.power ?? undefined,
    life: raw.life ?? undefined,
    attribute: raw.attribute ?? undefined,
    cost: raw.cost ?? undefined,
    counter: raw.counter ?? undefined,
    effect: raw.effect ?? undefined,
    triggerEffect: raw.trigger_effect ?? undefined,
    characterName: raw.character_name ?? undefined,
    affiliations: raw.affiliations?.length ? raw.affiliations : undefined,
    abilities: raw.abilities?.length ? raw.abilities : undefined,
    version: raw.version ?? undefined,
  }
}

/**
 * Sets réellement vendables : les coquilles (`card_count === null`) sont écartées.
 * Écarte notamment `OP14`, coquille homonyme du vrai `OP14-EB04`.
 */
export async function fetchOPESets(): Promise<OPESet[]> {
  const raw = await poneglypheFetch<RawSet[]>('/sets.json')
  return raw.filter(s => s.card_count !== null).map(s => toSet(s))
}

/** Détail d'un set, cartes filtrées sur la version Standard. */
export async function fetchOPESet(setId: string): Promise<OPESet & { cards: OPECard[] }> {
  const raw = await poneglypheFetch<RawSetDetail>(`/sets/${setId}.json`)

  if (raw.card_count === null) {
    throw new Error(
      `Le set ${setId} est une coquille de scraping (card_count null) : il n'héberge que des variantes promo isolées, pas un set vendable.`
    )
  }

  const cards = (raw.cards ?? [])
    .filter(c => c.version === IMPORTED_VERSION)
    .map(toCard)

  return { ...toSet(raw, cards.length), cards }
}
