'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Actions de nettoyage du catalogue Pokémon.
 *
 * TOUT PASSE PAR DES RPC, jamais par un `.update()` direct. Le trigger de verrou
 * (migration 0036) refuse toute écriture sur un champ verrouillé, sauf si la
 * transaction lève `goriki.edition_manuelle` — ce qu'une requête PostgREST ne
 * peut pas faire, chacune vivant dans sa propre transaction. Les RPC le lèvent
 * en interne, et le reposent avant de rendre la main (migration 0039).
 *
 * La garde `profiles.role = 'admin'` est posée DEUX FOIS : ici, pour rendre une
 * erreur lisible à l'écran, et dans chaque RPC via `is_admin()`, qui est la
 * garde qui compte — elle tient même si cet appel était contourné.
 */

export interface Resultat {
  ok: boolean
  erreur?: string
}

async function client() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, refuse: 'Session expirée — reconnectez-vous.' as const }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { supabase, refuse: 'Accès refusé.' as const }

  return { supabase, refuse: null }
}

/** Traduit une erreur Postgres en phrase lisible par l'utilisateur. */
function lisible(message: string): string {
  if (message.includes('déjà cette variante')) return 'Cette carte a déjà cette variante.'
  if (message.includes('exemplaire(s) avec du stock')) return message
  if (message.includes('non autorisé sur ce set')) return "Ce type n'est pas autorisé sur ce set."
  // Les messages des RPC de nomenclature (code déjà pris, libellé vide) sont
  // déjà écrits pour être lus : les retraduire ici les dédoublerait.
  return message
}

async function appeler(fn: string, args: Record<string, unknown>): Promise<Resultat> {
  const { supabase, refuse } = await client()
  if (refuse) return { ok: false, erreur: refuse }

  const { error } = await supabase.rpc(fn, args)
  if (error) return { ok: false, erreur: lisible(error.message) }

  // `revalidatePath` sans rechargement complet : la position dans la table est
  // conservée, c'est ce qui rend une session de correction supportable.
  revalidatePath('/admin/catalogue', 'layout')
  return { ok: true }
}

// ─── Sets ──────────────────────────────────────────────────────────────────

export async function corrigerSet(setId: string, champ: string, valeur: string): Promise<Resultat> {
  return appeler('admin_corriger_set', {
    p_set_id: setId, p_champ: champ, p_valeur: valeur, p_verrouiller: true,
  })
}

export async function relacherChampSet(setId: string, champ: string): Promise<Resultat> {
  return appeler('admin_relacher_champ_set', { p_set_id: setId, p_champ: champ })
}

/** Liste vide = aucune restriction, le set revient aux types globaux. */
export async function definirTypesSet(setId: string, typeIds: string[]): Promise<Resultat> {
  return appeler('admin_definir_types_set', { p_set_id: setId, p_type_ids: typeIds })
}

// ─── Nomenclature ──────────────────────────────────────────────────────────

/**
 * Crée un type de variante GLOBAL depuis l'écran, sans migration.
 *
 * Les 28 types de la nomenclature étendue viennent d'un seul bloc de huit sets ;
 * il en apparaîtra d'autres sur les 177 restants. Attendre une migration à
 * chaque libellé découvert arrêterait le nettoyage à chaque fois.
 *
 * Le code est normalisé par la RPC et non ici : il doit l'être de la même façon
 * quel que soit l'appelant.
 */
export async function creerTypeVariante(label: string, code?: string): Promise<Resultat> {
  return appeler('admin_creer_type_variante', {
    p_label: label,
    p_code: code?.trim() ? code.trim() : null,
    p_sort_order: null,
  })
}

// ─── Cartes ────────────────────────────────────────────────────────────────

export async function corrigerCarte(cardId: string, champ: string, valeur: string): Promise<Resultat> {
  return appeler('admin_corriger_carte', {
    p_card_id: cardId, p_champ: champ, p_valeur: valeur, p_verrouiller: true,
  })
}

export async function relacherChampCarte(cardId: string, champ: string): Promise<Resultat> {
  return appeler('admin_relacher_champ_carte', { p_card_id: cardId, p_champ: champ })
}

// ─── Variantes ─────────────────────────────────────────────────────────────

// `ajouterVariante` a été SUPPRIMÉE ici, et non simplement laissée de côté.
// Elle appelait `admin_ajouter_variante`, qui n'insère que
// `(card_id, variant_type_id)` : depuis que `tirage_id` est NOT NULL (0044),
// tout appel échoue sur `23502`. Une action serveur exportée est un point
// d'entrée enregistré par Next.js — en garder une qui ne peut que casser
// invitait à la recâbler. La création passe par `ajouterVarianteAxes`.

/**
 * `cibleId` absent : la suppression est REFUSÉE si des exemplaires portent du
 * stock — l'erreur remonte telle quelle et nomme le nombre de pièces. Avec une
 * cible, les exemplaires y sont déplacés puis la variante est supprimée.
 * Aucune donnée d'inventaire n'est jamais détruite en silence.
 */
export async function supprimerVariante(varianteId: string, cibleId?: string): Promise<Resultat> {
  return appeler('supprimer_variante', {
    p_variante: varianteId, p_cible: cibleId ?? null,
  })
}

/**
 * Crée une variante sur les TROIS AXES.
 *
 * Remplace `ajouterVariante`, qui n'écrivait que `variant_type_id` et échouait
 * depuis que `tirage_id` est obligatoire. Le tirage est requis ; finition et
 * tampon restent facultatifs — une finition NULL veut dire « non déterminée »,
 * ce qui est une information, pas un trou.
 */
export async function ajouterVarianteAxes(
  cardId: string,
  tirageId: string,
  finitionId?: string | null,
  tamponId?: string | null,
): Promise<Resultat> {
  return appeler('admin_ajouter_variante_axes', {
    p_card_id: cardId,
    p_tirage_id: tirageId,
    p_finition_id: finitionId ?? null,
    p_tampon_id: tamponId ?? null,
  })
}

/** Change les axes d'une variante existante ; la passe en `source = manuel`. */
export async function modifierAxesVariante(
  varianteId: string,
  tirageId: string,
  finitionId?: string | null,
  tamponId?: string | null,
): Promise<Resultat> {
  return appeler('admin_modifier_axes_variante', {
    p_variante_id: varianteId,
    p_tirage_id: tirageId,
    p_finition_id: finitionId ?? null,
    p_tampon_id: tamponId ?? null,
  })
}

export async function poserVisuelVariante(varianteId: string, url: string): Promise<Resultat> {
  return appeler('admin_poser_visuel_variante', { p_variante_id: varianteId, p_url: url })
}
