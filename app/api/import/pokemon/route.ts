import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchSets, fetchSet } from '@/lib/tcgdex'
import { importPokemonSet, buildCodeToIdMap, type LogFn } from '@/lib/import/pokemon'

// Le bulk import peut traiter 190+ sets × pause entre chaque → dépasse les 60s par défaut Vercel
export const maxDuration = 300 // 5 min — Vercel Pro

interface ImportError {
  item: string
  message: string
}

async function getSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )
}

// Garde admin partagée par TOUS les handlers, y compris GET (sécurisation : la
// liste des sets et le déclenchement d'import ne doivent pas être accessibles anonymement).
async function requireAdmin(): Promise<{ supabase: SupabaseClient; response: NextResponse | null }> {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { supabase, response: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return { supabase, response: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) }
  }

  return { supabase, response: null }
}

export async function GET() {
  const { response } = await requireAdmin()
  if (response) return response

  const sets = await fetchSets()
  return NextResponse.json(sets)
}

export async function POST(request: NextRequest) {
  const { supabase, response } = await requireAdmin()
  if (response) return response

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action === 'bulk') return handleBulkImport(supabase)
  if (action === 'sync') return handleSync(supabase)
  return handleSingleImport(request, supabase)
}

// ─────────────────────────────────────────────────────────────
// Import unitaire
// ─────────────────────────────────────────────────────────────
async function handleSingleImport(request: NextRequest, supabase: SupabaseClient) {
  const { setId } = await request.json()
  if (!setId) return NextResponse.json({ ok: false, logs: [], error: 'setId requis' }, { status: 400 })

  const logs: string[] = []
  const log: LogFn = (line) => logs.push(line)

  try {
    const stats = await importPokemonSet(supabase, setId, log)
    return NextResponse.json({ ok: true, logs, stats })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    logs.push(`[ERR] ${message}`)
    return NextResponse.json({ ok: false, logs, error: message }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// Import bulk — tous les sets TCGdex en une passe
// ─────────────────────────────────────────────────────────────
async function handleBulkImport(supabase: SupabaseClient) {
  const logs: string[] = [
    '[WARN] Le bulk complet (190+ sets) peut dépasser le timeout serverless (maxDuration=300s) — ' +
    "préférer l'import set par set depuis la page admin, ou `npx tsx scripts/import-catalogue-pokemon.ts --all` en local.",
  ]
  const log: LogFn = (line) => logs.push(line)
  const start = Date.now()

  let setsProcessed = 0
  let cardsImported = 0
  let listingsCreated = 0
  const errors: ImportError[] = []

  try {
    log('[START] Récupération de tous les sets TCGdex...')
    const allSets = await fetchSets()
    log(`[TCGdex] ${allSets.length} set(s) trouvé(s)`)

    for (const setMeta of allSets) {
      try {
        const stats = await importPokemonSet(supabase, setMeta.id, log)
        setsProcessed++
        cardsImported += stats.cardsImported
        listingsCreated += stats.listingsCreated
        errors.push(...stats.errors)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue'
        log(`[ERR] ${setMeta.name} (${setMeta.id}) — ${message}`)
        errors.push({ item: setMeta.id, message })
      }
      await new Promise(r => setTimeout(r, 150))
    }

    log(`[DONE] ${setsProcessed}/${allSets.length} set(s) · ${cardsImported} carte(s) · ${listingsCreated} listing(s) · ${errors.length} erreur(s)`)
    return NextResponse.json({
      ok: true,
      logs,
      stats: { setsProcessed, cardsImported, listingsCreated, errors, durationMs: Date.now() - start },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    logs.push(`[ERR] ${message}`)
    return NextResponse.json({ ok: false, logs, error: message }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// Sync — nouveaux sets + cartes manquantes (listings existants conservés)
// ─────────────────────────────────────────────────────────────
async function handleSync(supabase: SupabaseClient) {
  const logs: string[] = []
  const log: LogFn = (line) => logs.push(line)
  const start = Date.now()

  let setsProcessed = 0
  let cardsImported = 0
  let listingsCreated = 0
  const errors: ImportError[] = []

  try {
    log('[SYNC] Vérification des sets TCGdex...')

    const { data: existingSets, error: existingError } = await supabase
      .from('pokemon_sets')
      .select('id, code')
    if (existingError) throw new Error(`Lecture sets existants : ${existingError.message}`)

    const existingCodes = new Set((existingSets ?? []).map(s => s.code))
    const allSets = await fetchSets()
    // FIX : plus de `existingSet.code.toLowerCase()` — l'id API n'est pas déductible du
    // code de façon fiable (15 sets TCG Pocket case-sensitive : A1, A1a, A2, ...). On
    // résout via une map construite depuis la liste réelle des sets TCGdex.
    const codeToId = buildCodeToIdMap(allSets)
    log(`[TCGdex] ${allSets.length} set(s) disponible(s) · ${existingCodes.size} déjà en BDD`)

    // 1. Nouveaux sets (diff par code)
    const newSetsMeta = allSets.filter(s => !existingCodes.has(s.id.toUpperCase()))
    log(`[SYNC] ${newSetsMeta.length} nouveau(x) set(s) détecté(s)`)

    for (const setMeta of newSetsMeta) {
      try {
        const stats = await importPokemonSet(supabase, setMeta.id, log)
        setsProcessed++
        cardsImported += stats.cardsImported
        listingsCreated += stats.listingsCreated
        errors.push(...stats.errors)
        log(`[NEW] ${stats.setName} ajouté — ${stats.cardsImported} carte(s)`)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue'
        log(`[ERR] ${setMeta.name} (${setMeta.id}) — ${message}`)
        errors.push({ item: setMeta.id, message })
      }
      await new Promise(r => setTimeout(r, 150))
    }

    // 2. Cartes manquantes dans les sets déjà en BDD
    log('[SYNC] Vérification des cartes manquantes dans les sets existants...')
    for (const existingSet of existingSets ?? []) {
      const apiId = codeToId.get(existingSet.code)
      if (!apiId) {
        const message = `Set TCGdex introuvable pour le code ${existingSet.code} (id API non résolu)`
        log(`[ERR] ${existingSet.code} — ${message}`)
        errors.push({ item: existingSet.code, message })
        continue
      }

      try {
        const setData = await fetchSet(apiId)
        const { data: existingCards, error: cardsError } = await supabase
          .from('pokemon_cards')
          .select('number')
          .eq('set_id', existingSet.id)
        if (cardsError) throw new Error(cardsError.message)

        const existingNumbers = new Set((existingCards ?? []).map(c => c.number))
        const missing = (setData.cards ?? []).filter(c => !existingNumbers.has(String(c.localId ?? c.id)))

        if (missing.length > 0) {
          log(`[SYNC] ${existingSet.code} — ${missing.length} carte(s) manquante(s)`)
          const stats = await importPokemonSet(supabase, apiId, log)
          setsProcessed++
          cardsImported += stats.cardsImported
          listingsCreated += stats.listingsCreated
          errors.push(...stats.errors)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue'
        log(`[ERR] ${existingSet.code} — ${message}`)
        errors.push({ item: existingSet.code, message })
      }
      await new Promise(r => setTimeout(r, 100))
    }

    log(`[DONE] ${setsProcessed} set(s) traité(s) · ${cardsImported} carte(s) · ${listingsCreated} listing(s) · ${errors.length} erreur(s)`)
    return NextResponse.json({
      ok: true,
      logs,
      stats: { setsProcessed, cardsImported, listingsCreated, errors, durationMs: Date.now() - start },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    logs.push(`[ERR] ${message}`)
    return NextResponse.json({ ok: false, logs, error: message }, { status: 500 })
  }
}
