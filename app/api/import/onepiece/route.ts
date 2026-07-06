import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { fetchOPESets, fetchOPESet } from '@/lib/opecards'

// Cohérence avec le bulk Pokémon — OPECards peut être lent / multi-sets
export const maxDuration = 300 // 5 min — Vercel Pro

export async function GET() {
  try {
    const sets = await fetchOPESets()
    return NextResponse.json(sets)
  } catch {
    return NextResponse.json({ error: 'Erreur OPECards' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action === 'bulk') return handleBulkImport(request)
  if (action === 'sync') return handleSync(request)
  return handleSingleImport(request) // comportement actuel (import unitaire)
}

// ─────────────────────────────────────────────────────────────
// Import unitaire (comportement historique)
// ─────────────────────────────────────────────────────────────
async function handleSingleImport(request: NextRequest) {
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
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { setId } = await request.json()
  if (!setId) return NextResponse.json({ error: 'setId requis' }, { status: 400 })

  const logs: string[] = []

  try {
    logs.push(`[OPECards] Récupération du set ${setId}...`)
    const setData = await fetchOPESet(setId)
    logs.push(`[OPECards] Set trouvé : ${setData.name} (${setData.cards?.length ?? 0} cartes)`)

    const { data: setRow, error: setError } = await supabase
      .from('onepiece_sets')
      .upsert({
        code: (setData.code ?? setId).toUpperCase(),
        name_fr: setData.name,
        release_date: setData.releaseDate ?? null,
        image_url: setData.image ?? null,
        card_count: setData.cardCount ?? setData.cards?.length ?? null,
      }, { onConflict: 'code' })
      .select('id')
      .single()

    if (setError || !setRow) {
      logs.push(`[ERREUR] Upsert set : ${setError?.message}`)
      return NextResponse.json({ logs, error: setError?.message }, { status: 500 })
    }
    logs.push(`[DB] Set upserted → id: ${setRow.id}`)

    const { data: globalVariants } = await supabase
      .from('onepiece_variant_types')
      .select('id, code')
      .is('set_id', null)

    const standardVariant = globalVariants?.find(v => v.code === 'STANDARD')

    const cards = setData.cards ?? []
    let imported = 0
    let skipped = 0

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
        }, { onConflict: 'set_id,number' })
        .select('id')
        .single()

      if (cardError || !cardRow) {
        logs.push(`[SKIP] ${card.name} — ${cardError?.message}`)
        skipped++
        continue
      }

      if (standardVariant) {
        await supabase.from('onepiece_listings').upsert({
          card_id: cardRow.id,
          variant_type_id: standardVariant.id,
          quantity: 0,
          price: 0.00,
          image_api: card.image ?? null,
        }, { onConflict: 'card_id,variant_type_id,condition' })
      }

      imported++
    }

    logs.push(`[DONE] ${imported} cartes importées, ${skipped} ignorées`)
    return NextResponse.json({ logs, imported, skipped })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    logs.push(`[ERREUR] ${message}`)
    return NextResponse.json({ logs, error: message }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// Import bulk — tous les sets OPECards en une passe
// ─────────────────────────────────────────────────────────────
async function handleBulkImport(request: NextRequest) {
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
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const logs: string[] = []
  let totalImported = 0
  let totalSkipped = 0
  let setsProcessed = 0

  try {
    logs.push('[START] Récupération de tous les sets OPECards...')
    let allSets
    try {
      allSets = await fetchOPESets()
    } catch (err) {
      // OPECards API down — logger et arrêter proprement sans crasher
      const msg = err instanceof Error ? err.message : 'API injoignable'
      logs.push(`[ERREUR] OPECards indisponible : ${msg}`)
      return NextResponse.json({ logs, setsProcessed, totalImported, totalSkipped })
    }
    logs.push(`[OPECards] ${allSets.length} sets trouvés`)

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
          }, { onConflict: 'code' })
          .select('id')
          .single()

        if (setError || !setRow) {
          logs.push(`[SKIP] ${setMeta.name} — erreur set: ${setError?.message}`)
          totalSkipped++
          continue
        }

        const { data: globalVariants } = await supabase
          .from('onepiece_variant_types')
          .select('id, code')
          .is('set_id', null)

        const standardVariant = globalVariants?.find(v => v.code === 'STANDARD')

        let setImported = 0
        for (const card of (setData.cards ?? [])) {
          const { data: cardRow } = await supabase
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
            }, { onConflict: 'set_id,number' })
            .select('id')
            .single()

          if (!cardRow) continue

          if (standardVariant) {
            await supabase.from('onepiece_listings').upsert({
              card_id: cardRow.id,
              variant_type_id: standardVariant.id,
              quantity: 0,
              price: 0.00,
              image_api: card.image ?? null,
            }, { onConflict: 'card_id,variant_type_id,condition' })
          }
          setImported++
        }

        totalImported += setImported
        setsProcessed++
        logs.push(`[OK] ${setMeta.name} — ${setImported} cartes`)

        // Pause pour éviter rate limit OPECards
        await new Promise(r => setTimeout(r, 200))

      } catch (err) {
        // Un set en erreur (API down ponctuelle, set introuvable…) ne stoppe pas la passe
        const msg = err instanceof Error ? err.message : 'Erreur inconnue'
        logs.push(`[ERR] ${setMeta.name} — ${msg}`)
        totalSkipped++
      }
    }

    logs.push(`[DONE] ${setsProcessed} sets · ${totalImported} cartes importées · ${totalSkipped} sets ignorés`)
    return NextResponse.json({ logs, setsProcessed, totalImported, totalSkipped })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    logs.push(`[ERREUR] ${message}`)
    return NextResponse.json({ logs, error: message }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// Sync — nouveaux sets + cartes manquantes (listings existants conservés)
// ─────────────────────────────────────────────────────────────
async function handleSync(request: NextRequest) {
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
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const logs: string[] = []
  let newCards = 0
  let newSets = 0

  try {
    logs.push('[SYNC] Vérification des sets OPECards...')

    // Sets déjà en BDD
    const { data: existingSets } = await supabase
      .from('onepiece_sets')
      .select('id, code')

    const existingCodes = new Set((existingSets ?? []).map(s => s.code))

    // Tous les sets OPECards
    let allSets
    try {
      allSets = await fetchOPESets()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'API injoignable'
      logs.push(`[ERREUR] OPECards indisponible : ${msg}`)
      return NextResponse.json({ logs, newSets, newCards })
    }
    logs.push(`[OPECards] ${allSets.length} sets disponibles · ${existingCodes.size} déjà en BDD`)

    // OPECards : l'id API ≠ le code stocké → on résout l'id via la liste fetchée
    const idByCode = new Map(allSets.map(s => [(s.code ?? s.id).toUpperCase(), s.id]))

    // Nouveaux sets
    const newSetsMeta = allSets.filter(s => !existingCodes.has((s.code ?? s.id).toUpperCase()))
    logs.push(`[SYNC] ${newSetsMeta.length} nouveau(x) set(s) détecté(s)`)

    for (const setMeta of newSetsMeta) {
      try {
        const setData = await fetchOPESet(setMeta.id)
        const { data: setRow } = await supabase
          .from('onepiece_sets')
          .upsert({
            code: (setData.code ?? setMeta.code ?? setMeta.id).toUpperCase(),
            name_fr: setData.name,
            release_date: setData.releaseDate ?? null,
            image_url: setData.image ?? null,
            card_count: setData.cardCount ?? setData.cards?.length ?? null,
          }, { onConflict: 'code' })
          .select('id')
          .single()

        if (!setRow) continue

        const { data: globalVariants } = await supabase
          .from('onepiece_variant_types').select('id, code').is('set_id', null)
        const standardVariant = globalVariants?.find(v => v.code === 'STANDARD')

        for (const card of (setData.cards ?? [])) {
          const { data: cardRow } = await supabase
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
            }, { onConflict: 'set_id,number' })
            .select('id').single()

          if (cardRow) {
            if (standardVariant) await supabase.from('onepiece_listings').upsert({ card_id: cardRow.id, variant_type_id: standardVariant.id, quantity: 0, price: 0 }, { onConflict: 'card_id,variant_type_id,condition' })
            newCards++
          }
        }

        newSets++
        logs.push(`[NEW] ${setMeta.name} ajouté — ${setData.cards?.length ?? 0} cartes`)
        await new Promise(r => setTimeout(r, 200))

      } catch (err) {
        logs.push(`[ERR] ${setMeta.name} — ${err instanceof Error ? err.message : 'Erreur'}`)
      }
    }

    // Sync cartes manquantes dans sets existants
    logs.push('[SYNC] Vérification cartes manquantes dans sets existants...')
    for (const existingSet of (existingSets ?? [])) {
      const apiId = idByCode.get(existingSet.code)
      if (!apiId) continue // set absent de la liste OPECards courante — ignorer
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
            const { data: cardRow } = await supabase
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

            if (cardRow && standardVariant) {
              await supabase.from('onepiece_listings').upsert({ card_id: cardRow.id, variant_type_id: standardVariant.id, quantity: 0, price: 0 }, { onConflict: 'card_id,variant_type_id,condition' })
              newCards++
            }
          }
        }

        await new Promise(r => setTimeout(r, 100))
      } catch (err) {
        // Set OPECards introuvable / erreur ponctuelle — logger et continuer
        logs.push(`[ERR] ${existingSet.code} — ${err instanceof Error ? err.message : 'Erreur'}`)
      }
    }

    logs.push(`[DONE] ${newSets} nouveau(x) set(s) · ${newCards} nouvelle(s) carte(s) ajoutée(s)`)
    return NextResponse.json({ logs, newSets, newCards })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    logs.push(`[ERREUR] ${message}`)
    return NextResponse.json({ logs, error: message }, { status: 500 })
  }
}
