import type { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchSet,
  fetchCard,
  fetchSerie,
  type TCGdexSet,
  type TCGdexCardBrief,
  type TCGdexCardVariants,
} from '../tcgdex'

// Moteur d'import Pokémon partagé — utilisable depuis une route Next.js ou un script CLI.
// Aucune dépendance à next/* ici (importé tel quel par scripts/import-catalogue-pokemon.ts).

export type LogFn = (line: string) => void

export interface SetImportStats {
  setId: string
  setName: string
  cardsImported: number
  cardsFailed: number
  listingsCreated: number
  errors: { item: string; message: string }[]
  durationMs: number
}

interface VariantTypeRow {
  id: string
  code: string
}

interface ResolvedCard {
  number: string
  name: string
  image: string | null
  rarity: string | null
  category: string | null
  attribute: string | null
  tcgdexId: string
  variants: TCGdexCardVariants | null
}

// ─────────────────────────────────────────────────────────────
// Helpers génériques (pas de dépendance externe)
// ─────────────────────────────────────────────────────────────

function withSuffix(url: string, suffix: string): string {
  return url.match(/\.(png|jpg|jpeg|webp|svg)$/) ? url : `${url}${suffix}`
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const current = cursor++
      results[current] = await fn(items[current])
    }
  }
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, () => worker())
  await Promise.all(workers)
  return results
}

async function fetchCardWithRetry(id: string) {
  try {
    return await fetchCard(id)
  } catch {
    try {
      return await fetchCard(id)
    } catch {
      return null
    }
  }
}

// Résout id→code (ex: 'A1' → 'a1') pour les sets dont l'id API est
// case-sensitive (le code stocké en base = id.toUpperCase()).
export function buildCodeToIdMap(sets: TCGdexSet[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const set of sets) map.set(set.id.toUpperCase(), set.id)
  return map
}

// ─────────────────────────────────────────────────────────────
// Séries hors périmètre boutique
// ─────────────────────────────────────────────────────────────

/**
 * SÉRIES QUE L'IMPORT NE DOIT JAMAIS RAMENER.
 *
 * `tcgp` — « Jeu de Cartes à Collectionner Pokémon Pocket » : JEU MOBILE,
 * CARTES NON PHYSIQUES, HORS PÉRIMÈTRE BOUTIQUE. Ces cartes n'existent que dans
 * une application ; elles n'ont pas de support carton, ne peuvent être ni
 * expédiées, ni rachetées, ni gradées, et ne seront donc jamais vendues ici.
 *
 * ⚠️ Cette ligne n'est PAS un oubli de nettoyage : la retirer réintroduira ses
 * 15 sets (A1, A1a, A2, A2a, A2b, A3, A3a, A3b, A4, A4a, B1, B1a, B2, B2a, P-A)
 * et ~1 785 cartes fantômes au premier import, exactement comme avant la purge
 * du 24 août 2026. Elles réapparaîtraient aussitôt dans le filtre de séries du
 * catalogue public, qui est dérivé de la base.
 *
 * Le filtrage se fait par SÉRIE, jamais par liste de codes en dur : c'est la
 * même règle que la détection de série — on interroge les codes réels auprès de
 * l'API, on ne les suppose pas. Un 16ᵉ set Pocket publié demain sera exclu sans
 * qu'on touche à ce fichier.
 */
export const SERIES_EXCLUES: readonly string[] = ['tcgp']

/**
 * Ids de sets appartenant à une série exclue, demandés à l'API.
 *
 * `GET /sets` ne porte PAS la série (vérifié : il ne renvoie que id, name,
 * cardCount et les visuels) — on ne peut donc pas filtrer la liste sur place.
 * On interroge `GET /series/{id}`, qui énumère ses sets, et on compare sur des
 * ids normalisés en minuscules : l'API mélange les casses (`A1a` vs `a1a`).
 */
export async function idsDesSetsExclus(): Promise<Set<string>> {
  const ids = new Set<string>()
  for (const serieId of SERIES_EXCLUES) {
    const serie = await fetchSerie(serieId)
    for (const set of serie.sets ?? []) ids.add(set.id.toLowerCase())
  }
  return ids
}

/**
 * Retire les sets hors périmètre AVANT toute écriture — c'est le point de
 * passage obligé de tout parcours qui importe « tous les sets ».
 *
 * Filtrer après coup aurait laissé les lignes se créer puis compté sur une
 * suppression pour les reprendre : la base aurait été fausse entre les deux, et
 * un import interrompu au milieu l'aurait laissée fausse pour de bon.
 */
