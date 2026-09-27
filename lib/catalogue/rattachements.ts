import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Sets rattachés : regroupement d'AFFICHAGE (migration 0057).
 *
 * TCGdex découpe certains produits en plusieurs sets (30TH et 30TH-C pour le
 * 30ᵉ Anniversaire). En base, chaque set garde sa ligne, sinon l'import les
 * recréerait. `display_parent_id` déclare seulement qu'un set s'affiche DANS
 * son parent : la boutique ne montre que le parent, qui porte les cartes de
 * tous ses rattachés, en fin de liste.
 *
 * Un seul niveau, garanti par trigger. Déclarer un nouveau cas ne demande
 * aucun code : un `update` de `display_parent_id` suffit.
 */

export type Univers = 'pokemon' | 'onepiece'

const TABLE_SETS: Record<Univers, string> = {
  pokemon: 'pokemon_sets',
  onepiece: 'onepiece_sets',
}

export interface SetRattache {
  id: string
  code: string
  name_fr: string
  card_count: number | null
}

/**
 * Les rattachements d'un univers : pour chaque set rattaché, l'id de son
 * parent. Sert aux listes, qui ramènent le stock d'un rattaché sur son parent.
 */
export async function parentsDesRattaches(
  supabase: SupabaseClient,
  universe: Univers,
): Promise<Map<string, string>> {
  const { data } = await supabase
    .from(TABLE_SETS[universe])
    .select('id, display_parent_id')
    .not('display_parent_id', 'is', null)

  return new Map(
    ((data ?? []) as { id: string; display_parent_id: string }[]).map(r => [r.id, r.display_parent_id]),
  )
}

/** Les sets rattachés à un parent, dans l'ordre de leur code. */
export async function rattachesDe(
  supabase: SupabaseClient,
  universe: Univers,
  parentId: string,
): Promise<SetRattache[]> {
  const { data } = await supabase
    .from(TABLE_SETS[universe])
    .select('id, code, name_fr, card_count')
    .eq('display_parent_id', parentId)
    .order('code')

  return (data ?? []) as SetRattache[]
}
