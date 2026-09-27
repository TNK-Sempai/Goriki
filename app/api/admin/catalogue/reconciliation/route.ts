import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const ACTIONS = ['rattacher_supprimer', 'supprimer', 'conserver'] as const
type Action = (typeof ACTIONS)[number]

/**
 * Réconciliation catalogue ↔ checklists — aperçu et exécution.
 *
 * DEUX MODES, ET LE PREMIER N'ÉCRIT RIEN. `mode: 'apercu'` renvoie, ligne par
 * ligne, ce qui SE PASSERAIT : quelle carte, quelle variante, combien
 * d'exemplaires déplacés, et pourquoi telle ligne est impossible. C'est ce
 * qu'exige le brief avant toute action destructive — un compte global ne dit
 * pas sur quoi on s'apprête à agir.
 *
 * Les garde-fous ne sont PAS ici mais dans `admin_reconcilier` : refus de
 * supprimer une variante portant un exemplaire, refus de rattacher sans jumelle
 * unique. Les dupliquer côté route aurait créé une seconde règle, qui aurait
 * dérivé. La route se contente de valider la forme de la requête.
 *
 * AUCUN PRIX N'EST LU, ÉCRIT NI CALCULÉ ICI — ni ailleurs dans cet écran.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const mode = (body?.mode as string) ?? 'executer'
  const action = body?.action as Action | undefined
  const ids = body?.variante_ids as string[] | undefined
  const motif = body?.motif as string | undefined

  if (!action || !ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 })
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Aucune variante sélectionnée.' }, { status: 400 })
  }
  // Le motif est refusé tôt : laisser partir un lot de 400 pour qu'il échoue
  // ligne à ligne sur la même cause serait un rapport illisible.
  if (action === 'conserver' && !motif?.trim()) {
    return NextResponse.json({ error: 'Le motif est obligatoire pour conserver une variante.' }, { status: 400 })
  }

  if (mode === 'apercu') {
    const { data, error } = await supabase.rpc('admin_apercu_reconciliation', {
      p_action: action,
      p_variante_ids: ids,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ apercu: data ?? [] })
  }

  const { data, error } = await supabase.rpc('admin_reconcilier', {
    p_action: action,
    p_variante_ids: ids,
    p_motif: motif ?? null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
