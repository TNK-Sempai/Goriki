import type { SupabaseClient } from '@supabase/supabase-js'
import type { SetCardData } from '@/components/catalogue/SetGrid'

export interface Era {
  name: string
  sets: SetCardData[]
}

const TABLES = {
  pokemon: { sets: 'pokemon_sets', cards: 'pokemon_cards', listings: 'pokemon_listings' },
  onepiece: { sets: 'onepiece_sets', cards: 'onepiece_cards', listings: 'onepiece_listings' },
} as const

/**
 * Séries d'un univers, groupées par ère, avec pour chaque set le stock réel
 * et son prix d'entrée — c'est ce qu'exige la carte de la maquette
 * (barre de progression + « dès X € »).
 *
 * Le groupement se fait sur `serie_name` (décision d'archi #11 : data-driven,
 * jamais de regex sur les codes) et l'ordre des ères suit la date de sortie du
 * set le plus récent de chaque ère — le plus récent en premier, comme la maquette.
 *
 * Les deux univers portent `serie_name` : `pokemon_sets` depuis la migration 0014,
 * `onepiece_sets` depuis la 0022 (alimenté par le `set_type` de Poneglyphe).
 */
export async function getSeriesByEra(
  supabase: SupabaseClient,
  universe: 'pokemon' | 'onepiece'
): Promise<Era[]> {
  const t = TABLES[universe]

  const { data: sets } = await supabase
    .from(t.sets)
    .select('id, code, name_fr, card_count, release_date, serie_name')
    .eq('is_active', true)
    .order('release_date', { ascending: false })

  if (!sets?.length) return []

  // Cartes réellement en vente, avec leur set et leur prix. Filtré côté base :
  // seules les lignes en stock remontent.
  const { data: live } = await supabase
    .from(t.listings)
    .select(`price, quantity, image_api, front_photo_url, cards:${t.cards}!inner(set_id, image_url)`)
    .eq('is_active', true)
    .gt('quantity', 0)
    .gt('price', 0)
    .order('price', { ascending: false })
    .limit(10000)

  // `preview` : jusqu'a 3 visuels par set, pris sur les pieces REELLEMENT en
  // vente et les plus valorisees d'abord. La planche dessine un eventail de
  // cartes dans chaque tuile de set — sans stock, la tuile n'invente rien.
  const stock = new Map<string, { n: number; min: number; preview: string[] }>()
  for (const row of (live ?? []) as unknown as {
    price: number
    image_api: string | null
    front_photo_url: string | null
    cards: { set_id: string; image_url: string | null } | { set_id: string; image_url: string | null }[]
  }[]) {
    const card = Array.isArray(row.cards) ? row.cards[0] : row.cards
    if (!card) continue
    const img = row.front_photo_url ?? row.image_api ?? card.image_url
    const cur = stock.get(card.set_id)
    if (cur) {
      cur.n += 1
      cur.min = Math.min(cur.min, row.price)
      if (img && cur.preview.length < 3) cur.preview.push(img)
    } else {
      stock.set(card.set_id, { n: 1, min: row.price, preview: img ? [img] : [] })
    }
  }

  const eras = new Map<string, SetCardData[]>()
  for (const raw of sets as unknown as {
    id: string
    code: string
    name_fr: string
    card_count: number | null
    serie_name?: string | null
  }[]) {
    const s = stock.get(raw.id)
    const era = raw.serie_name?.trim() || 'Autres'
    const card: SetCardData = {
      id: raw.id,
      code: raw.code,
      name_fr: raw.name_fr,
      inStock: s?.n ?? 0,
      total: raw.card_count ?? 0,
      priceFrom: s?.min ?? null,
      preview: s?.preview ?? [],
    }
    const bucket = eras.get(era)
    if (bucket) bucket.push(card)
    else eras.set(era, [card])
  }

  // Les sets arrivent déjà triés par date décroissante : l'ordre d'insertion
  // des ères reflète donc leur récence.
  return [...eras.entries()].map(([name, list]) => ({ name, sets: list }))
}
