import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { fetchOPESets, fetchOPESet, OPECardsUnavailableError, type OPESet } from '@/lib/opecards'

// Cohérence avec le bulk Pokémon — Poneglyphe peut être lent / multi-sets
export const maxDuration = 300 // 5 min — Vercel Pro

// ─────────────────────────────────────────────────────────────
// Contrat de réponse unifié (identique côté Pokémon)
// ─────────────────────────────────────────────────────────────
interface ImportError {
  item: string
  message: string
}

interface ImportStats {
  setsProcessed?: number
  cardsImported: number
  listingsCreated: number
  errors: ImportError[]
  durationMs: number
}

function buildStats(args: {
  setsProcessed?: number
  cardsImported: number
  listingsCreated: number
  errors: ImportError[]
  start: number
}): ImportStats {
  const { setsProcessed, cardsImported, listingsCreated, errors, start } = args
  return {
    ...(setsProcessed !== undefined ? { setsProcessed } : {}),
    cardsImported,
    listingsCreated,
    errors,
    durationMs: Date.now() - start,
  }
}

// ─────────────────────────────────────────────────────────────
// Garde admin — appliquée à TOUS les handlers, y compris GET
// ─────────────────────────────────────────────────────────────
async function requireAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return {
      authorized: false as const,
      response: NextResponse.json({ ok: false, error: 'Non autorisé' }, { status: 401 }),
    }
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return {
      authorized: false as const,
      response: NextResponse.json({ ok: false, error: 'Accès refusé' }, { status: 403 }),
    }
  }

  return { authorized: true as const, supabase }
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.response

  try {
    const sets: OPESet[] = await fetchOPESets()
    return NextResponse.json(sets)
  } catch (err) {
    if (err instanceof OPECardsUnavailableError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 503 })
    }
    const message = err instanceof Error ? err.message : 'Erreur Poneglyphe'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action === 'bulk') return handleBulkImport()
  if (action === 'sync') return handleSync()
  return handleSingleImport(request) // comportement actuel (import unitaire)
}

