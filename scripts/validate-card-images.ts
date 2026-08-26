// Validation des URLs d'image du catalogue.
//
// L'import TCGdex construit les URLs par convention
// (`https://assets.tcgdex.net/{lang}/{serie}/{set}/{number}/high.webp`) sans jamais
// vérifier que l'asset existe côté CDN. Résultat : des cartes portent une `image_url`
// renseignée qui répond 404 — invisible pour toute logique conditionnée sur « image_url
// est vide ». Ce script teste chaque URL en HEAD et met à NULL celles qui sont mortes.
//
// Exécution CLI (dry-run par défaut, `--apply` obligatoire pour écrire) :
//   npx tsx scripts/validate-card-images.ts
//   npx tsx scripts/validate-card-images.ts --tcg=pokemon --set=ME05
//   npx tsx scripts/validate-card-images.ts --tcg=pokemon --set=ME05 --apply
//
// La logique est exportée (`validateCardImages`) et réutilisée telle quelle par
// POST /api/admin/maintenance/validate-images — elle n'est jamais dupliquée.
import fs from 'node:fs'
import path from 'node:path'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

// ————————————————————————————————————————————————————————————————
// Constantes de prudence
// ————————————————————————————————————————————————————————————————

/** Requêtes HEAD simultanées. Le CDN TCGdex ne doit pas être matraqué. */
const CONCURRENCE = 10
/** Délai maximal par requête. */
const TIMEOUT_MS = 8_000
/** Un seul retry, et uniquement sur timeout. */
const RETRY_TIMEOUT = 1
/** Taille des lots d'UPDATE (ids groupés, jamais une requête par carte). */
const TAILLE_LOT = 100
/** Lignes remontées par page (limite par défaut de PostgREST). */
const TAILLE_PAGE = 1_000
/**
 * Au-delà de ce taux d'indéterminé, on refuse TOUTE écriture : c'est la signature
 * d'une coupure réseau ou d'un CDN en vrac, pas d'un catalogue troué. Ne jamais
 * effacer une URL sur un doute.
 */
const SEUIL_ABANDON = 0.25

const TABLES = {
  pokemon: { cards: 'pokemon_cards', sets: 'pokemon_sets' },
  onepiece: { cards: 'onepiece_cards', sets: 'onepiece_sets' },
} as const

export type Tcg = keyof typeof TABLES

/**
 * Ce qu'on teste. `cartes` reproduit à l'identique le comportement d'avant
 * l'ajout des sets ; `tout` est le défaut.
 *
 * Les VISUELS DE SET sont deux colonnes de la même table : `image_url` (le logo)
 * et `symbol_url` (le symbole). On les traite ensemble parce qu'ils viennent du
 * même import TCGdex et souffrent du même défaut : l'URL est construite par
 * convention, jamais vérifiée côté CDN.
 */
export type Cible = 'cartes' | 'sets' | 'tout'

/** Colonnes d'un set portant une URL d'asset. */
const COLONNES_SET = ['image_url', 'symbol_url'] as const
type ColonneSet = (typeof COLONNES_SET)[number]

const LIBELLE_ASSET: Record<ColonneSet, string> = {
  image_url: 'logo',
  symbol_url: 'symbole',
}

// ————————————————————————————————————————————————————————————————
// Types du rapport
// ————————————————————————————————————————————————————————————————

export interface ValidateOptions {
  /** Univers à traiter. Absent = les deux. */
  tcg?: Tcg
  /** Code de set (insensible à la casse), ex. `ME05`. Absent = tous les sets. */
  setCode?: string
  /** Ce qu'on teste : cartes, visuels de set, ou les deux. Défaut : `tout`. */
  cible?: Cible
  /** `false` (défaut) = dry-run strict, aucune écriture. */
  apply?: boolean
  /** Requêtes simultanées (défaut et plafond : 10). */
  concurrency?: number
  /** Sortie de progression. Par défaut : silencieuse. */
  onLog?: (line: string) => void
  /** Client à réutiliser. Par défaut : client service-role construit ici. */
  supabase?: SupabaseClient
}

export interface SetBreakdown {
  tcg: Tcg
  setCode: string
  setName: string
  /** Cartes du set. */
  tested: number
  valid: number
  nullified: number
  indeterminate: number
  /** Visuels du set lui-même (logo, symbole) — comptés à part des cartes. */
  assetsTested: number
  assetsValid: number
  assetsNullified: number
  assetsIndeterminate: number
}

