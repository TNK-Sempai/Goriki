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
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'admin' ? user : null
}

/** URL signée temporaire vers le document — jamais d'URL publique. */
export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const path = new URL(request.url).searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Chemin manquant' }, { status: 400 })

  const service = createServiceClient()
  const { data, error } = await service.storage
    .from('identity-documents')
    .createSignedUrl(path, 120)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url: data.signedUrl })
}

/** Approbation ou refus. `identity_verified` n'est modifiable que par ici. */
export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { userId, decision, reason } = await request.json()
  if (!userId || !['verified', 'rejected'].includes(decision)) {
    return NextResponse.json({ error: 'Décision invalide' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service
    .from('profiles')
    .update({
      identity_status: decision,
      identity_verified: decision === 'verified',
      identity_reviewed_at: new Date().toISOString(),
      identity_rejection_reason: decision === 'rejected' ? (reason ?? 'Document illisible ou non conforme.') : null,
    })
    .eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
