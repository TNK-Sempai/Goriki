import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

async function client() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
}

/** Recherche de cartes du catalogue pour rattacher une demande à une référence. */
export async function GET(request: NextRequest) {
  const supabase = await client()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const q = new URL(request.url).searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  const [pkm, op] = await Promise.all([
    supabase
      .from('pokemon_cards')
      .select('id, name_fr, number, pokemon_sets!inner(code)')
      .ilike('name_fr', `%${q}%`)
      .limit(8),
    supabase
      .from('onepiece_cards')
      .select('id, name_fr, number, onepiece_sets!inner(code)')
      .ilike('name_fr', `%${q}%`)
      .limit(8),
  ])

  const flat = (v: unknown) => (Array.isArray(v) ? v[0] : v) as { code?: string } | null

  const results = [
    ...(pkm.data ?? []).map(c => ({
      card_type: 'pokemon' as const,
      card_id: c.id,
      label: `${c.name_fr} · ${flat(c.pokemon_sets)?.code ?? ''}-${c.number}`,
    })),
    ...(op.data ?? []).map(c => ({
      card_type: 'onepiece' as const,
      card_id: c.id,
      label: `${c.name_fr} · ${flat(c.onepiece_sets)?.code ?? ''}-${c.number}`,
    })),
  ]

  return NextResponse.json({ results })
}

/** Création d'une demande. N'exige PAS la vérification d'identité. */
export async function POST(request: NextRequest) {
  const supabase = await client()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const body = await request.json()
  const cardId: string | null = body.card_id ?? null
  const cardType: string | null = body.card_type ?? null
  const freeText: string | null = (body.free_text ?? '').trim() || null
  const maxPriceRaw: string | null = (body.max_price ?? '').toString().trim() || null

  if (!cardId && !freeText) {
    return NextResponse.json(
      { error: 'Choisissez une carte du catalogue ou décrivez celle que vous cherchez.' },
      { status: 400 }
    )
  }
  if (cardId && !cardType) {
    return NextResponse.json({ error: 'Référence de carte incomplète.' }, { status: 400 })
  }

  const maxPrice = maxPriceRaw ? Number(maxPriceRaw.replace(',', '.')) : null
  if (maxPrice !== null && (!Number.isFinite(maxPrice) || maxPrice < 0)) {
    return NextResponse.json({ error: 'Prix maximum invalide.' }, { status: 400 })
  }

  // RLS : `WTB — insert propriétaire` exige user_id = auth.uid().
  const { error } = await supabase.from('want_to_buy_requests').insert({
    user_id: user.id,
    card_type: cardType,
    card_id: cardId,
    free_text: freeText,
    max_price: maxPrice,
  })

  if (error) {
    console.error('[wtb] insertion:', error.message)
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/** Retrait d'une demande — RLS restreint déjà au propriétaire. */
export async function DELETE(request: NextRequest) {
  const supabase = await client()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Demande introuvable' }, { status: 400 })

  const { error } = await supabase.from('want_to_buy_requests').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
