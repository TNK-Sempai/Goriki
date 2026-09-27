import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { doitRepasserEnVente } from '@/lib/annonces'

/** Une ligne de `PATCH /api/listings`. Tous les champs sauf `id` sont optionnels. */
interface MiseAJourListing {
  id: string
  quantity?: number
  price?: number
  condition?: string
  is_active?: boolean
}

/** L'état d'une annonce avant la sauvegarde, tel que relu ici. */
interface EtatListing {
  id: string
  price: number
  quantity: number
  is_active: boolean
}

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
    // ARCHI-01 : l'exemplaire ne porte plus `card_id`, `variant_type_id` ni
    // `image_api` — il rejoint la carte par sa VARIANTE, qui porte le visuel.
    // Cette route sert l'écran de STOCK ET PRIX, distinct du nettoyage de
    // catalogue : elle reste donc utile et n'est pas retirée.
    //
    // Pas de `.order(...)` ici, et c'est mesuré : sur SV10, la suite renvoyée
    // avec `.order('number', { referencedTable: 'pokemon_card_variants.pokemon_cards' })`
    // est IDENTIQUE à la suite sans aucun tri, et n'est pas croissante. PostgREST
    // applique ce tri à la ressource INTÉGRÉE, pas aux lignes de premier niveau —
    // sur un embed to-one, cela ne trie rien. Le tri appartient donc au client,
    // via `comparerParCarte`, qui s'appuie sur les clés générées demandées ici.
    let query = supabase
      .from('pokemon_listings')
      .select(`
        id, quantity, price, condition, needs_photo, is_active, copy_index,
        front_photo_url, back_photo_url,
        pokemon_card_variants!inner(
          id, image_url,
          pokemon_cards!inner(id, number, name_fr, set_id, rarity, sort_prefix, sort_num),
          pokemon_variant_types!inner(id, code, label)
        )
      `)

    if (setId) query = query.eq('pokemon_card_variants.pokemon_cards.set_id', setId)
    if (listingId) query = query.eq('id', listingId)
    if (copiesOf) {
      // « Les autres exemplaires de la même variante » : la variante EST la
      // clé de regroupement depuis la séparation.
      const { data: src } = await supabase
        .from('pokemon_listings')
        .select('variant_id')
        .eq('id', copiesOf)
        .single()
      if (!src) return NextResponse.json([])
      query = query.eq('variant_id', src.variant_id)
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

  const table = tcg === 'onepiece' ? 'onepiece_listings' : 'pokemon_listings'
  const lignes = (Array.isArray(updates) ? updates : []) as MiseAJourListing[]
  const results: { id: string; ok?: boolean; error?: string }[] = []

  /**
   * L'état AVANT, lu en une seule requête pour toute la sauvegarde.
   *
   * C'est ce qui permet la remise en vente automatique : la décision porte sur
   * l'état d'avant (masquée, non chiffrée, en stock), pas sur le seul contenu
   * du PATCH. Une lecture par ligne aurait coûté 245 allers-retours sur un set
   * complet ; `in` en coûte un.
   *
   * CETTE ROUTE EST LE SEUL POINT D'ÉCRITURE des trois écrans de saisie :
   * l'édition en ligne de la grille, l'application à une sélection et la fiche
   * d'annonce passent tous par ici. La règle est donc posée une fois, et aucun
   * des trois ne peut l'oublier.
   */
  const ids = lignes.map(l => l.id).filter((v): v is string => typeof v === 'string')
  const { data: avantRows } = ids.length
    ? await supabase.from(table).select('id, price, quantity, is_active').in('id', ids)
    : { data: [] }

  const avantParId = new Map(
    ((avantRows ?? []) as EtatListing[]).map(r => [r.id, r]),
  )

  for (const update of lignes) {
    const { id, ...fields } = update
    const avant = avantParId.get(id)

    if (avant) {
      // `??` et non `||` : un prix ou un stock à 0 est une valeur, pas une
      // absence. `0 || avant.price` aurait silencieusement repris l'ancien prix.
      const apres = {
        price: fields.price ?? avant.price,
        quantity: fields.quantity ?? avant.quantity,
      }

      // La case « actif » envoyée par l'écran n'entre PAS dans la décision :
      // la fiche d'annonce la renvoie telle quelle, donc `false` sur une
      // annonce masquée, sans que personne l'ait touchée. Voir le long
      // commentaire de `doitRepasserEnVente`.
      if (doitRepasserEnVente(avant, apres)) {
        fields.is_active = true
      }
    }

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
