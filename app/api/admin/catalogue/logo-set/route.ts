import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifierUrlVisuel } from '@/lib/admin/visuel-url'

export const runtime = 'nodejs'

/**
 * Corrige le LOGO ou le SYMBOLE d'un set à partir d'une URL collée.
 *
 * ─── POURQUOI IL N'Y A PAS DE COLONNE `logo_manuel` ───────────────────────
 *
 * Le réflexe serait de reproduire le schéma des variantes : `image_api` +
 * `image_manuelle` + une `image_url` générée. Vérification faite AVANT d'écrire
 * la moindre migration, ce serait à la fois redondant et destructeur.
 *
 * REDONDANT — le mécanisme existe déjà, et il est différent. `admin_corriger_set`
 * écrit le champ ET l'inscrit dans `locked_fields` ; le trigger
 * `verrous_pokemon_sets` (BEFORE UPDATE, actif) restaure la valeur de tout champ
 * verrouillé à chaque écriture non manuelle — donc à chaque import. Les sets
 * sont protégés par VERROUILLAGE PAR CHAMP, là où les variantes le sont par
 * colonne séparée. Deux mécanismes concurrents pour la même garantie auraient
 * fini par diverger.
 *
 * DESTRUCTEUR — `verrous_pokemon_sets` fait `new.image_url := old.image_url`.
 * Rendre `image_url` générée rendrait cette affectation ILLÉGALE : Postgres
 * refuse d'assigner une colonne générée dans un trigger. La migration aurait
 * cassé le verrouillage de tous les autres champs du set au passage.
 *
 * Mesuré, pas supposé : un `upsert` identique à celui de `lib/import/pokemon.ts`
 * a été rejoué sur EX5 dans une transaction annulée. Le logo verrouillé a tenu,
 * le symbole non verrouillé a été écrasé par l'import — dans la même
 * instruction. Le verrou fait donc exactement le travail demandé.
 *
 * ─── CE QUE CETTE ROUTE AJOUTE ────────────────────────────────────────────
 *
 * L'action serveur `corrigerSet` appelle déjà la RPC, mais sans aucun contrôle :
 * elle accepterait « coucou » comme logo. Cette route ajoute la validation de
 * domaine et la SONDE du lien — c'est tout l'objet de la demande, puisqu'on est
 * ici précisément parce qu'un logo d'API ne répond plus.
 */

const CHAMPS = { logo: 'image_url', symbole: 'symbol_url' } as const
type Nature = keyof typeof CHAMPS

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const setId = body?.set_id as string | undefined
  const nature = body?.nature as Nature | undefined
  const brut = body?.url as string | undefined

  if (!setId || !brut || !nature || !(nature in CHAMPS)) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  // `.png` et non `/high.webp` : c'est le suffixe des logos et des symboles,
  // celui qu'applique l'import. Se tromper de suffixe produirait une adresse
  // morte à partir d'un lien pourtant correct.
  const verdict = verifierUrlVisuel(brut, '.png')
  if (!verdict.ok || !verdict.url) {
    return NextResponse.json({ error: verdict.raison ?? 'URL invalide' }, { status: 400 })
  }
  const url = verdict.url

  // La sonde est la raison d'être de cette route : sans elle on remplacerait
  // une image morte par une autre. Un échec RÉSEAU ne prouve rien sur le lien,
  // lui — on le signale et on écrit quand même, sans quoi une coupure de notre
  // côté empêcherait toute correction.
  let avertissement: string | undefined
  try {
    const sonde = await fetch(url, { method: 'HEAD', cache: 'no-store' })
    if (!sonde.ok) {
      return NextResponse.json(
        { error: `Ce lien ne répond pas (HTTP ${sonde.status}) — le visuel n'a pas été changé.` },
        { status: 400 },
      )
    }
    const type = sonde.headers.get('content-type') ?? ''
    if (type && !type.startsWith('image/')) {
      return NextResponse.json({ error: `Ce lien ne renvoie pas une image (${type}).` }, { status: 400 })
    }
  } catch {
    avertissement = "Le lien n'a pas pu être vérifié (hôte injoignable) — il a été enregistré tel quel."
  }

  // `p_verrouiller: true` n'est pas un détail de confort : c'est CE qui fait
  // survivre la correction au prochain import.
  const { error } = await supabase.rpc('admin_corriger_set', {
    p_set_id: setId,
    p_champ: CHAMPS[nature],
    p_valeur: url,
    p_verrouiller: true,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // On relit : un `update` sur un id inexistant ne lève pas d'erreur, et c'est
  // la valeur relue qui prouve que l'écriture a pris.
  const { data } = await supabase
    .from('pokemon_sets')
    .select('id, image_url, symbol_url, locked_fields')
    .eq('id', setId)
    .maybeSingle()

  if (!data) return NextResponse.json({ error: 'Set introuvable.' }, { status: 404 })

  return NextResponse.json({
    url: nature === 'logo' ? data.image_url : data.symbol_url,
    verrous: data.locked_fields,
    source: verdict.source,
    avertissement,
  })
}
