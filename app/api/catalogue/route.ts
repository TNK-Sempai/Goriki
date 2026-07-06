import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cs) { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )

  const { searchParams } = new URL(request.url)
  const tcg = searchParams.get('tcg') ?? 'pokemon'
  const setId = searchParams.get('set_id')
  const rarity = searchParams.get('rarity')
  const variantCode = searchParams.get('variant')
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = 48
  const offset = (page - 1) * limit

  if (tcg === 'pokemon') {
    let query = supabase
      .from('pokemon_listings')
      .select(`
        id, price, quantity, condition, front_photo_url, image_api, needs_photo,
        pokemon_cards!inner(id, number, name_fr, rarity, card_type, attribute, set_id,
          pokemon_sets!inner(id, code, name_fr)),
        pokemon_variant_types!inner(id, code, label)
      `, { count: 'exact' })
      .eq('is_active', true)
      .gt('quantity', 0)

    if (setId) query = query.eq('pokemon_cards.set_id', setId)
    if (rarity) query = query.eq('pokemon_cards.rarity', rarity)
    if (variantCode) query = query.eq('pokemon_variant_types.code', variantCode)

    const { data, count, error } = await query
      .order('pokemon_cards(number)')
      .range(offset, offset + limit - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data, count, page, totalPages: Math.ceil((count ?? 0) / limit) })
  }

  if (tcg === 'onepiece') {
    let query = supabase
      .from('onepiece_listings')
      .select(`
        id, price, quantity, condition, front_photo_url, image_api, needs_photo,
        onepiece_cards!inner(id, number, name_fr, rarity, card_type, color, set_id,
          onepiece_sets!inner(id, code, name_fr)),
        onepiece_variant_types!inner(id, code, label)
      `, { count: 'exact' })
      .eq('is_active', true)
      .gt('quantity', 0)

    if (setId) query = query.eq('onepiece_cards.set_id', setId)
    if (rarity) query = query.eq('onepiece_cards.rarity', rarity)
    if (variantCode) query = query.eq('onepiece_variant_types.code', variantCode)

    const { data, count, error } = await query
      .order('onepiece_cards(number)')
      .range(offset, offset + limit - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data, count, page, totalPages: Math.ceil((count ?? 0) / limit) })
  }

  if (tcg === 'sealed') {
    const { data, count, error } = await supabase
      .from('sealed_products')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .gt('quantity', 0)
      .range(offset, offset + limit - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data, count, page, totalPages: Math.ceil((count ?? 0) / limit) })
  }

  return NextResponse.json({ error: 'tcg invalide' }, { status: 400 })
}
