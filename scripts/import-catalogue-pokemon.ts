// Script CLI d'import du catalogue Pokémon — exécution : `npx tsx scripts/import-catalogue-pokemon.ts`
// depuis goriki/. Contourne le fait que `profiles` est vide (les routes API ne peuvent
// pas s'auto-autoriser admin) en utilisant la clé service-role directement.
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { fetchSets } from '../lib/tcgdex'
import { importPokemonSet, filtrerSetsImportables } from '../lib/import/pokemon'

// Charge NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY depuis ../.env.local
// (loader minimal ligne par ligne — les valeurs ne sont JAMAIS affichées).
// Les variables déjà présentes dans process.env sont prioritaires (fallback process.env).
function loadEnvLocal(): void {
  const envPath = path.resolve(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) return

  const content = fs.readFileSync(envPath, 'utf-8')
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const eq = line.indexOf('=')
    if (eq === -1) continue

    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    const isQuoted = (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))
    if (isQuoted) value = value.slice(1, -1)

    if (!(key in process.env)) process.env[key] = value
  }
}

interface CliOptions {
  set?: string
  all: boolean
  from?: string
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { all: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--set') options.set = argv[++i]
    else if (argv[i] === '--all') options.all = true
    else if (argv[i] === '--from') options.from = argv[++i]
  }
  return options
}

async function resolveTargets(options: CliOptions): Promise<string[]> {
  // `--set` vise un set nommément : on n'écarte rien ici, `importPokemonSet`
  // refusera de lui-même s'il appartient à une série hors périmètre — et le
  // dira, ce qui vaut mieux qu'une cible silencieusement ignorée.
  if (options.set) return [options.set]

  const allSets = await filtrerSetsImportables(await fetchSets(), (l) => console.log(l))
  const ids = allSets.map((s) => s.id)
  if (!options.from) return ids

  const index = ids.findIndex((id) => id.toLowerCase() === options.from!.toLowerCase())
  if (index === -1) {
    console.error(`[ERR] --from ${options.from} introuvable dans la liste des sets TCGdex.`)
    process.exit(1)
  }
  return ids.slice(index)
}

async function main() {
  loadEnvLocal()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('[ERR] NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis (.env.local ou variables d\'environnement).')
    process.exit(1)
  }

  const options = parseArgs(process.argv.slice(2))
  if (!options.set && !options.all) {
    console.error('Usage : npx tsx scripts/import-catalogue-pokemon.ts --all [--from <setId>] | --set <setId>')
    process.exit(1)
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })
  const targets = await resolveTargets(options)
  console.log(`[START] ${targets.length} set(s) à importer`)

  let totalCards = 0
  let totalListings = 0
  let totalCardErrors = 0
  let fatalSetErrors = 0

  for (let i = 0; i < targets.length; i++) {
    const setId = targets[i]
    console.log(`\n[${i + 1}/${targets.length}] Import de ${setId}...`)

    try {
      const stats = await importPokemonSet(supabase, setId, (line) => console.log(`  ${line}`))
      totalCards += stats.cardsImported
      totalListings += stats.listingsCreated
      totalCardErrors += stats.errors.length
      console.log(
        `  → ${stats.setName} : ${stats.cardsImported} carte(s), ${stats.listingsCreated} listing(s), ` +
        `${stats.errors.length} erreur(s) (${stats.durationMs}ms)`
      )
    } catch (err) {
      fatalSetErrors++
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      console.error(`  [ERR] ${setId} — ${message}`)
    }

    if (options.all && i < targets.length - 1) await new Promise((r) => setTimeout(r, 150))
  }

  console.log('\n[RÉCAPITULATIF]')
  console.log(`  Sets traités        : ${targets.length}`)
  console.log(`  Cartes importées    : ${totalCards}`)
  console.log(`  Listings créés      : ${totalListings}`)
  console.log(`  Erreurs carte       : ${totalCardErrors}`)
  console.log(`  Sets en échec fatal : ${fatalSetErrors}`)

  if (fatalSetErrors > 0) process.exit(1)
}

main().catch((err) => {
  console.error('[ERR] Échec fatal du script :', err instanceof Error ? err.message : err)
  process.exit(1)
})
