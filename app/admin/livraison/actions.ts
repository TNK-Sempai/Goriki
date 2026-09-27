'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Réglages de livraison — écritures admin.
 *
 * Contrairement au nettoyage du catalogue, il n'y a PAS de RPC ici : aucune de
 * ces tables ne porte de trigger de verrou, et les contraintes qui comptent
 * (cohérence lettre / point relais, bornes positives) sont posées en CHECK dans
 * la migration 0055. Un `.update()` direct est donc suffisant, et la base reste
 * le dernier mot — pas ce fichier.
 *
 * La garde est posée deux fois : ici pour rendre une phrase lisible à l'écran,
 * et dans la policy RLS `is_admin()`, qui est celle qui tient si cet appel
 * était contourné.
 */

export interface Resultat {
  ok: boolean
  erreur?: string
}

async function client() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, refuse: 'Session expirée : reconnectez-vous.' as const }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { supabase, refuse: 'Accès refusé.' as const }

  return { supabase, refuse: null }
}

/** Traduit les CHECK de la migration en phrases qu'on peut lire à l'écran. */
function lisible(message: string): string {
  if (message.includes('shipping_rates_lettre_coherente')) {
    return 'Incohérent : une lettre simple n’a pas de code Sendcloud, n’est pas suivie et n’a pas de point relais. Les autres modes exigent un code Sendcloud.'
  }
  if (message.includes('shipping_rates_point_relais_coherent')) {
    return 'Incohérent : « point relais » est le type de l’envoi, il ne se coche pas séparément.'
  }
  if (message.includes('shipping_rates_code_key')) return 'Ce code est déjà pris.'
  if (message.includes('violates check constraint')) return 'Valeur hors limites : les poids et les prix doivent être positifs.'
  return message
}

/** Nombre saisi à la main : virgule acceptée, valeur négative refusée. */
function nombre(brut: unknown, { entier = false } = {}): number | null {
  const n = Number(String(brut ?? '').trim().replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return null
  return entier ? Math.round(n) : n
}

// ─── Réglages généraux ───────────────────────────────────────────────────────

export async function enregistrerReglages(saisie: {
  min_order_value: string
  handling_fee: string
  letter_max_value: string
  letter_max_weight_g: string
  card_weight_g: string
  envelope_weight_g: string
}): Promise<Resultat> {
  const { supabase, refuse } = await client()
  if (refuse) return { ok: false, erreur: refuse }

  const minimum = nombre(saisie.min_order_value)
  const forfait = nombre(saisie.handling_fee)
  const valeurLettre = nombre(saisie.letter_max_value)
  const poidsLettre = nombre(saisie.letter_max_weight_g, { entier: true })
  const poidsCarte = nombre(saisie.card_weight_g, { entier: true })
  const poidsEnveloppe = nombre(saisie.envelope_weight_g, { entier: true })

  if (minimum === null || forfait === null || valeurLettre === null || poidsLettre === null
      || poidsCarte === null || poidsEnveloppe === null) {
    return { ok: false, erreur: 'Toutes les valeurs doivent être des nombres positifs.' }
  }
  // Un poids de carte à 0 ferait passer n'importe quel panier en lettre simple.
  if (poidsCarte < 1 || poidsLettre < 1) {
    return { ok: false, erreur: 'Le poids d’une carte et le plafond de la lettre doivent être supérieurs à 0.' }
  }

  const { error } = await supabase
    .from('shipping_settings')
    .update({
      min_order_value: minimum,
      handling_fee: forfait,
      letter_max_value: valeurLettre,
      letter_max_weight_g: poidsLettre,
      card_weight_g: poidsCarte,
      envelope_weight_g: poidsEnveloppe,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)

  if (error) return { ok: false, erreur: lisible(error.message) }
  return { ok: true }
}

// ─── Grille tarifaire ────────────────────────────────────────────────────────

/**
 * Modifie une ligne de la grille. Seuls le prix, le poids maximum et l'activité
 * sont éditables — ce sont les trois qui bougent au gré des grilles
 * transporteur. Le code Sendcloud, le pays et la nature définissent l'offre :
 * les changer à l'écran reviendrait à créer un autre tarif sous le même code,
 * et les commandes passées pointeraient sur autre chose que ce qu'elles ont
 * facturé.
 */
export async function modifierTarif(
  id: string,
  saisie: { price?: string; max_weight_g?: string; is_active?: boolean },
): Promise<Resultat> {
  const { supabase, refuse } = await client()
  if (refuse) return { ok: false, erreur: refuse }

  const patch: Record<string, unknown> = {}

  if (saisie.price !== undefined) {
    const p = nombre(saisie.price)
    if (p === null) return { ok: false, erreur: 'Prix invalide.' }
    patch.price = p
  }
  if (saisie.max_weight_g !== undefined) {
    const g = nombre(saisie.max_weight_g, { entier: true })
    if (g === null || g < 1) return { ok: false, erreur: 'Le poids maximum doit être supérieur à 0.' }
    patch.max_weight_g = g
  }
  if (saisie.is_active !== undefined) patch.is_active = saisie.is_active

  if (Object.keys(patch).length === 0) return { ok: false, erreur: 'Rien à modifier.' }

  // `.select()` : RLS filtre sans bruit, un update qui ne touche aucune ligne
  // réussit. Sans relire, l'écran annoncerait une modification qui n'a pas eu lieu.
  const { data, error } = await supabase
    .from('shipping_rates')
    .update(patch)
    .eq('id', id)
    .select('id')

  if (error) return { ok: false, erreur: lisible(error.message) }
  if (!data || data.length === 0) return { ok: false, erreur: 'Tarif introuvable.' }

  return { ok: true }
}
