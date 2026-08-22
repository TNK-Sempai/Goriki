import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

async function getAdminClient() {
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

// GET /api/listings?tcg=pokemon&set_id=xxx
// GET /api/listings?tcg=pokemon&sets_only=true → liste des sets pour le sélecteur
export async function GET(request: NextRequest) {
  const supabase = await getAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // Données de gestion (listings inactifs, needs_photo, price_cm) : admin uniquement
  // — un simple compte client y avait accès (mission 03 §E2).
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const tcg = searchParams.get('tcg') ?? 'pokemon'
  const setId = searchParams.get('set_id')
  const listingId = searchParams.get('listing_id')
  const setsOnly = searchParams.get('sets_only') === 'true'
  // `copies_of` : tous les exemplaires physiques partageant la carte ET la
  // variante du listing donné, états confondus. Sert à naviguer entre
  // exemplaires depuis la fiche admin.
  const copiesOf = searchParams.get('copies_of')

  if (tcg !== 'pokemon' && tcg !== 'onepiece') {
    return NextResponse.json({ error: 'tcg invalide' }, { status: 400 })
  }

  // Sélecteur de sets
  if (setsOnly) {
    const table = tcg === 'onepiece' ? 'onepiece_sets' : 'pokemon_sets'
    const { data, error } = await supabase
      .from(table)
      .select('id, code, name_fr')
      .order('name_fr')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (tcg === 'pokemon') {
    let query = supabase
      .from('pokemon_listings')
      .select(`
        id, quantity, price, condition, needs_photo, is_active, copy_index,
        card_id, variant_type_id, front_photo_url, back_photo_url, image_api,
        pokemon_cards!inner(id, number, name_fr, set_id, rarity),
        pokemon_variant_types!inner(id, code, label)
      `)
      .order('pokemon_cards(number)')

    if (setId) query = query.eq('pokemon_cards.set_id', setId)
    if (listingId) query = query.eq('id', listingId)
    if (copiesOf) {
      const { data: src } = await supabase
        .from('pokemon_listings')
        .select('card_id, variant_type_id')
        .eq('id', copiesOf)
        .single()
      if (!src) return NextResponse.json([])
      query = query.eq('card_id', src.card_id).eq('variant_type_id', src.variant_type_id)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // tcg === 'onepiece'
  let query = supabase
    .from('onepiece_listings')
    .select(`
      id, quantity, price, condition, needs_photo, is_active, copy_index,
      card_id, variant_type_id, front_photo_url, back_photo_url, image_api,
      onepiece_cards!inner(id, number, name_fr, set_id, rarity),
      onepiece_variant_types!inner(id, code, label)
    `)
    .order('onepiece_cards(number)')

  if (setId) query = query.eq('onepiece_cards.set_id', setId)
  if (listingId) query = query.eq('id', listingId)
  if (copiesOf) {
    const { data: src } = await supabase
      .from('onepiece_listings')
      .select('card_id, variant_type_id')
      .eq('id', copiesOf)
      .single()
    if (!src) return NextResponse.json([])
    query = query.eq('card_id', src.card_id).eq('variant_type_id', src.variant_type_id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH /api/listings — mise à jour bulk
export async function PATCH(request: NextRequest) {
  const supabase = await getAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { tcg, updates } = await request.json()
  // updates: Array<{ id: string, quantity?: number, price?: number, condition?: string, is_active?: boolean }>

  const table = tcg === 'onepiece' ? 'onepiece_listings' : 'pokemon_listings'
  const results = []

  for (const update of updates) {
    const { id, ...fields } = update
    const { error } = await supabase.from(table).update(fields).eq('id', id)
    if (error) results.push({ id, error: error.message })
    else results.push({ id, ok: true })
  }

  return NextResponse.json({ results })
}

// POST /api/listings — crée un EXEMPLAIRE physique supplémentaire
//
// Passe par la fonction `admin_add_listing_copy` (migration 0028) plutôt que
// par un insert direct : le calcul de `copy_index` doit être atomique, et la
// règle « pas d'exemplaire distinct sous 1 € » doit vivre au même endroit que
// l'index partiel qui la garantit.
export async function POST(request: NextRequest) {
  const supabase = await getAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const tcg = body?.tcg
  const sourceId = body?.source_id
  const condition = body?.condition
  const price = Number(body?.price)

  if (tcg !== 'pokemon' && tcg !== 'onepiece') {
    return NextResponse.json({ error: 'tcg invalide' }, { status: 400 })
  }
  if (!sourceId || !condition) {
    return NextResponse.json({ error: 'Listing source et état requis.' }, { status: 400 })
  }
  if (!Number.isFinite(price) || price < 1) {
    return NextResponse.json(
      { error: "Un exemplaire distinct suppose un prix d'au moins 1 €." },
      { status: 400 }
    )
  }

  const { data, error } = await supabase.rpc('admin_add_listing_copy', {
    p_universe: tcg,
    p_source_id: sourceId,
    p_condition: condition,
    p_price: price,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ id: data })
}
