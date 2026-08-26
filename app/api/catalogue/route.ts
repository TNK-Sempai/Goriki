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
      .from('pokemon_card_variants')
      .select(`
        id, image_url,
        pokemon_listings!inner(id, price, quantity, condition, front_photo_url, needs_photo, is_active),
        pokemon_cards!inner(id, number, name_fr, rarity, card_type, attribute, set_id,
          pokemon_sets!inner(id, code, name_fr)),
        pokemon_variant_types!inner(id, code, label)
      `, { count: 'exact' })
      // ARCHI-01 : `is_active` et `quantity` ont quitté cette table pour
      // l'exemplaire. Le filtre porte donc sur la jointure, et `!inner` sur
      // `pokemon_listings` restreint aux variantes réellement en vente — ce que
      // faisaient les deux `eq/gt` d'origine.
      .eq('pokemon_listings.is_active', true)
      .gt('pokemon_listings.quantity', 0)

    if (setId) query = query.eq('pokemon_cards.set_id', setId)
    if (rarity) query = query.eq('pokemon_cards.rarity', rarity)
    if (variantCode) query = query.eq('pokemon_variant_types.code', variantCode)

    // Ordre naturel : `number` est du texte (1, 10, 100, 11…). Colonnes générées
    // par `add_natural_sort_keys_pokemon_cards` — cf. components/catalogue/SetDetail.tsx.
    const { data, count, error } = await query
      // Tri à travers la jointure : la forme `table(colonne)` ne résout plus
      // depuis que la racine est la variante. `referencedTable` est la forme
      // supportée par supabase-js pour ordonner sur une table embarquée.
      .order('sort_prefix', { referencedTable: 'pokemon_cards' })
      .order('sort_num', { referencedTable: 'pokemon_cards' })
      .order('number', { referencedTable: 'pokemon_cards' })
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