export async function filtrerSetsImportables<T extends { id: string }>(
  sets: T[],
  log?: LogFn
): Promise<T[]> {
  const exclus = await idsDesSetsExclus()
  const gardes = sets.filter(s => !exclus.has(s.id.toLowerCase()))
  const retires = sets.length - gardes.length
  if (retires > 0) {
    log?.(`[SKIP] ${retires} set(s) écarté(s) — série(s) hors périmètre : ${SERIES_EXCLUES.join(', ')}`)
  }
  return gardes
}

// ─────────────────────────────────────────────────────────────
// Étapes de l'import
// ─────────────────────────────────────────────────────────────

async function loadGlobalVariantTypes(supabase: SupabaseClient): Promise<VariantTypeRow[]> {
  const { data, error } = await supabase
    .from('pokemon_variant_types')
    .select('id, code')
    .is('set_id', null)

  if (error) throw new Error(`Variantes globales : ${error.message}`)
  return data ?? []
}

async function upsertSet(
  supabase: SupabaseClient,
  setData: TCGdexSet,
  log: LogFn
): Promise<{ id: string; name: string }> {
  const { data, error } = await supabase
    .from('pokemon_sets')
    .upsert({
      code: setData.id.toUpperCase(),
      name_fr: setData.name,
      release_date: setData.releaseDate ?? null,
      image_url: setData.logo ? withSuffix(setData.logo, '.png') : null,
      symbol_url: setData.symbol ? withSuffix(setData.symbol, '.png') : null,
      card_count: setData.cardCount?.total ?? null,
      serie_id: setData.serie?.id ?? null,
      serie_name: setData.serie?.name ?? null,
    }, { onConflict: 'code' })
    .select('id, name_fr')
    .single()

  if (error || !data) throw new Error(`Upsert set : ${error?.message ?? 'réponse vide'}`)
  log(`[DB] Set upserted → id: ${data.id}`)
  return { id: data.id, name: data.name_fr }
}

// Fetch le détail de chaque carte (pool de 8, 1 retry). Échec définitif → carte
// importée en mode dégradé depuis le résumé (brief), consigné dans errors.
async function resolveCards(
  briefs: TCGdexCardBrief[],
  log: LogFn,
  errors: SetImportStats['errors']
): Promise<ResolvedCard[]> {
  return mapPool(briefs, 8, async (brief) => {
    const detail = await fetchCardWithRetry(brief.id)
    if (!detail) {
      errors.push({ item: brief.id, message: 'Détail carte indisponible après retry — import dégradé depuis le brief' })
      log(`[ERR] ${brief.id} — détail indisponible, import dégradé`)
    }

    const image = detail?.image ?? brief.image ?? null
    return {
      number: String(brief.localId ?? brief.id),
      name: detail?.name ?? brief.name,
      image: image ? withSuffix(image, '/high.webp') : null,
      rarity: detail?.rarity ?? null,
      category: detail?.category ?? null,
      attribute: detail?.types?.[0] ?? null,
      tcgdexId: brief.id,
      variants: detail?.variants ?? null,
    }
  })
}

// Upsert des cartes en lot (chunks ~200). Retourne l'id BDD par numéro de carte.
async function upsertCards(
  supabase: SupabaseClient,
  setRowId: string,
  cards: ResolvedCard[],
  log: LogFn
): Promise<Map<string, string>> {
  const idByNumber = new Map<string, string>()

  for (const batch of chunk(cards, 200)) {
    const rows = batch.map(c => ({
      set_id: setRowId,
      number: c.number,
      name_fr: c.name,
      // `image_url` est une colonne générée depuis ARCHI-01 : elle refuse
      // toute écriture. L'import alimente la source API ; `image_manuelle`
      // lui est structurellement hors de portée.
      image_api: c.image,
      rarity: c.rarity,
      card_type: c.category,
      attribute: c.attribute,
      tcgdex_id: c.tcgdexId,
    }))

    const { data, error } = await supabase
      .from('pokemon_cards')
      .upsert(rows, { onConflict: 'set_id,number' })
      .select('id, number')

    if (error) {
      log(`[ERR] Upsert lot de ${rows.length} carte(s) — ${error.message}`)
      continue
    }
    for (const row of data ?? []) idByNumber.set(row.number, row.id)
  }

  log(`[DB] ${idByNumber.size}/${cards.length} carte(s) upsertée(s)`)
  return idByNumber
}