export interface ValidationReport {
  /** Écriture demandée. */
  apply: boolean
  /** Écriture réellement effectuée (false en dry-run ou si le garde-fou a sauté). */
  applied: boolean
  /** Renseigné quand `apply` était demandé mais que rien n'a été écrit. */
  abortedReason?: string
  tcg: Tcg[]
  setCode?: string
  cible: Cible
  total: number
  valid: number
  /** Mises à NULL — effectives si `applied`, sinon simulées. */
  nullified: number
  indeterminate: number
  /** Décompte par statut HTTP / cause d'échec, pour lecture à froid. */
  byStatus: Record<string, number>
  bySet: SetBreakdown[]
  durationMs: number
}

// ————————————————————————————————————————————————————————————————
// Environnement (CLI uniquement — en route API, process.env est déjà peuplé)
// ————————————————————————————————————————————————————————————————

/**
 * Charge NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY depuis ../.env.local.
 * Loader minimal ligne par ligne, calqué sur `import-catalogue-pokemon.ts` — les
 * valeurs ne sont JAMAIS affichées. process.env reste prioritaire.
 */
function loadEnvLocal(): void {
  const envPath = path.resolve(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) return

  for (const rawLine of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const eq = line.indexOf('=')
    if (eq === -1) continue

    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    const quoted = (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))
    if (quoted) value = value.slice(1, -1)

    if (!(key in process.env)) process.env[key] = value
  }
}

/** Client service-role, hors navigateur — jamais le client `lib/supabase/server.ts`. */
function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.')
  }
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

// ————————————————————————————————————————————————————————————————
// Sonde HTTP
// ————————————————————————————————————————————————————————————————

type Verdict = 'valid' | 'dead' | 'indeterminate'

interface Probe {
  verdict: Verdict
  /** Statut HTTP ou cause (`timeout`, `réseau`). */
  detail: string
}

/**
 * 2xx → valide. 404 / 403 / 410 → morte. Tout le reste (5xx, 429, timeout, erreur
 * réseau) → indéterminé : on ne touche à rien. Un seul retry, sur timeout seulement.
 */
async function probeUrl(url: string): Promise<Probe> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (res.status >= 200 && res.status < 300) return { verdict: 'valid', detail: String(res.status) }
      if (res.status === 404 || res.status === 403 || res.status === 410) {
        return { verdict: 'dead', detail: String(res.status) }
      }
      return { verdict: 'indeterminate', detail: `HTTP ${res.status}` }
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      const isTimeout = name === 'TimeoutError' || name === 'AbortError'
      if (isTimeout && attempt < RETRY_TIMEOUT) continue
      return { verdict: 'indeterminate', detail: isTimeout ? 'timeout' : 'réseau' }
    }
  }
}

/** Pool à concurrence fixe : jamais plus de `limit` requêtes en vol. */
async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const index = cursor++
      if (index >= items.length) return
      await worker(items[index])
    }
  })
  await Promise.all(runners)
}

// ————————————————————————————————————————————————————————————————
// Accès base
// ————————————————————————————————————————————————————————————————

interface CardRow {
  id: string
  number: string | null
  image_url: string
  set_id: string | null
}

interface SetRow {
  id: string
  code: string | null
  name_fr: string | null
}

async function fetchSets(supabase: SupabaseClient, tcg: Tcg, setCode?: string): Promise<SetRow[]> {
  let query = supabase.from(TABLES[tcg].sets).select('id, code, name_fr')
  // ilike : les codes sont stockés en majuscules, `--set=me05` doit marcher aussi.
  if (setCode) query = query.ilike('code', setCode)

  const { data, error } = await query
  if (error) throw new Error(`Lecture de ${TABLES[tcg].sets} : ${error.message}`)
  return (data ?? []) as SetRow[]
}

