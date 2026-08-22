import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { BULK_CATEGORIES, BULK_CONTACT_THRESHOLD } from '@/lib/constants'

/**
 * Soumission de rachat — deux natures de lot, une seule table.
 *
 * Décision d'architecture 58 : pas de nouvelle table. `buyback_requests` porte
 * déjà tout ce qu'il faut, et `items_json` reçoit une charge DISCRIMINÉE :
 *
 *   { kind: 'singles', items: [{ universe, set_code, card_id, card_name,
 *                                card_number, variant_code, variant_label,
 *                                quantity }] }
 *   { kind: 'bulk',    universe, buckets: [{ code, label, quantity }], note }
 *
 * `offer_amount` n'est JAMAIS renseigné ici : il reste NULL jusqu'à ce que
 * Goriki inspecte physiquement le lot. C'est la traduction en base de la règle
 * « aucun prix avant inspection » — le serveur ne sait même pas calculer un
 * montant, il n'y a plus aucun barème dans le code.
 */

const MAX_ITEMS = 300

interface SingleItem {
  universe: string
  set_code: string
  card_id: string
  card_name: string
  card_number: string
  variant_code: string | null
  variant_label: string | null
  quantity: number
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const service = createServiceClient()

  // La vérification d'identité est contrôlée ICI : la garde d'interface ne
  // suffit pas (même règle que `/api/compte/rachat`).
  const { data: profile } = await service
    .from('profiles')
    .select('identity_verified')
    .eq('id', user.id)
    .single()

  if (!profile?.identity_verified) {
    return NextResponse.json(
      { error: "Votre identité doit être vérifiée avant de soumettre un lot.", code: 'IDENTITY' },
      { status: 403 }
    )
  }

  const body = await request.json().catch(() => null)
  if (!body || (body.kind !== 'singles' && body.kind !== 'bulk')) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  let payload: Record<string, unknown>

  if (body.kind === 'singles') {
    const items = Array.isArray(body.items) ? (body.items as SingleItem[]) : []
    if (items.length === 0) {
      return NextResponse.json({ error: 'Votre lot est vide.' }, { status: 400 })
    }
    if (items.length > MAX_ITEMS) {
      return NextResponse.json(
        { error: `${MAX_ITEMS} lignes maximum — au-delà, passez par le rachat bulk.` },
        { status: 400 }
      )
    }
    for (const it of items) {
      if (!it.card_id || !it.universe || !Number.isFinite(it.quantity) || it.quantity < 1) {
        return NextResponse.json({ error: 'Ligne de lot invalide.' }, { status: 400 })
      }
    }
    payload = {
      kind: 'singles',
      items: items.map(it => ({
        universe: it.universe,
        set_code: it.set_code,
        card_id: it.card_id,
        card_name: it.card_name,
        card_number: it.card_number,
        variant_code: it.variant_code ?? null,
        variant_label: it.variant_label ?? null,
        quantity: Math.floor(it.quantity),
      })),
    }
  } else {
    const codes = new Set(BULK_CATEGORIES.map(c => c.code))
    const buckets = (Array.isArray(body.buckets) ? body.buckets : [])
      .filter((b: { code?: string; quantity?: number }) =>
        b.code && codes.has(b.code as never) && Number.isFinite(b.quantity) && (b.quantity ?? 0) > 0
      )
      .map((b: { code: string; quantity: number }) => ({
        code: b.code,
        label: BULK_CATEGORIES.find(c => c.code === b.code)?.label ?? b.code,
        quantity: Math.floor(b.quantity),
      }))

    if (buckets.length === 0) {
      return NextResponse.json({ error: 'Déclarez au moins une catégorie.' }, { status: 400 })
    }

    const total = buckets.reduce((n: number, b: { quantity: number }) => n + b.quantity, 0)
    if (total > BULK_CONTACT_THRESHOLD) {
      return NextResponse.json(
        {
          error: `Au-delà de ${BULK_CONTACT_THRESHOLD} cartes, le lot se traite par contact direct.`,
          code: 'BULK_TOO_LARGE',
        },
        { status: 400 }
      )
    }

    payload = {
      kind: 'bulk',
      universe: typeof body.universe === 'string' ? body.universe : null,
      buckets,
      total,
      note: typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : null,
    }
  }

  // `offer_amount` volontairement absent : NULL jusqu'à l'inspection.
  const { error } = await service.from('buyback_requests').insert({
    user_id: user.id,
    status: 'pending',
    items_json: payload,
  })

  if (error) {
    console.error('[rachat] insertion:', error.message)
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
