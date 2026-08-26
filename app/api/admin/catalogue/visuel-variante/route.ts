import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { uploadVariantVisual } from '@/lib/cloudinary'

export const runtime = 'nodejs'

/**
 * Pose un visuel manuel sur une variante.
 *
 * L'écriture passe par `admin_poser_visuel_variante`, qui alimente
 * `image_manuelle` — JAMAIS `image_api`. La colonne `image_url` servie à
 * l'application est générée : `coalesce(image_manuelle, image_api)`. Le visuel
 * posé l'emporte donc immédiatement, et survit à un import complet, puisque
 * l'import n'écrit que dans `image_api`.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const form = await request.formData()
  const file = form.get('file') as File | null
  const varianteId = form.get('variante_id') as string | null
  if (!file || !varianteId) return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })

  const url = await uploadVariantVisual(Buffer.from(await file.arrayBuffer()), { varianteId })

  const { error } = await supabase.rpc('admin_poser_visuel_variante', {
    p_variante_id: varianteId,
    p_url: url,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ url })
}
