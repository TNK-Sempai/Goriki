import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

async function requireAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return p?.role === 'admin'
}

/** URL signée vers une photo de rachat — le bucket est privé. */
export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const path = new URL(request.url).searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Chemin manquant' }, { status: 400 })

  const { data, error } = await createServiceClient().storage
    .from('buyback-photos').createSignedUrl(path, 120)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url: data.signedUrl })
}

/** Proposer un prix, accepter, refuser ou marquer réglée. */
export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { id, status, offer, paymentType } = await request.json()
  const ALLOWED = ['pending', 'accepted', 'rejected', 'completed']
  if (!id || (status && !ALLOWED.includes(status))) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if (status) patch.status = status
  if (offer !== undefined && offer !== null && offer !== '') {
    const n = Number(String(offer).replace(',', '.'))
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
    }
    patch.offer_amount = n
  }
  if (paymentType) patch.payment_type = paymentType

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 })
  }

  const { error } = await createServiceClient().from('buyback_requests').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
