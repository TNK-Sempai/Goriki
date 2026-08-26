import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifierUrlVisuel } from '@/lib/admin/visuel-url'

export const runtime = 'nodejs'

/**
 * Pose sur une variante un visuel DÉJÀ en ligne, à partir de son URL.
 *
 * Route SÉPARÉE de `../route.ts`, et pas une branche ajoutée dedans : ici rien
 * n'est envoyé à Cloudinary. Les fondre aurait donné une route « visuel-variante »
 * qui parfois téléverse et parfois non — même raisonnement que pour les scans
 * d'exemplaires, où la route d'URL avait été séparée de la route d'upload. Le
 * flux de téléversement, qui fonctionne, n'est pas touché d'une ligne.
 *
 * L'écriture passe par la MÊME RPC que l'upload, `admin_poser_visuel_variante`,
 * qui alimente `image_manuelle` — jamais `image_api`. Deux conséquences voulues :
 *
 *  · `image_url` étant générée (`coalesce(image_manuelle, image_api)`), le
 *    visuel collé l'emporte immédiatement ;
 *  · il SURVIT à l'import, qui n'écrit que dans `image_api`. C'est tout
 *    l'intérêt quand on corrige une illustration TCGdex fausse : écrire dans
 *    `image_api` aurait fait effacer la correction au prochain import.
 *
 * La RPC pose aussi le drapeau `goriki.edition_manuelle` le temps de l'écriture.
 * VÉRIFIÉ EN BASE : ce drapeau n'ajoute PAS `image_manuelle` à `locked_fields` —
 * les dix variantes qui portent déjà un visuel manuel ont toutes `locked_fields`
 * vide, celles posées par téléversement comprises. Ce n'est pas une régression :
 * la protection contre l'import ne vient pas du verrou, elle vient de la colonne
 * elle-même, que l'import n'écrit jamais. Le noter ici évite de croire à une
 * seconde garantie qui n'existe pas.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const varianteId = body?.variante_id as string | undefined
  const brut = body?.url as string | undefined
  if (!varianteId || !brut) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  const verdict = verifierUrlVisuel(brut)
  if (!verdict.ok || !verdict.url) {
    return NextResponse.json({ error: verdict.raison ?? 'URL invalide' }, { status: 400 })
  }
  const url = verdict.url

  // Le lien répond-il, et sur une image ? C'est le SEUL moyen d'attraper une
  // URL bien formée mais morte — et c'est précisément le cas d'usage : on est
  // ici parce qu'une illustration TCGdex ne répond plus. Refuser à l'aveugle
  // laisserait remplacer une image morte par une autre.
  //
  // Un échec RÉSEAU ne prouve rien sur le lien, lui : on ne le transforme pas
  // en refus, on le signale et on écrit quand même. Sans quoi une coupure de
  // notre côté empêcherait toute correction.
  let avertissement: string | undefined
  try {
    const sonde = await fetch(url, { method: 'HEAD', cache: 'no-store' })
    if (!sonde.ok) {
      return NextResponse.json(
        { error: `Ce lien ne répond pas (HTTP ${sonde.status}) — le visuel n'a pas été changé.` },
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
    avertissement = "Le lien n'a pas pu être vérifié (hôte injoignable) — il a été enregistré tel quel."
  }

  const { error } = await supabase.rpc('admin_poser_visuel_variante', {
    p_variante_id: varianteId,
    p_url: url,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // On relit la colonne GÉNÉRÉE plutôt que de renvoyer l'URL écrite : c'est
  // elle que l'application affiche, et la relire prouve que l'écriture a bien
  // pris — un `update` sur un id inexistant ne lève aucune erreur.
  const { data } = await supabase
    .from('pokemon_card_variants')
    .select('id, image_url, image_manuelle')
    .eq('id', varianteId)
    .maybeSingle()

  if (!data) return NextResponse.json({ error: 'Variante introuvable.' }, { status: 404 })

  return NextResponse.json({
    url: data.image_url,
    source: verdict.source,
    avertissement,
  })
}