// Variantes réelles TCGdex → ids pokemon_variant_types. Fallback [NORMAL] si
// aucune variante vraie ou détail indisponible.
function pickVariantIds(variants: TCGdexCardVariants | null, variantTypes: VariantTypeRow[]): string[] {
  const idOf = (code: string) => variantTypes.find(v => v.code === code)?.id

  if (variants) {
    const ids = [
      variants.normal && idOf('NORMAL'),
      variants.reverse && idOf('REVERSE'),
      variants.holo && idOf('HOLO'),
      variants.firstEdition && idOf('FIRST_EDITION'),
    ].filter((id): id is string => Boolean(id))
    if (ids.length > 0) return ids
  }

  const fallback = idOf('NORMAL')
  return fallback ? [fallback] : []
}

// Insert des listings en lot (chunks ~500), ON CONFLICT DO NOTHING : ne touche
// jamais un listing existant (quantity/price déjà saisis par un vendeur).
async function insertListings(
  supabase: SupabaseClient,
  cards: ResolvedCard[],
  idByNumber: Map<string, string>,
  variantTypes: VariantTypeRow[],
  log: LogFn
): Promise<number> {
  // Depuis ARCHI-01, l'import ne crée que des VARIANTES. `quantity` et `price`
  // appartiennent à l'exemplaire physique, que l'import n'a pas à inventer.
  const rows: { card_id: string; variant_type_id: string; image_api: string | null }[] = []

  for (const card of cards) {
    const cardId = idByNumber.get(card.number)
    if (!cardId) continue
    for (const variantTypeId of pickVariantIds(card.variants, variantTypes)) {
      rows.push({ card_id: cardId, variant_type_id: variantTypeId, image_api: card.image })
    }
  }

  let created = 0
  for (const batch of chunk(rows, 500)) {
    const { data, error } = await supabase
      .from('pokemon_card_variants')
      .upsert(batch, { onConflict: 'card_id,variant_type_id', ignoreDuplicates: true })
      .select('id')

    if (error) {
      log(`[ERR] Insert lot de ${batch.length} listing(s) — ${error.message}`)
      continue
    }
    created += data?.length ?? 0
  }

  log(`[DB] ${created} variante(s) créée(s) (${rows.length} candidat(s))`)
  return created
}

// ─────────────────────────────────────────────────────────────
// Point d'entrée
// ─────────────────────────────────────────────────────────────

export async function importPokemonSet(
  supabase: SupabaseClient,
  setId: string,
  log: LogFn
): Promise<SetImportStats> {
  const start = Date.now()
  const errors: SetImportStats['errors'] = []

  log(`[TCGdex] Récupération du set ${setId}...`)
  const setData = await fetchSet(setId)

  // Deuxième verrou, et le seul qui couvre l'import UNITAIRE : `filtrerSetsImportables`
  // ne protège que les parcours qui partent d'une liste. Ici on tient le set complet,
  // donc sa série — on refuse AVANT le moindre upsert, jamais après.
  const serieDuSet = setData.serie?.id?.toLowerCase()
  if (serieDuSet && SERIES_EXCLUES.includes(serieDuSet)) {
    throw new Error(
      `Set ${setId} refusé : série « ${setData.serie?.name ?? serieDuSet} » hors périmètre boutique ` +
      '(jeu mobile, cartes non physiques). Voir SERIES_EXCLUES.'
    )
  }

  const briefs = setData.cards ?? []
  log(`[TCGdex] Set trouvé : ${setData.name} (${briefs.length} carte(s))`)

  const { id: setRowId, name: setName } = await upsertSet(supabase, setData, log)
  const variantTypes = await loadGlobalVariantTypes(supabase)

  const cards = await resolveCards(briefs, log, errors)
  const idByNumber = await upsertCards(supabase, setRowId, cards, log)
  const listingsCreated = await insertListings(supabase, cards, idByNumber, variantTypes, log)

  const cardsImported = idByNumber.size
  const cardsFailed = cards.length - cardsImported
  log(`[DONE] ${setName} — ${cardsImported} carte(s) importée(s), ${listingsCreated} listing(s), ${errors.length} erreur(s)`)

  return {
    setId: setRowId,
    setName,
    cardsImported,
    cardsFailed,
    listingsCreated,
    errors,
    durationMs: Date.now() - start,
  }
}