// ─────────────────────────────────────────────────────────────
// Import unitaire (comportement historique)
// ─────────────────────────────────────────────────────────────
async function handleSingleImport(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.response
  const { supabase } = auth

  const start = Date.now()
  const logs: string[] = []
  const errors: ImportError[] = []
  let cardsImported = 0
  let listingsCreated = 0

  const { setId } = await request.json()
  if (!setId) {
    return NextResponse.json(
      { ok: false, logs, stats: buildStats({ cardsImported, listingsCreated, errors, start }), error: 'setId requis' },
      { status: 400 }
    )
  }

  try {
    logs.push(`[START] Import du set ${setId}...`)
    const setData = await fetchOPESet(setId)
    logs.push(`[OK] Set trouvé : ${setData.name} (${setData.cards?.length ?? 0} cartes)`)

    const { data: setRow, error: setError } = await supabase
      .from('onepiece_sets')
      .upsert({
        code: (setData.code ?? setId).toUpperCase(),
        name_fr: setData.name,
        release_date: setData.releaseDate ?? null,
        image_url: setData.image ?? null,
        card_count: setData.cardCount ?? setData.cards?.length ?? null,
        serie_id: setData.serieId ?? null,
        serie_name: setData.serieName ?? null,
      }, { onConflict: 'code' })
      .select('id')
      .single()

    if (setError || !setRow) {
      logs.push(`[ERR] Upsert set — ${setError?.message ?? 'échec inconnu'}`)
      errors.push({ item: setData.name ?? setId, message: setError?.message ?? 'Upsert set échoué' })
      return NextResponse.json(
        {
          ok: false,
          logs,
          stats: buildStats({ setsProcessed: 0, cardsImported, listingsCreated, errors, start }),
          error: setError?.message ?? 'Upsert set échoué',
        },
        { status: 500 }
      )
    }
    logs.push(`[SET] Set upserted → id: ${setRow.id}`)

    const { data: globalVariants } = await supabase
      .from('onepiece_variant_types')
      .select('id, code')
      .is('set_id', null)

    const standardVariant = globalVariants?.find(v => v.code === 'STANDARD')

    const cards = setData.cards ?? []

    for (const card of cards) {
      const { data: cardRow, error: cardError } = await supabase
        .from('onepiece_cards')
        .upsert({
          set_id: setRow.id,
          number: card.number,
          name_fr: card.name,
          image_url: card.image ?? null,
          rarity: card.rarity ?? null,
          card_type: card.type ?? null,
          color: card.color ?? null,
          power: card.power ?? null,
          life_points: card.life ?? null,
          opecards_id: card.id,
          colors: card.colors ?? null,
          attribute: card.attribute ?? null,
          cost: card.cost ?? null,
          counter: card.counter ?? null,
          effect: card.effect ?? null,
          trigger_effect: card.triggerEffect ?? null,
          character_name: card.characterName ?? null,
          affiliations: card.affiliations ?? null,
          abilities: card.abilities ?? null,
          version: card.version ?? null,
        }, { onConflict: 'set_id,number' })
        .select('id')
        .single()

      if (cardError || !cardRow) {
        logs.push(`[ERR] ${card.name} — ${cardError?.message ?? 'upsert carte échoué'}`)
        errors.push({ item: card.name ?? card.number ?? 'carte inconnue', message: cardError?.message ?? 'Upsert carte échoué' })
        continue
      }

      if (standardVariant) {
        // ignoreDuplicates : ne jamais écraser quantity/price d'un listing existant sur ré-import
        const { data: listingRow, error: listingError } = await supabase
          .from('onepiece_listings')
          .upsert({
            card_id: cardRow.id,
            variant_type_id: standardVariant.id,
            quantity: 0,
            price: 0.00,
            image_api: card.image ?? null,
          }, { onConflict: 'card_id,variant_type_id,condition,copy_index', ignoreDuplicates: true })
          .select('id')
          .maybeSingle()

        if (listingError) {
          logs.push(`[ERR] Listing ${card.name} — ${listingError.message}`)
          errors.push({ item: `${card.name} (listing)`, message: listingError.message })
        } else if (listingRow) {
          listingsCreated++
        }
      }

      cardsImported++
    }

    logs.push(`[DONE] ${cardsImported} cartes importées${errors.length ? `, ${errors.length} erreur(s)` : ''}`)

    return NextResponse.json({
      ok: true,
      logs,
      stats: buildStats({ setsProcessed: 1, cardsImported, listingsCreated, errors, start }),
    })

  } catch (err) {
    const unavailable = err instanceof OPECardsUnavailableError
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    logs.push(`[ERR] ${message}`)
    return NextResponse.json(
      {
        ok: false,
        logs,
        stats: buildStats({ setsProcessed: 0, cardsImported, listingsCreated, errors, start }),
        error: message,
      },
      { status: unavailable ? 503 : 500 }
    )
  }
}

