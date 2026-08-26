import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Types de variantes restreints pour un set.
 *
 * Lecture seule, et chargée seulement à l'ouverture du panneau d'un set : la
 * mettre dans l'agrégat des 185 sets aurait coûté une jointure de plus sur un
 * écran qu'on ouvre en permanence.
 */
export async function GET(request: NextRequest) {
  const setId = request.nextUrl.searchParams.get('setId')
  if (!setId) return NextResponse.json({ error: 'setId requis' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { data, error } = await supabase
    .from('pokemon_set_variant_types')
    .select('variant_type_id')
    .eq('set_id', setId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ typeIds: (data ?? []).map(r => r.variant_type_id) })
}
