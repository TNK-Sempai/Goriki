import type { SupabaseClient } from '@supabase/supabase-js'
import type { SetCardData } from '@/components/catalogue/SetGrid'
import { parentsDesRattaches } from '@/lib/catalogue/rattachements'

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
 *
 * Sets rattachés (migration 0057) : absents de la liste, leur stock et leur
 * nombre de cartes s'ajoutent à ceux de leur parent, dont la page les montre.
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

  const parentDe = await parentsDesRattaches(supabase, universe)
  /** Le set sous lequel une carte s'affiche : son parent s'il est rattaché. */
  const setAffiche = (id: string) => parentDe.get(id) ?? id

  // Cartes réellement en vente, avec leur set et leur prix. Filtré côté base :
  // seules les lignes en stock remontent.
  // Depuis ARCHI-01, l'exemplaire Pokémon rejoint la carte par sa VARIANTE ;
  // One Piece garde le chemin direct. Seul le chemin de jointure change : on ne
  // lit ici que le prix et le set, pour les compteurs.
  const { data: live } = await (universe === 'pokemon'
    ? supabase
        .from('pokemon_listings')
        .select('price, quantity, pokemon_card_variants!inner(pokemon_cards!inner(set_id))')
    : supabase
        .from(t.listings)
        .select(`price, quantity, cards:${t.cards}!inner(set_id)`)
  )
    .eq('is_active', true)
    .gt('quantity', 0)
    .gt('price', 0)
    .order('price', { ascending: false })
    .limit(10000)

  // Compteurs de stock uniquement : les VISUELS de la tuile ne viennent plus
  // d'ici (voir `apercus` plus bas). Les tirer des pièces en vente vidait la
  // tuile dès qu'un set n'avait pas de stock — c'est-à-dire presque partout.
  // Les jointures PostgREST peuvent remonter un objet ou un tableau selon la
  // cardinalité déduite : on aplatit systématiquement.
  const seul = (v: unknown): Record<string, unknown> | undefined =>
    (Array.isArray(v) ? v[0] : v) as Record<string, unknown> | undefined

  /** Pokémon : listing → variante → carte. One Piece : listing → carte. */
  const setDeLaLigne = (row: Record<string, unknown>): string | undefined => {
    const carte =
      universe === 'pokemon'
        ? seul(seul(row.pokemon_card_variants)?.pokemon_cards)
        : seul(row.cards)
    return carte?.set_id as string | undefined
  }

  const stock = new Map<string, { n: number; min: number }>()
  for (const row of (live ?? []) as unknown as Record<string, unknown>[]) {
    const setReel = setDeLaLigne(row)
    if (!setReel) continue
    const setId = setAffiche(setReel)
    const prix = Number(row.price ?? 0)
    const cur = stock.get(setId)
    if (cur) {
      cur.n += 1
      cur.min = Math.min(cur.min, prix)
    } else {
      stock.set(setId, { n: 1, min: prix })
    }
  }

  // Trois cartes représentatives par set, prises dans le CATALOGUE et non dans
  // le stock : une tuile montre toujours de quoi le set est fait, même quand
  // rien n'est à vendre (fonction `apercus_de_set`, migration 0031).
  const { data: apercusBruts } = await supabase.rpc('apercus_de_set', { p_universe: universe })

  const apercus = new Map<string, string[]>()
  for (const a of (apercusBruts ?? []) as { set_id: string; image_url: string }[]) {
    const liste = apercus.get(a.set_id)
    if (liste) liste.push(a.image_url)
    else apercus.set(a.set_id, [a.image_url])
  }

  const lignes = sets as unknown as {
    id: string
    code: string
    name_fr: string
    card_count: number | null
    serie_name?: string | null
  }[]

  // Cartes annoncées par groupe : le parent compte aussi celles de ses rattachés.
  const totalDuGroupe = new Map<string, number>()
  for (const raw of lignes) {
    const cible = setAffiche(raw.id)
    totalDuGroupe.set(cible, (totalDuGroupe.get(cible) ?? 0) + (raw.card_count ?? 0))
  }

  const eras = new Map<string, SetCardData[]>()
  for (const raw of lignes) {
    if (parentDe.has(raw.id)) continue
    const s = stock.get(raw.id)
    const era = raw.serie_name?.trim() || 'Autres'
    const card: SetCardData = {
      id: raw.id,
      code: raw.code,
      name_fr: raw.name_fr,
      inStock: s?.n ?? 0,
      total: totalDuGroupe.get(raw.id) ?? 0,
      priceFrom: s?.min ?? null,
      preview: apercus.get(raw.id) ?? [],
    }
    const bucket = eras.get(era)
    if (bucket) bucket.push(card)
    else eras.set(era, [card])
  }

  // Les sets arrivent déjà triés par date décroissante : l'ordre d'insertion
  // des ères reflète donc leur récence.
  return [...eras.entries()].map(([name, list]) => ({ name, sets: list }))
}
