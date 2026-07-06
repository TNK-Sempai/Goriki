import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { fetchSets, fetchSet } from '@/lib/tcgdex'

// Le bulk import peut traiter 100+ sets × 200ms de pause → dépasse les 60s par défaut Vercel
export const maxDuration = 300 // 5 min — Vercel Pro

// TCGdex renvoie aussi `symbol` (icône du set) en plus de `logo` — souvent sans extension
function symbolUrl(symbol?: string): string | null {
  if (!symbol) return null
  return symbol.match(/\.(png|jpg|webp|svg)$/) ? symbol : symbol + '.png'
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action === 'bulk') return handleBulkImport(request)
  if (action === 'sync') return handleSync(request)
  return handleSingleImport(request) // comportement actuel (import unitaire)
}

export async function GET() {
  const sets = await fetch('https://api.tcgdex.net/v2/fr/sets').then(r => r.json())
  return NextResponse.json(sets)
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
    // 1. Récupérer le set depuis TCGdex
    logs.push(`[TCGdex] Récupération du set ${setId}...`)
    const setData = await fetchSet(setId)
    logs.push(`[TCGdex] Set trouvé : ${setData.name} (${setData.cards?.length ?? 0} cartes)`)

    // 2. Upsert le set
    const { data: setRow, error: setError } = await supabase
      .from('pokemon_sets')
      .upsert({
        code: setData.id.toUpperCase(),
        name_fr: setData.name,
        release_date: setData.releaseDate ?? null,
        image_url: setData.logo
          ? (setData.logo.match(/\.(png|jpg|webp|svg)$/) ? setData.logo : setData.logo + '.png')
          : null,
        symbol_url: symbolUrl((setData as { symbol?: string }).symbol),
        card_count: setData.cardCount?.total ?? null,
      }, { onConflict: 'code' })
      .select('id')
      .single()

    if (setError || !setRow) {
      logs.push(`[ERREUR] Upsert set : ${setError?.message}`)
      return NextResponse.json({ logs, error: setError?.message }, { status: 500 })
    }
    logs.push(`[DB] Set upserted → id: ${setRow.id}`)

    // 3. Récupérer les variantes globales (set_id IS NULL)
    const { data: globalVariants } = await supabase
      .from('pokemon_variant_types')
      .select('id, code')
      .is('set_id', null)

    const normalVariant   = globalVariants?.find(v => v.code === 'NORMAL')
    const reverseVariant  = globalVariants?.find(v => v.code === 'REVERSE')
    const holoVariant     = globalVariants?.find(v => v.code === 'HOLO')
    const firstEdVariant  = globalVariants?.find(v => v.code === 'FIRST_EDITION')

    // 4. Importer les cartes
    const cards = setData.cards ?? []
    let imported = 0
    let skipped = 0

    for (const card of cards) {
      const cardNumber = String(card.localId ?? card.id)
      const imageSuffix = card.image
        ? (card.image.match(/\.(png|jpg|webp)$/) ? card.image : `${card.image}/high.webp`)
        : null

      const { data: cardRow, error: cardError } = await supabase
        .from('pokemon_cards')
        .upsert({
          set_id: setRow.id,
          number: cardNumber,
          name_fr: card.name,
          image_url: imageSuffix,
          rarity: card.rarity ?? null,
          card_type: card.category ?? null,
          attribute: card.types?.[0] ?? null,
          tcgdex_id: card.id,
        }, { onConflict: 'set_id,number' })
        .select('id')
        .single()

      if (cardError || !cardRow) {
        logs.push(`[SKIP] ${card.name} — ${cardError?.message}`)
        skipped++
        continue
      }

      // Créer uniquement les listings correspondant aux variantes réelles TCGdex
      const cardVariants = (card as { variants?: { normal?: boolean; reverse?: boolean; holo?: boolean; firstEdition?: boolean } }).variants ?? {}

      const listingsToCreate = [
        cardVariants.normal       && normalVariant   ? normalVariant.id   : null,
        cardVariants.reverse      && reverseVariant  ? reverseVariant.id  : null,
        cardVariants.holo         && holoVariant     ? holoVariant.id     : null,
        cardVariants.firstEdition && firstEdVariant  ? firstEdVariant.id  : null,
      ].filter(Boolean) as string[]

      for (const variantTypeId of listingsToCreate) {
        await supabase.from('pokemon_listings').upsert({
          card_id: cardRow.id,
          variant_type_id: variantTypeId,
          quantity: 0,
          price: 0.00,
          image_api: imageSuffix,
        }, { onConflict: 'card_id,variant_type_id,condition' })
      }

      imported++
    }

    logs.push(`[DONE] ${imported} cartes importées, ${skipped} ignorées`)
    return NextResponse.json({ logs, imported, skipped, setId: setRow.id })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    logs.push(`[ERREUR] ${message}`)
    return NextResponse.json({ logs, error: message }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// Import bulk — tous les sets TCGdex en une passe
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
    // Récupérer tous les sets TCGdex
    logs.push('[START] Récupération de tous les sets TCGdex...')
    const allSets = await fetchSets()
    logs.push(`[TCGdex] ${allSets.length} sets trouvés`)

    for (const setMeta of allSets) {
      try {
        logs.push(`[SET] Import de ${setMeta.name} (${setMeta.id})...`)
        const setData = await fetchSet(setMeta.id)

        // Upsert set
        const { data: setRow, error: setError } = await supabase
          .from('pokemon_sets')
          .upsert({
            code: setData.id.toUpperCase(),
            name_fr: setData.name,
            release_date: setData.releaseDate ?? null,
            image_url: setData.logo
          ? (setData.logo.match(/\.(png|jpg|webp|svg)$/) ? setData.logo : setData.logo + '.png')
          : null,
            symbol_url: symbolUrl((setData as { symbol?: string }).symbol),
            card_count: setData.cardCount?.total ?? null,
          }, { onConflict: 'code' })
          .select('id')
          .single()

        if (setError || !setRow) {
          logs.push(`[SKIP] ${setMeta.name} — erreur set: ${setError?.message}`)
          totalSkipped++
          continue
        }

        // Variantes globales
        const { data: globalVariants } = await supabase
          .from('pokemon_variant_types')
          .select('id, code')
          .is('set_id', null)

        const normalVariant   = globalVariants?.find(v => v.code === 'NORMAL')
        const reverseVariant  = globalVariants?.find(v => v.code === 'REVERSE')
        const holoVariant     = globalVariants?.find(v => v.code === 'HOLO')
        const firstEdVariant  = globalVariants?.find(v => v.code === 'FIRST_EDITION')

        // Upsert cartes + listings
        let setImported = 0
        for (const card of (setData.cards ?? [])) {
          const cardNumber = String(card.localId ?? card.id)
          const imageSuffix = card.image
        ? (card.image.match(/\.(png|jpg|webp)$/) ? card.image : `${card.image}/high.webp`)
        : null

          const { data: cardRow } = await supabase
            .from('pokemon_cards')
            .upsert({
              set_id: setRow.id,
              number: cardNumber,
              name_fr: card.name,
              image_url: imageSuffix,
              rarity: card.rarity ?? null,
              card_type: card.category ?? null,
              attribute: card.types?.[0] ?? null,
              tcgdex_id: card.id,
            }, { onConflict: 'set_id,number' })
            .select('id')
            .single()

          if (!cardRow) continue

          // Créer uniquement les listings correspondant aux variantes réelles TCGdex
          const cardVariants = (card as { variants?: { normal?: boolean; reverse?: boolean; holo?: boolean; firstEdition?: boolean } }).variants ?? {}

          const listingsToCreate = [
            cardVariants.normal       && normalVariant   ? normalVariant.id   : null,
            cardVariants.reverse      && reverseVariant  ? reverseVariant.id  : null,
            cardVariants.holo         && holoVariant     ? holoVariant.id     : null,
            cardVariants.firstEdition && firstEdVariant  ? firstEdVariant.id  : null,
          ].filter(Boolean) as string[]

          for (const variantTypeId of listingsToCreate) {
            await supabase.from('pokemon_listings').upsert({
              card_id: cardRow.id,
              variant_type_id: variantTypeId,
              quantity: 0,
              price: 0.00,
              image_api: imageSuffix,
            }, { onConflict: 'card_id,variant_type_id,condition' })
          }
          setImported++
        }

        totalImported += setImported
        setsProcessed++
        logs.push(`[OK] ${setMeta.name} — ${setImported} cartes`)

        // Pause pour éviter rate limit TCGdex
        await new Promise(r => setTimeout(r, 200))

      } catch (err) {
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
    logs.push('[SYNC] Vérification des sets TCGdex...')

    // Sets déjà en BDD
    const { data: existingSets } = await supabase
      .from('pokemon_sets')
      .select('id, code')

    const existingCodes = new Set((existingSets ?? []).map(s => s.code))

    // Tous les sets TCGdex
    const allSets = await fetchSets()
    logs.push(`[TCGdex] ${allSets.length} sets disponibles · ${existingCodes.size} déjà en BDD`)

    // Nouveaux sets
    const newSetsMeta = allSets.filter(s => !existingCodes.has(s.id.toUpperCase()))
    logs.push(`[SYNC] ${newSetsMeta.length} nouveau(x) set(s) détecté(s)`)

    // Importer les nouveaux sets complets
    for (const setMeta of newSetsMeta) {
      try {
        const setData = await fetchSet(setMeta.id)
        const { data: setRow } = await supabase
          .from('pokemon_sets')
          .upsert({
            code: setData.id.toUpperCase(),
            name_fr: setData.name,
            release_date: setData.releaseDate ?? null,
            image_url: setData.logo
          ? (setData.logo.match(/\.(png|jpg|webp|svg)$/) ? setData.logo : setData.logo + '.png')
          : null,
            symbol_url: symbolUrl((setData as { symbol?: string }).symbol),
            card_count: setData.cardCount?.total ?? null,
          }, { onConflict: 'code' })
          .select('id')
          .single()

        if (!setRow) continue

        const { data: globalVariants } = await supabase
          .from('pokemon_variant_types').select('id, code').is('set_id', null)
        const normalVariant = globalVariants?.find(v => v.code === 'NORMAL')
        const reverseVariant = globalVariants?.find(v => v.code === 'REVERSE')

        for (const card of (setData.cards ?? [])) {
          const { data: cardRow } = await supabase
            .from('pokemon_cards')
            .upsert({
              set_id: setRow.id,
              number: String(card.localId ?? card.id),
              name_fr: card.name,
              image_url: card.image
                ? (card.image.match(/\.(png|jpg|webp)$/) ? card.image : `${card.image}/high.webp`)
                : null,
              rarity: card.rarity ?? null,
              card_type: card.category ?? null,
              tcgdex_id: card.id,
            }, { onConflict: 'set_id,number' })
            .select('id').single()

          if (cardRow) {
            if (normalVariant) await supabase.from('pokemon_listings').upsert({ card_id: cardRow.id, variant_type_id: normalVariant.id, quantity: 0, price: 0 }, { onConflict: 'card_id,variant_type_id,condition' })
            if (reverseVariant) await supabase.from('pokemon_listings').upsert({ card_id: cardRow.id, variant_type_id: reverseVariant.id, quantity: 0, price: 0 }, { onConflict: 'card_id,variant_type_id,condition' })
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
      try {
        const setData = await fetchSet(existingSet.code.toLowerCase())
        const { data: existingCards } = await supabase
          .from('pokemon_cards')
          .select('number')
          .eq('set_id', existingSet.id)

        const existingNumbers = new Set((existingCards ?? []).map(c => c.number))
        const missingCards = (setData.cards ?? []).filter(c => !existingNumbers.has(String(c.localId ?? c.id)))

        if (missingCards.length > 0) {
          logs.push(`[SYNC] ${existingSet.code} — ${missingCards.length} carte(s) manquante(s)`)
          const { data: globalVariants } = await supabase.from('pokemon_variant_types').select('id, code').is('set_id', null)
          const normalVariant = globalVariants?.find(v => v.code === 'NORMAL')

          for (const card of missingCards) {
            const { data: cardRow } = await supabase
              .from('pokemon_cards')
              .upsert({
                set_id: existingSet.id,
                number: String(card.localId ?? card.id),
                name_fr: card.name,
                image_url: card.image
                ? (card.image.match(/\.(png|jpg|webp)$/) ? card.image : `${card.image}/high.webp`)
                : null,
                rarity: card.rarity ?? null,
                tcgdex_id: card.id,
              }, { onConflict: 'set_id,number' })
              .select('id').single()

            if (cardRow && normalVariant) {
              await supabase.from('pokemon_listings').upsert({ card_id: cardRow.id, variant_type_id: normalVariant.id, quantity: 0, price: 0 }, { onConflict: 'card_id,variant_type_id,condition' })
              newCards++
            }
          }
        }

        await new Promise(r => setTimeout(r, 100))
      } catch {
        // Set TCGdex introuvable par ce code — ignorer
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
