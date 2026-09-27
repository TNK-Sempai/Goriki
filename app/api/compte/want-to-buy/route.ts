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

/**
 * Un seul libellé pour le doublon, partagé par la vérification préalable et par
 * la violation d'unicité. Deux phrases différentes pour la même situation
 * feraient croire à deux problèmes différents.
 */
const DEJA_EN_LISTE = 'Cette carte est déjà dans votre want list.'

/** Sentinelle : distingue « prix absent » (null, légitime) de « prix illisible ». */
const INVALIDE = Symbol('prix invalide')

/**
 * Lecture d'un prix maximum saisi à la main.
 *
 * `null` veut dire « sans limite » et c'est une valeur VOULUE, pas un trou :
 * la colonne est nullable exprès. Une chaîne vide est donc un effacement
 * légitime, alors que « douze euros » est une faute de saisie — les deux ne
 * peuvent pas rendre la même chose.
 */
function lirePrix(brut: string | null): number | null | typeof INVALIDE {
  if (!brut) return null
  const n = Number(brut.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return INVALIDE
  return n
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

  const maxPrice = lirePrix(maxPriceRaw)
  if (maxPrice === INVALIDE) {
    return NextResponse.json({ error: 'Prix maximum invalide.' }, { status: 400 })
  }

  // ── Anti-doublon, première barrière ──────────────────────────────────────
  // Une lecture avant l'écriture donne le bon message tout de suite. Elle ne
  // SUFFIT pas : entre le select et l'insert, un second onglet peut passer.
  // C'est l'index unique qui tranche vraiment, traité plus bas.
  if (cardId) {
    const { data: deja } = await supabase
      .from('want_to_buy_requests')
      .select('id')
      .eq('user_id', user.id)
      .eq('card_type', cardType)
      .eq('card_id', cardId)
      .eq('status', 'active')
      .maybeSingle()

    if (deja) return NextResponse.json({ error: DEJA_EN_LISTE }, { status: 409 })
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
    // ── Anti-doublon, barrière qui fait foi ────────────────────────────────
    // `23505` = violation d'unicité. On y arrive quand la vérification
    // ci-dessus a été contournée ou perdue par une course entre deux onglets.
    // Le client doit lire la MÊME phrase dans les deux cas : un « erreur 500 »
    // ici lui ferait croire à une panne alors que sa liste est simplement déjà
    // à jour.
    if (error.code === '23505') {
      return NextResponse.json({ error: DEJA_EN_LISTE }, { status: 409 })
    }
    console.error('[wtb] insertion:', error.message)
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/**
 * Modification d'une demande : passage en « trouvée », ou changement du prix
 * maximum. Les deux champs sont optionnels et indépendants.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await client()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const id: string | null = body.id ?? null
  if (!id) return NextResponse.json({ error: 'Demande introuvable' }, { status: 400 })

  const patch: { status?: string; max_price?: number | null } = {}

  if (body.status !== undefined) {
    // `cancelled` est refusé volontairement : cet écran supprime pour de bon,
    // il ne range pas les demandes dans un état qu'aucun onglet n'affiche.
    if (body.status !== 'active' && body.status !== 'fulfilled') {
      return NextResponse.json({ error: 'Statut non autorisé.' }, { status: 400 })
    }
    patch.status = body.status
  }

  if (body.max_price !== undefined) {
    const prix = lirePrix((body.max_price ?? '').toString().trim() || null)
    if (prix === INVALIDE) {
      return NextResponse.json({ error: 'Prix maximum invalide.' }, { status: 400 })
    }
    patch.max_price = prix
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Rien à modifier.' }, { status: 400 })
  }

  // `.select()` sur l'update est ce qui distingue « ligne modifiée » de « ligne
  // qui ne vous appartient pas » : RLS filtre silencieusement, l'update rend
  // alors un succès portant sur ZÉRO ligne. Sans cette lecture, l'écran
  // annoncerait une modification qui n'a pas eu lieu.
  const { data, error } = await supabase
    .from('want_to_buy_requests')
    .update(patch)
    .eq('id', id)
    .select('id, status, max_price')

  if (error) {
    // Repasser une demande en « active » peut heurter l'index unique si une
    // autre demande active existe déjà sur la même carte.
    if (error.code === '23505') {
      return NextResponse.json({ error: DEJA_EN_LISTE }, { status: 409 })
    }
    console.error('[wtb] modification:', error.message)
    return NextResponse.json({ error: 'Modification impossible.' }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, demande: data[0] })
}

/** Retrait d'une demande — RLS restreint déjà au propriétaire. */
export async function DELETE(request: NextRequest) {
  const supabase = await client()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Demande introuvable' }, { status: 400 })

  // Même raison que pour PATCH : RLS filtre sans bruit, un delete qui ne touche
  // aucune ligne réussit. `.select()` rend la ligne effacée, donc la preuve.
  const { data, error } = await supabase
    .from('want_to_buy_requests')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) {
    console.error('[wtb] suppression:', error.message)
    return NextResponse.json({ error: 'Suppression impossible.' }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
