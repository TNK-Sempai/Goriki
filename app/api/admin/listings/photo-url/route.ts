import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifierUrlCloudinary } from '@/lib/admin/photo-url'

export const runtime = 'nodejs'

/**
 * Rattache à un exemplaire un scan DÉJÀ présent sur Cloudinary.
 *
 * Route distincte de `/api/upload/photo`, et pas une branche ajoutée dedans :
 * ici il n'y a aucun upload. Rien n'est envoyé à Cloudinary, on écrit une URL
 * qui existe déjà. Les mélanger aurait donné une route « upload » qui parfois
 * n'uploade pas, et le flux de téléversement — qui marche — n'est pas touché
 * d'une ligne.
 *
 * `needs_photo` n'est PAS écrit ici : le trigger `set_needs_photo` le calcule à
 * chaque écriture (`front_photo_url` non nul ⇒ false, prix ≥ 1 € sans recto ⇒
 * true). Le poser depuis le client reviendrait à répéter une règle qui vit déjà
 * dans la base, et à mentir dans le cas du verso. On relit donc ce que la base
 * a décidé.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const listingId = body?.listing_id as string | undefined
  const side = body?.side as 'front' | 'back' | undefined
  const tcg = body?.tcg as 'pokemon' | 'onepiece' | undefined
  const brut = body?.url as string | undefined

  if (!listingId || !brut || (side !== 'front' && side !== 'back') ||
      (tcg !== 'pokemon' && tcg !== 'onepiece')) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  const verdict = verifierUrlCloudinary(brut)
  if (!verdict.ok || !verdict.url) {
    return NextResponse.json({ error: verdict.raison ?? 'URL invalide' }, { status: 400 })
  }
  const url = verdict.url

  // Le lien répond-il, et sur une image ? C'est le seul moyen d'attraper une
  // URL bien formée mais morte — faute de frappe, média supprimé. Un échec
  // RÉSEAU, lui, ne prouve rien sur le lien : on n'en fait pas un refus, on le
  // signale et on écrit quand même.
  let avertissement: string | undefined
  try {
    const sonde = await fetch(url, { method: 'HEAD', cache: 'no-store' })
    if (!sonde.ok) {
      return NextResponse.json(
        { error: `Ce lien ne répond pas (HTTP ${sonde.status}) — vérifiez qu'il est bien public.` },
        { status: 400 }
      )
    }
    const type = sonde.headers.get('content-type') ?? ''
    if (type && !type.startsWith('image/')) {
      return NextResponse.json(
        { error: `Ce lien ne renvoie pas une image (${type}).` },
        { status: 400 }
      )
    }
  } catch {
    avertissement = "Le lien n'a pas pu être vérifié (Cloudinary injoignable) — il a été enregistré tel quel."
  }

  const table = tcg === 'pokemon' ? 'pokemon_listings' : 'onepiece_listings'
  const champ = side === 'front' ? 'front_photo_url' : 'back_photo_url'

  const { data, error } = await supabase
    .from(table)
    .update({ [champ]: url })
    .eq('id', listingId)
    .select('id, front_photo_url, back_photo_url, needs_photo')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Exemplaire introuvable.' }, { status: 404 })

  return NextResponse.json({
    url,
    needs_photo: data.needs_photo,
    avertissement,
  })
}
