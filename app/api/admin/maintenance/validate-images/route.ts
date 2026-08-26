import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateCardImages, type Cible, type Tcg } from '@/scripts/validate-card-images'

// La sonde HEAD s'exécute côté Node (fetch + client service-role), jamais sur l'edge.
export const runtime = 'nodejs'
// 18 000 URLs à 10 requêtes simultanées dépassent largement les 60 s par défaut de Vercel.
// Même à 300 s, une passe complète doit passer par le CLI — la route sert les runs ciblés.
export const maxDuration = 300

/** Garde admin : `profiles.role = 'admin'`, vérifiée avant toute exécution. */
async function requireAdmin(): Promise<NextResponse | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  return null
}

/**
 * Teste les `image_url` du catalogue et met à NULL celles qui sont mortes.
 *
 * Body : `{ tcg?, setCode?, cible?, apply? }`
 *   · `tcg`    : 'pokemon' | 'onepiece'
 *   · `cible`  : 'cartes' | 'sets' | 'tout' (défaut) — 'sets' teste le logo
 *                (`image_url`) et le symbole (`symbol_url`) des extensions
 *   · `apply`  : `false` par défaut — sans lui, rien n'est écrit en base.
 *
 * La route ne réimplémente rien : elle appelle `validateCardImages` du script CLI.
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  let body: { tcg?: unknown; setCode?: unknown; cible?: unknown; apply?: unknown } = {}
  try {
    const raw: unknown = await request.json()
    if (raw && typeof raw === 'object') body = raw as typeof body
  } catch {
    // Corps vide ou non JSON : on retombe sur les valeurs par défaut (dry-run global).
  }

  if (body.tcg !== undefined && body.tcg !== 'pokemon' && body.tcg !== 'onepiece') {
    return NextResponse.json({ error: 'tcg doit valoir pokemon ou onepiece' }, { status: 400 })
  }
  if (body.setCode !== undefined && typeof body.setCode !== 'string') {
    return NextResponse.json({ error: 'setCode doit être une chaîne' }, { status: 400 })
  }
  if (
    body.cible !== undefined &&
    body.cible !== 'cartes' &&
    body.cible !== 'sets' &&
    body.cible !== 'tout'
  ) {
    return NextResponse.json({ error: 'cible doit valoir cartes, sets ou tout' }, { status: 400 })
  }
  if (body.apply !== undefined && typeof body.apply !== 'boolean') {
    return NextResponse.json({ error: 'apply doit être un booléen' }, { status: 400 })
  }

  const setCode = typeof body.setCode === 'string' ? body.setCode.trim() : ''

  try {
    const report = await validateCardImages({
      tcg: body.tcg as Tcg | undefined,
      setCode: setCode || undefined,
      cible: body.cible as Cible | undefined,
      apply: body.apply === true,
    })
    return NextResponse.json(report)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
