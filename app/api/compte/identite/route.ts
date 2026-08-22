import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Soumission du document d'identité.
 *
 * Le fichier transite par le serveur et n'est JAMAIS déposé depuis le navigateur :
 * c'est le service-role qui écrit dans le bucket privé, sous un chemin préfixé
 * par l'identifiant du demandeur. Le statut d'identité est écrit ici aussi —
 * `authenticated` n'a plus le droit de le modifier (migration 0021).
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const form = await request.formData()
  const file = form.get('document')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Document manquant' }, { status: 400 })
  }

  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Format accepté : JPEG, PNG, WebP ou PDF.' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Fichier trop lourd (5 Mo maximum).' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: profile } = await service
    .from('profiles')
    .select('identity_status')
    .eq('id', user.id)
    .single()

  if (profile?.identity_status === 'verified') {
    return NextResponse.json({ error: 'Votre identité est déjà vérifiée.' }, { status: 409 })
  }
  if (profile?.identity_status === 'pending') {
    return NextResponse.json({ error: 'Une vérification est déjà en cours.' }, { status: 409 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await service.storage
    .from('identity-documents')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('[identite] upload:', uploadError.message)
    return NextResponse.json({ error: 'Envoi du document impossible.' }, { status: 500 })
  }

  const { error: updateError } = await service
    .from('profiles')
    .update({
      identity_status: 'pending',
      identity_verified: false,
      identity_document_path: path,
      identity_submitted_at: new Date().toISOString(),
      identity_rejection_reason: null,
    })
    .eq('id', user.id)

  if (updateError) {
    console.error('[identite] mise à jour du profil:', updateError.message)
    await service.storage.from('identity-documents').remove([path])
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, status: 'pending' })
}