/** Toutes les cartes à tester, paginées — PostgREST plafonne à 1000 lignes par requête. */
async function fetchCards(supabase: SupabaseClient, tcg: Tcg, setIds: string[] | null): Promise<CardRow[]> {
  const rows: CardRow[] = []
  if (setIds && setIds.length === 0) return rows

  for (let from = 0; ; from += TAILLE_PAGE) {
    let query = supabase
      .from(TABLES[tcg].cards)
      .select('id, number, image_url, set_id')
      .not('image_url', 'is', null)
      .neq('image_url', '')
      .order('id', { ascending: true })
      .range(from, from + TAILLE_PAGE - 1)
    if (setIds) query = query.in('set_id', setIds)

    const { data, error } = await query
    if (error) throw new Error(`Lecture de ${TABLES[tcg].cards} : ${error.message}`)

    const page = (data ?? []) as CardRow[]
    rows.push(...page)
    if (page.length < TAILLE_PAGE) return rows
  }
}

interface SetAssetRow {
  id: string
  code: string | null
  name_fr: string | null
  image_url: string | null
  symbol_url: string | null
}

/**
 * Les visuels des sets : logo et symbole, dans la même lecture.
 *
 * Pas de pagination ici — 185 sets Pokémon et 30 One Piece tiennent largement
 * sous la limite PostgREST de 1 000 lignes. Aucun univers n'est exclu en dur :
 * `onepiece_sets` n'a aujourd'hui aucune URL renseignée et sort donc naturellement
 * vide, mais le jour où l'import en fournira, il sera testé sans rien changer ici.
 */
async function fetchSetAssets(supabase: SupabaseClient, tcg: Tcg, setCode?: string): Promise<SetAssetRow[]> {
  let query = supabase
    .from(TABLES[tcg].sets)
    .select('id, code, name_fr, image_url, symbol_url')
    .or('image_url.not.is.null,symbol_url.not.is.null')
    .order('id', { ascending: true })
  if (setCode) query = query.ilike('code', setCode)

  const { data, error } = await query
  if (error) throw new Error(`Lecture des visuels de ${TABLES[tcg].sets} : ${error.message}`)
  return (data ?? []) as SetAssetRow[]
}

/**
 * Mise à NULL des visuels de set, une requête par COLONNE et par lot.
 *
 * On ne peut pas grouper logo et symbole dans le même UPDATE : un set peut avoir
 * un logo mort et un symbole valide, et écrire `{image_url: null, symbol_url: null}`
 * effacerait le symbole encore bon.
 */
async function nullifySetAssetsBatched(
  supabase: SupabaseClient,
  tcg: Tcg,
  parColonne: Map<ColonneSet, string[]>,
  log: (line: string) => void
): Promise<void> {
  for (const [colonne, ids] of parColonne) {
    if (ids.length === 0) continue
    for (let i = 0; i < ids.length; i += TAILLE_LOT) {
      const chunk = ids.slice(i, i + TAILLE_LOT)
      const { error } = await supabase
        .from(TABLES[tcg].sets)
        .update({ [colonne]: null })
        .in('id', chunk)
      if (error) throw new Error(`UPDATE ${TABLES[tcg].sets}.${colonne} : ${error.message}`)
      log(`  écrit ${Math.min(i + TAILLE_LOT, ids.length)}/${ids.length} (${LIBELLE_ASSET[colonne]})`)
    }
  }
}

/** UPDATE groupés par lots de 100 ids. Idempotent : rejouable sans effet de bord. */
async function nullifyBatched(
  supabase: SupabaseClient,
  tcg: Tcg,
  ids: string[],
  log: (line: string) => void
): Promise<void> {
  for (let i = 0; i < ids.length; i += TAILLE_LOT) {
    const chunk = ids.slice(i, i + TAILLE_LOT)
    // ASYMÉTRIE ASSUMÉE depuis ARCHI-01 : `pokemon_cards.image_url` est une
    // colonne GÉNÉRÉE (coalesce de image_manuelle et image_api) et refuse toute
    // écriture — on nullifie la source API. `onepiece_cards` garde une colonne
    // simple : son univers n'est pas migré, sa base étant un miroir d'API.
    const colonne = tcg === 'pokemon' ? 'image_api' : 'image_url'
    const { error } = await supabase
      .from(TABLES[tcg].cards)
      .update({ [colonne]: null })
      .in('id', chunk)
    if (error) throw new Error(`UPDATE ${TABLES[tcg].cards} : ${error.message}`)
    log(`  écrit ${Math.min(i + TAILLE_LOT, ids.length)}/${ids.length}`)
  }
}