// ─────────────────────────────────────────────────────────────
// Import bulk — tous les sets Poneglyphe en une passe
// ─────────────────────────────────────────────────────────────
async function handleBulkImport() {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.response
  const { supabase } = auth

  const start = Date.now()
  const logs: string[] = []
  const errors: ImportError[] = []
  let cardsImported = 0
  let listingsCreated = 0
  let setsProcessed = 0

  logs.push('[START] Récupération de tous les sets Poneglyphe...')

  let allSets: OPESet[]
  try {
    allSets = await fetchOPESets()
  } catch (err) {
    const unavailable = err instanceof OPECardsUnavailableError
    const message = err instanceof Error ? err.message : 'API injoignable'
    logs.push(`[ERR] Poneglyphe indisponible — ${message}`)
    // Indisponibilité = échec explicite, pas un ok:true avec 0 traité
    return NextResponse.json(
      {
        ok: false,
        logs,
        stats: buildStats({ setsProcessed, cardsImported, listingsCreated, errors, start }),
        error: message,
      },
      { status: unavailable ? 503 : 500 }
    )
  }
  logs.push(`[OK] ${allSets.length} sets trouvés`)

  for (const setMeta of allSets) {
    try {
      logs.push(`[SET] Import de ${setMeta.name} (${setMeta.code ?? setMeta.id})...`)
      const setData = await fetchOPESet(setMeta.id)

      const { data: setRow, error: setError } = await supabase
        .from('onepiece_sets')
        .upsert({
          code: (setData.code ?? setMeta.code ?? setMeta.id).toUpperCase(),
          name_fr: setData.name,
          release_date: setData.releaseDate ?? null,
          image_url: setData.image ?? null,
          card_count: setData.cardCount ?? setData.cards?.length ?? null,
          serie_id: setData.serieId ?? null,
          serie_name: setData.serieName ?? null,
        }, { onConflict: 'code' })
        .select('id')
        .single()

      if (setError || !setRow) {
        logs.push(`[ERR] ${setMeta.name} — erreur set : ${setError?.message ?? 'inconnue'}`)
        errors.push({ item: setMeta.name, message: setError?.message ?? 'Upsert set échoué' })
        continue
      }

      const { data: globalVariants } = await supabase
        .from('onepiece_variant_types')
        .select('id, code')
        .is('set_id', null)

      const standardVariant = globalVariants?.find(v => v.code === 'STANDARD')

      let setImported = 0
      for (const card of (setData.cards ?? [])) {
        const { data: cardRow, error: cardError } = await supabase
          .from('onepiece_cards')
          .upsert({
            set_id: setRow.id,
            number: card.number,
            name_fr: card.name,
            image_url: card.image ?? null,
            rarity: card.rarity ?? null,
            card_type: card.type ?? null,
            color: card.color ?? null,
            power: card.power ?? null,
            life_points: card.life ?? null,
            opecards_id: card.id,
            colors: card.colors ?? null,
            attribute: card.attribute ?? null,
            cost: card.cost ?? null,
            counter: card.counter ?? null,
            effect: card.effect ?? null,
            trigger_effect: card.triggerEffect ?? null,
            character_name: card.characterName ?? null,
            affiliations: card.affiliations ?? null,
            abilities: card.abilities ?? null,
            version: card.version ?? null,
          }, { onConflict: 'set_id,number' })
          .select('id')
          .single()

        if (cardError || !cardRow) {
          logs.push(`[ERR] ${setMeta.name} / ${card.name} — ${cardError?.message ?? 'upsert carte échoué'}`)
          errors.push({ item: `${setMeta.name} / ${card.name}`, message: cardError?.message ?? 'Upsert carte échoué' })
          continue
        }

        if (standardVariant) {
          const { data: listingRow, error: listingError } = await supabase
            .from('onepiece_listings')
            .upsert({
              card_id: cardRow.id,
              variant_type_id: standardVariant.id,
              quantity: 0,
              price: 0.00,
              image_api: card.image ?? null,
            }, { onConflict: 'card_id,variant_type_id,condition,copy_index', ignoreDuplicates: true })
            .select('id')
            .maybeSingle()

          if (listingError) {
            errors.push({ item: `${setMeta.name} / ${card.name} (listing)`, message: listingError.message })
          } else if (listingRow) {
            listingsCreated++
          }
        }
        setImported++
      }

      cardsImported += setImported
      setsProcessed++
      logs.push(`[OK] ${setMeta.name} — ${setImported} cartes`)

      // Pause pour éviter rate limit Poneglyphe
      await new Promise(r => setTimeout(r, 200))

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      logs.push(`[ERR] ${setMeta.name} — ${message}`)
      errors.push({ item: setMeta.name, message })

      if (err instanceof OPECardsUnavailableError) {
        // Le domaine est devenu injoignable en cours de passe — inutile de continuer
        // à échouer sur chaque set restant : on arrête et on remonte l'indisponibilité.
        logs.push('[ERR] Poneglyphe injoignable — arrêt de la passe bulk')
        return NextResponse.json(
          {
            ok: false,
            logs,
            stats: buildStats({ setsProcessed, cardsImported, listingsCreated, errors, start }),
            error: 'Source Poneglyphe injoignable. Import interrompu.',
          },
          { status: 503 }
        )
      }
    }
  }

  logs.push(`[DONE] ${setsProcessed} sets · ${cardsImported} cartes importées · ${errors.length} erreur(s)`)
  return NextResponse.json({
    ok: true,
    logs,
    stats: buildStats({ setsProcessed, cardsImported, listingsCreated, errors, start }),
  })
}

