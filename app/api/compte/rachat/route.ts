import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { RACHAT_OUVERT, REFUS_FERME } from '@/lib/fonctionnalites'

const MAX_PHOTOS = 5
const MAX_SIZE = 5 * 1024 * 1024

/**
 * Soumission d'une demande de rachat.
 *
 * Réutilise la table V2 `buyback_requests` (items_json porte le lot déclaré et
 * les chemins de photos). La vérification d'identité est contrôlée ICI, côté
 * serveur : la garde de l'interface ne suffit pas.
 */
export async function POST(request: NextRequest) {
  /**
   * FONCTION FERMÉE AU LANCEMENT.
   *
   * Le refus est posé ICI, avant toute lecture du corps : l'écran ne propose
   * plus de formulaire, mais une requête forgée n'a pas d'écran. C'est cette
   * ligne, et non la page, qui garantit qu'aucune demande n'est enregistrée.
   *
   * 503 et non 403 : la fonction n'est pas interdite à ce client, elle n'est
   * pas encore ouverte. Elle le sera.
   */
  if (!RACHAT_OUVERT) {
    return NextResponse.json({ error: REFUS_FERME }, { status: 503 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const service = createServiceClient()

  const { data: profile } = await service
    .from('profiles')
    .select('identity_verified')
    .eq('id', user.id)
    .single()

  if (!profile?.identity_verified) {
    return NextResponse.json(
      { error: "Votre identité doit être vérifiée avant de soumettre une demande." },
      { status: 403 }
    )
  }

  const form = await request.formData()
  const description = (form.get('description') as string | null)?.trim() ?? ''
  const quantity = parseInt((form.get('quantity') as string) ?? '0', 10)
  const estimateRaw = (form.get('estimate') as string | null)?.trim()
  const estimate = estimateRaw ? Number(estimateRaw.replace(',', '.')) : null

  if (description.length < 20) {
    return NextResponse.json(
      { error: 'Décrivez votre lot en quelques lignes (20 caractères minimum).' },
      { status: 400 }
    )
  }
  if (!Number.isFinite(quantity) || quantity < 1) {
    return NextResponse.json({ error: 'Indiquez le nombre de cartes.' }, { status: 400 })
  }
  if (estimate !== null && (!Number.isFinite(estimate) || estimate < 0)) {
    return NextResponse.json({ error: 'Estimation invalide.' }, { status: 400 })
  }

  const photos = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0)
  if (photos.length > MAX_PHOTOS) {
    return NextResponse.json({ error: `${MAX_PHOTOS} photos maximum.` }, { status: 400 })
  }

  const paths: string[] = []
  for (const photo of photos) {
    if (photo.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Photo trop lourde (5 Mo maximum).' }, { status: 400 })
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type)) {
      return NextResponse.json({ error: 'Photos au format JPEG, PNG ou WebP.' }, { status: 400 })
    }
    const ext = photo.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`
    const { error } = await service.storage
      .from('buyback-photos')
      .upload(path, photo, { contentType: photo.type, upsert: false })
    if (error) {
      console.error('[rachat] upload photo:', error.message)
      if (paths.length) await service.storage.from('buyback-photos').remove(paths)
      return NextResponse.json({ error: 'Envoi des photos impossible.' }, { status: 500 })
    }
    paths.push(path)
  }

  const { error: insertError } = await service.from('buyback_requests').insert({
    user_id: user.id,
    status: 'pending',
    items_json: [{ description, quantity, estimate, photos: paths }],
  })

  if (insertError) {
    console.error('[rachat] insertion:', insertError.message)
    if (paths.length) await service.storage.from('buyback-photos').remove(paths)
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