// ————————————————————————————————————————————————————————————————
// Fonction principale, partagée CLI / route API
// ————————————————————————————————————————————————————————————————

export async function validateCardImages(options: ValidateOptions = {}): Promise<ValidationReport> {
  const started = Date.now()
  const log = options.onLog ?? (() => {})
  const apply = options.apply === true
  const concurrency = Math.max(1, Math.min(options.concurrency ?? CONCURRENCE, CONCURRENCE))
  const supabase = options.supabase ?? createServiceClient()
  const univers: Tcg[] = options.tcg ? [options.tcg] : ['pokemon', 'onepiece']
  const cible: Cible = options.cible ?? 'tout'
  const faireCartes = cible === 'cartes' || cible === 'tout'
  const faireSets = cible === 'sets' || cible === 'tout'

  const bySet = new Map<string, SetBreakdown>()
  const byStatus: Record<string, number> = {}
  /** Une URL peut être partagée par plusieurs cartes : une seule requête par URL. */
  const cache = new Map<string, Probe>()
  const morts = new Map<Tcg, string[]>()
  const mortsAssets = new Map<Tcg, Map<ColonneSet, string[]>>()

  const entreeDe = (tcg: Tcg, code: string, nom: string): SetBreakdown => {
    const key = `${tcg}:${code}`
    let entry = bySet.get(key)
    if (!entry) {
      entry = {
        tcg,
        setCode: code,
        setName: nom,
        tested: 0,
        valid: 0,
        nullified: 0,
        indeterminate: 0,
        assetsTested: 0,
        assetsValid: 0,
        assetsNullified: 0,
        assetsIndeterminate: 0,
      }
      bySet.set(key, entry)
    }
    return entry
  }

  let total = 0
  let valid = 0
  let nullified = 0
  let indeterminate = 0

  for (const tcg of univers) {
    const sets = await fetchSets(supabase, tcg, options.setCode)
    if (options.setCode && sets.length === 0) {
      log(`[${tcg}] set « ${options.setCode} » introuvable — ignoré.`)
      continue
    }

    const setById = new Map(sets.map((s) => [s.id, s]))
    const cards = faireCartes
      ? await fetchCards(supabase, tcg, options.setCode ? sets.map((s) => s.id) : null)
      : []
    if (faireCartes) log(`[${tcg}] ${cards.length} carte(s) avec une image_url renseignée à tester.`)

    const idsMorts: string[] = []
    let done = 0

    await runPool(cards, concurrency, async (card) => {
      let probe = cache.get(card.image_url)
      if (!probe) {
        probe = await probeUrl(card.image_url)
        cache.set(card.image_url, probe)
      }

      const set = card.set_id ? setById.get(card.set_id) : undefined
      const code = set?.code ?? '(sans set)'
      const entry = entreeDe(tcg, code, set?.name_fr ?? '—')

      entry.tested++
      total++
      byStatus[probe.detail] = (byStatus[probe.detail] ?? 0) + 1

      if (probe.verdict === 'valid') {
        entry.valid++
        valid++
      } else if (probe.verdict === 'dead') {
        entry.nullified++
        nullified++
        idsMorts.push(card.id)
        log(`  MORTE ${code} #${card.number ?? '?'} (${probe.detail}) → ${card.image_url}`)
      } else {
        entry.indeterminate++
        indeterminate++
        log(`  INDÉTERMINÉ ${code} #${card.number ?? '?'} (${probe.detail}) — non touché`)
      }

      done++
      if (done % 500 === 0) log(`[${tcg}] ${done}/${cards.length} testées…`)
    })

    morts.set(tcg, idsMorts)

    // ── Visuels des sets : logo puis symbole ────────────────────────────────
    if (faireSets) {
      const assets = await fetchSetAssets(supabase, tcg, options.setCode)
      const aTester = assets.flatMap((s) =>
        COLONNES_SET.flatMap((col) => {
          const url = s[col]
          return url ? [{ set: s, colonne: col, url }] : []
        })
      )
      log(`[${tcg}] ${aTester.length} visuel(s) de set à tester (logo + symbole).`)

      const parColonne = new Map<ColonneSet, string[]>(COLONNES_SET.map((c) => [c, []]))

      await runPool(aTester, concurrency, async ({ set, colonne, url }) => {
        let probe = cache.get(url)
        if (!probe) {
          probe = await probeUrl(url)
          cache.set(url, probe)
        }

        const code = set.code ?? '(sans code)'
        const entry = entreeDe(tcg, code, set.name_fr ?? '—')
        const quoi = LIBELLE_ASSET[colonne]

        entry.assetsTested++
        total++
        byStatus[probe.detail] = (byStatus[probe.detail] ?? 0) + 1

        if (probe.verdict === 'valid') {
          entry.assetsValid++
          valid++
        } else if (probe.verdict === 'dead') {
          entry.assetsNullified++
          nullified++
          parColonne.get(colonne)!.push(set.id)
          log(`  MORT ${code} ${quoi} (${probe.detail}) → ${url}`)
        } else {
          entry.assetsIndeterminate++
          indeterminate++
          log(`  INDÉTERMINÉ ${code} ${quoi} (${probe.detail}) — non touché`)
        }
      })

      mortsAssets.set(tcg, parColonne)
    }
  }

  // Garde-fou : sur un taux d'indéterminé anormal (coupure réseau, CDN HS), on
  // n'écrit RIEN du tout — pas même les 404 constatés avant la coupure.
  const tauxIndetermine = total > 0 ? indeterminate / total : 0
  let applied = false
  let abortedReason: string | undefined

  if (apply) {
    if (tauxIndetermine >= SEUIL_ABANDON) {
      abortedReason =
        `${indeterminate}/${total} URL indéterminées (${(tauxIndetermine * 100).toFixed(1)} % ≥ ` +
        `${SEUIL_ABANDON * 100} %) : réseau ou CDN suspect, aucune écriture effectuée.`
      log(`[ABANDON] ${abortedReason}`)
    } else if (nullified === 0) {
      abortedReason = 'Aucune URL morte à écrire.'
    } else {
      for (const [tcg, ids] of morts) {
        if (ids.length === 0) continue
        log(`[${tcg}] mise à NULL de ${ids.length} image_url de carte…`)
        await nullifyBatched(supabase, tcg, ids, log)
      }
      for (const [tcg, parColonne] of mortsAssets) {
        const n = [...parColonne.values()].reduce((s, ids) => s + ids.length, 0)
        if (n === 0) continue
        log(`[${tcg}] mise à NULL de ${n} visuel(s) de set…`)
        await nullifySetAssetsBatched(supabase, tcg, parColonne, log)
      }
      applied = true
    }
  }

  return {
    apply,
    applied,
    abortedReason,
    tcg: univers,
    setCode: options.setCode,
    cible,
    total,
    valid,
    nullified,
    indeterminate,
    byStatus,
    bySet: [...bySet.values()].sort(
      (a, b) =>
        b.nullified + b.assetsNullified - (a.nullified + a.assetsNullified) ||
        a.tcg.localeCompare(b.tcg) ||
        a.setCode.localeCompare(b.setCode)
    ),
    durationMs: Date.now() - started,
  }
}