// ─────────────────────────────────────────────────────────────
// Sync — nouveaux sets + cartes manquantes (listings existants conservés)
// ─────────────────────────────────────────────────────────────
async function handleSync() {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.response
  const { supabase } = auth

  const start = Date.now()
  const logs: string[] = []
  const errors: ImportError[] = []
  let cardsImported = 0
  let listingsCreated = 0
  let setsProcessed = 0

  logs.push('[SYNC] Vérification des sets Poneglyphe...')

  // Sets déjà en BDD
  const { data: existingSets } = await supabase
    .from('onepiece_sets')
    .select('id, code')

  const existingCodes = new Set((existingSets ?? []).map(s => s.code))

  // Tous les sets Poneglyphe
  let allSets: OPESet[]
  try {
    allSets = await fetchOPESets()
  } catch (err) {
    const unavailable = err instanceof OPECardsUnavailableError
    const message = err instanceof Error ? err.message : 'API injoignable'
    logs.push(`[ERR] Poneglyphe indisponible — ${message}`)
    return NextResponse.json(
      {
        ok: false,
        logs,
        stats: buildStats({ setsProcessed, cardsImported, listingsCreated, errors, start }),
        error: message,
      },
      { status: unavailable ? 503 : 500 }
    )
  }
  logs.push(`[OK] ${allSets.length} sets disponibles · ${existingCodes.size} déjà en BDD`)

  // Poneglyphe : l'id API ≠ le code stocké → on résout l'id via la liste fetchée
  const idByCode = new Map(allSets.map(s => [(s.code ?? s.id).toUpperCase(), s.id]))

  // Nouveaux sets
  const newSetsMeta = allSets.filter(s => !existingCodes.has((s.code ?? s.id).toUpperCase()))
  logs.push(`[SYNC] ${newSetsMeta.length} nouveau(x) set(s) détecté(s)`)

  for (const setMeta of newSetsMeta) {
    try {
      const setData = await fetchOPESet(setMeta.id)
      const { data: setRow, error: setError } = await supabase
        .from('onepiece_sets')
        .upsert({
          code: (setData.code ?? setMeta.code ?? setMeta.id).toUpperCase(),
          name_fr: setData.name,
          release_date: setData.releaseDate ?? null,
          image_url: setData.image ?? null,
          card_count: setData.cardCount ?? setData.cards?.length ?? null,
          serie_id: setData.serieId ?? null,
          serie_name: setData.serieName ?? null,
        }, { onConflict: 'code' })
        .select('id')
        .single()

      if (setError || !setRow) {
        logs.push(`[ERR] ${setMeta.name} — erreur set : ${setError?.message ?? 'inconnue'}`)
        errors.push({ item: setMeta.name, message: setError?.message ?? 'Upsert set échoué' })
        continue
      }

      const { data: globalVariants } = await supabase
        .from('onepiece_variant_types').select('id, code').is('set_id', null)
      const standardVariant = globalVariants?.find(v => v.code === 'STANDARD')

      for (const card of (setData.cards ?? [])) {
        const { data: cardRow, error: cardError } = await supabase
          .from('onepiece_cards')
          .upsert({
            set_id: setRow.id,
            number: card.number,
            name_fr: card.name,
            image_url: card.image ?? null,
            rarity: card.rarity ?? null,
            card_type: card.type ?? null,
            color: card.color ?? null,
            power: card.power ?? null,
            life_points: card.life ?? null,
            opecards_id: card.id,
            colors: card.colors ?? null,
            attribute: card.attribute ?? null,
            cost: card.cost ?? null,
            counter: card.counter ?? null,
            effect: card.effect ?? null,
            trigger_effect: card.triggerEffect ?? null,
            character_name: card.characterName ?? null,
            affiliations: card.affiliations ?? null,
            abilities: card.abilities ?? null,
            version: card.version ?? null,
          }, { onConflict: 'set_id,number' })
          .select('id').single()

        if (cardError || !cardRow) {
          logs.push(`[ERR] ${setMeta.name} / ${card.name} — ${cardError?.message ?? 'upsert carte échoué'}`)
          errors.push({ item: `${setMeta.name} / ${card.name}`, message: cardError?.message ?? 'Upsert carte échoué' })
          continue
        }

        if (standardVariant) {
          const { data: listingRow, error: listingError } = await supabase
            .from('onepiece_listings')
            .upsert({ card_id: cardRow.id, variant_type_id: standardVariant.id, quantity: 0, price: 0 }, { onConflict: 'card_id,variant_type_id,condition,copy_index', ignoreDuplicates: true })
            .select('id')
            .maybeSingle()

          if (listingError) {
            errors.push({ item: `${setMeta.name} / ${card.name} (listing)`, message: listingError.message })
          } else if (listingRow) {
            listingsCreated++
          }
        }
        cardsImported++
      }

      setsProcessed++
      logs.push(`[NEW] ${setMeta.name} ajouté — ${setData.cards?.length ?? 0} cartes`)
      await new Promise(r => setTimeout(r, 200))

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      logs.push(`[ERR] ${setMeta.name} — ${message}`)
      errors.push({ item: setMeta.name, message })

      if (err instanceof OPECardsUnavailableError) {
        logs.push('[ERR] Poneglyphe injoignable — arrêt de la synchro')
        return NextResponse.json(
          {
            ok: false,
            logs,
            stats: buildStats({ setsProcessed, cardsImported, listingsCreated, errors, start }),
            error: 'Source Poneglyphe injoignable. Synchro interrompue.',
          },
          { status: 503 }
        )
      }
    }
  }

  // Sync cartes manquantes dans sets existants
  logs.push('[SYNC] Vérification cartes manquantes dans sets existants...')
  for (const existingSet of (existingSets ?? [])) {
    const apiId = idByCode.get(existingSet.code)
    if (!apiId) continue // set absent de la liste Poneglyphe courante — ignorer
    try {
      const setData = await fetchOPESet(apiId)
      const { data: existingCards } = await supabase
        .from('onepiece_cards')
        .select('number')
        .eq('set_id', existingSet.id)

      const existingNumbers = new Set((existingCards ?? []).map(c => c.number))
      const missingCards = (setData.cards ?? []).filter(c => !existingNumbers.has(c.number))

      if (missingCards.length > 0) {
        logs.push(`[SYNC] ${existingSet.code} — ${missingCards.length} carte(s) manquante(s)`)
        const { data: globalVariants } = await supabase.from('onepiece_variant_types').select('id, code').is('set_id', null)
        const standardVariant = globalVariants?.find(v => v.code === 'STANDARD')

        for (const card of missingCards) {
          const { data: cardRow, error: cardError } = await supabase
            .from('onepiece_cards')
            .upsert({
              set_id: existingSet.id,
              number: card.number,
              name_fr: card.name,
              image_url: card.image ?? null,
              rarity: card.rarity ?? null,
              card_type: card.type ?? null,
              color: card.color ?? null,
              power: card.power ?? null,
              life_points: card.life ?? null,
              opecards_id: card.id,
            }, { onConflict: 'set_id,number' })
            .select('id').single()

          if (cardError || !cardRow) {
            logs.push(`[ERR] ${existingSet.code} / ${card.name} — ${cardError?.message ?? 'upsert carte échoué'}`)
            errors.push({ item: `${existingSet.code} / ${card.name}`, message: cardError?.message ?? 'Upsert carte échoué' })
            continue
          }

          if (standardVariant) {
            const { data: listingRow, error: listingError } = await supabase
              .from('onepiece_listings')
              .upsert({ card_id: cardRow.id, variant_type_id: standardVariant.id, quantity: 0, price: 0 }, { onConflict: 'card_id,variant_type_id,condition,copy_index', ignoreDuplicates: true })
              .select('id')
              .maybeSingle()

            if (listingError) {
              errors.push({ item: `${existingSet.code} / ${card.name} (listing)`, message: listingError.message })
            } else if (listingRow) {
              listingsCreated++
            }
          }
          cardsImported++
        }
      }

      await new Promise(r => setTimeout(r, 100))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      logs.push(`[ERR] ${existingSet.code} — ${message}`)
      errors.push({ item: existingSet.code, message })

      if (err instanceof OPECardsUnavailableError) {
        logs.push('[ERR] Poneglyphe injoignable — arrêt de la synchro')
        return NextResponse.json(
          {
            ok: false,
            logs,
            stats: buildStats({ setsProcessed, cardsImported, listingsCreated, errors, start }),
            error: 'Source Poneglyphe injoignable. Synchro interrompue.',
          },
          { status: 503 }
        )
      }
    }
  }

  logs.push(`[DONE] ${setsProcessed} nouveau(x) set(s) · ${cardsImported} nouvelle(s) carte(s) ajoutée(s) · ${errors.length} erreur(s)`)
  return NextResponse.json({
    ok: true,
    logs,
    stats: buildStats({ setsProcessed, cardsImported, listingsCreated, errors, start }),
  })
}