// ————————————————————————————————————————————————————————————————
// CLI
// ————————————————————————————————————————————————————————————————

function parseArgs(argv: string[]): ValidateOptions {
  const options: ValidateOptions = { apply: false }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const hasInline = arg.startsWith('--') && arg.includes('=')
    const flag = hasInline ? arg.slice(0, arg.indexOf('=')) : arg
    const inline = hasInline ? arg.slice(arg.indexOf('=') + 1) : undefined
    const next = () => inline ?? argv[++i]

    if (flag === '--apply') {
      options.apply = true
    } else if (flag === '--set') {
      options.setCode = next()
    } else if (flag === '--tcg') {
      const value = next()
      if (value !== 'pokemon' && value !== 'onepiece') {
        console.error(`[ERR] --tcg doit valoir pokemon ou onepiece (reçu : ${value ?? 'rien'}).`)
        process.exit(1)
      }
      options.tcg = value
    } else if (flag === '--cible') {
      const value = next()
      if (value !== 'cartes' && value !== 'sets' && value !== 'tout') {
        console.error(`[ERR] --cible doit valoir cartes, sets ou tout (reçu : ${value ?? 'rien'}).`)
        process.exit(1)
      }
      options.cible = value
    } else if (flag === '--help' || flag === '-h') {
      console.log(
        'Usage : npx tsx scripts/validate-card-images.ts [--tcg=pokemon|onepiece] [--set=ME05]\n' +
          '                                              [--cible=cartes|sets|tout] [--apply]\n' +
          '  --cible=cartes : image_url des cartes (comportement historique)\n' +
          '  --cible=sets   : logo (image_url) et symbole (symbol_url) des sets\n' +
          '  --cible=tout   : les deux (défaut)\n' +
          '  Sans --apply : dry-run strict, aucune écriture en base.'
      )
      process.exit(0)
    } else {
      console.error(`[ERR] Option inconnue : ${arg}`)
      process.exit(1)
    }
  }

  return options
}

function printReport(report: ValidationReport): void {
  console.log('\n[RÉCAPITULATIF]')
  console.log(`  Mode                : ${report.applied ? 'APPLIQUÉ (base modifiée)' : 'DRY-RUN (aucune écriture)'}`)
  if (report.abortedReason) console.log(`  Écriture annulée    : ${report.abortedReason}`)
  console.log(`  Univers             : ${report.tcg.join(', ')}${report.setCode ? ` — set ${report.setCode}` : ''}`)
  console.log(`  Cible               : ${report.cible}`)
  console.log(`  URLs testées        : ${report.total}`)
  console.log(`  Valides             : ${report.valid}`)
  console.log(`  ${report.applied ? 'Mises à NULL       ' : 'À mettre à NULL    '}: ${report.nullified}`)
  console.log(`  Indéterminées       : ${report.indeterminate}`)
  console.log(`  Durée               : ${(report.durationMs / 1000).toFixed(1)} s`)

  const statuts = Object.entries(report.byStatus).sort((a, b) => b[1] - a[1])
  if (statuts.length > 0) {
    console.log('\n[STATUTS]')
    for (const [statut, n] of statuts) console.log(`  ${statut.padEnd(12)} ${n}`)
  }

  const totalAssets = report.bySet.reduce((n, s) => n + s.assetsTested, 0)
  if (totalAssets > 0) {
    const nullAssets = report.bySet.reduce((n, s) => n + s.assetsNullified, 0)
    const indetAssets = report.bySet.reduce((n, s) => n + s.assetsIndeterminate, 0)
    console.log('\n[VISUELS DE SET]')
    console.log(`  Testés              : ${totalAssets}`)
    console.log(`  Valides             : ${totalAssets - nullAssets - indetAssets}`)
    console.log(`  ${report.applied ? 'Mis à NULL         ' : 'À mettre à NULL    '}: ${nullAssets}`)
    console.log(`  Indéterminés        : ${indetAssets}`)
  }

  const touches = report.bySet.filter(
    (s) => s.nullified > 0 || s.indeterminate > 0 || s.assetsNullified > 0 || s.assetsIndeterminate > 0
  )
  console.log(`\n[VENTILATION PAR SET] ${touches.length} set(s) concerné(s) sur ${report.bySet.length} testé(s)`)
  console.log('  set          cartes   valides    NULL  indét. | visuels   NULL  indét.  nom')
  for (const s of touches) {
    console.log(
      `  ${s.setCode.padEnd(10)} ${String(s.tested).padStart(8)} ${String(s.valid).padStart(9)} ` +
        `${String(s.nullified).padStart(7)} ${String(s.indeterminate).padStart(7)} | ` +
        `${String(s.assetsTested).padStart(7)} ${String(s.assetsNullified).padStart(6)} ` +
        `${String(s.assetsIndeterminate).padStart(7)}  ${s.setName}`
    )
  }
}

async function main(): Promise<void> {
  loadEnvLocal()
  const options = parseArgs(process.argv.slice(2))

  console.log(
    options.apply
      ? '[APPLY] Les URLs mortes seront mises à NULL en base.\n'
      : '[DRY-RUN] Aucune écriture ne sera faite. Ajouter --apply pour appliquer.\n'
  )

  const report = await validateCardImages({ ...options, onLog: (line) => console.log(line) })
  printReport(report)
}

// Ne s'exécute qu'en CLI. Importé par la route API, le module n'expose que sa fonction.
const entry = (process.argv[1] ?? '').replace(/\\/g, '/')
if (/\/validate-card-images(\.[cm]?[jt]s)?$/.test(entry)) {
  main().catch((err) => {
    console.error('[ERR] Échec fatal du script :', err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
