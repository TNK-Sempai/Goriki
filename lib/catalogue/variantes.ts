import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Chargement des variantes d'un lot de cartes, avec leur stock.
 *
 * DEUX SCHÉMAS À RÉCONCILIER depuis ARCHI-01 :
 *   · Pokémon — `pokemon_card_variants` (la variante) et `pokemon_listings`
 *     (l'exemplaire physique) sont séparées. Le stock pend sous la variante.
 *   · One Piece — `onepiece_listings` porte encore les deux responsabilités.
 *     Sa base est un miroir de PonéglypheAPI, destinée à être reconstruite :
 *     la migrer maintenant serait travailler sur des données à jeter.
 *
 * Ce module absorbe la différence et rend UNE forme unique aux appelants, pour
 * que `SetDetail` n'ait pas à connaître deux schémas.
 */

export interface LigneVariante {
  /** Identité de la VARIANTE — c'est elle qui sert d'URL de fiche produit. */
  id: string
  cardId: string
  code: string
  label: string
  sortOrder: number
  /** Visuel servi : manuel s'il existe, sinon celui de l'API. */
  imageUrl: string | null
  /** Exemplaires physiques rattachés. Vide pour 27 569 des 29 210 variantes. */
  exemplaires: Exemplaire[]
}

export interface Exemplaire {
  id: string
  price: number
  quantity: number
  condition: string | null
  isActive: boolean
  frontPhotoUrl: string | null
}

interface TypeVariante { code: string; label: string; sort_order: number | null }

const premier = <T,>(v: T | T[] | null | undefined): T | undefined =>
  Array.isArray(v) ? v[0] : (v ?? undefined)

export async function chargerVariantes(
  supabase: SupabaseClient,
  universe: 'pokemon' | 'onepiece',
  cardIds: string[],
): Promise<LigneVariante[]> {
  if (cardIds.length === 0) return []

  if (universe === 'pokemon') {
    const { data } = await supabase
      .from('pokemon_card_variants')
      .select(
        `id, card_id, image_url,
         pokemon_variant_types!inner(code, label, sort_order),
         pokemon_listings(id, price, quantity, condition, is_active, front_photo_url)`,
      )
      .in('card_id', cardIds)

    return ((data ?? []) as unknown as Record<string, unknown>[]).map(r => {
      const t = premier<TypeVariante>(r.pokemon_variant_types as never)
      const ex = (r.pokemon_listings ?? []) as Record<string, unknown>[]
      return {
        id: r.id as string,
        cardId: r.card_id as string,
        code: t?.code ?? '',
        label: t?.label ?? '',
        sortOrder: t?.sort_order ?? 0,
        imageUrl: (r.image_url as string | null) ?? null,
        exemplaires: ex.map(e => ({
          id: e.id as string,
          price: Number(e.price ?? 0),
          quantity: Number(e.quantity ?? 0),
          condition: (e.condition as string | null) ?? null,
          isActive: e.is_active === true,
          frontPhotoUrl: (e.front_photo_url as string | null) ?? null,
        })),
      }
    })
  }

  // One Piece : une ligne porte à la fois la variante et son unique exemplaire.
  const { data } = await supabase
    .from('onepiece_listings')
    .select(
      `id, card_id, price, quantity, condition, is_active, front_photo_url, image_api,
       onepiece_variant_types!inner(code, label, sort_order)`,
    )
    .in('card_id', cardIds)

  return ((data ?? []) as unknown as Record<string, unknown>[]).map(r => {
    const t = premier<TypeVariante>(r.onepiece_variant_types as never)
    return {
      id: r.id as string,
      cardId: r.card_id as string,
      code: t?.code ?? '',
      label: t?.label ?? '',
      sortOrder: t?.sort_order ?? 0,
      imageUrl: (r.image_api as string | null) ?? null,
      exemplaires: [
        {
          id: r.id as string,
          price: Number(r.price ?? 0),
          quantity: Number(r.quantity ?? 0),
          condition: (r.condition as string | null) ?? null,
          isActive: r.is_active === true,
          frontPhotoUrl: (r.front_photo_url as string | null) ?? null,
        },
      ],
    }
  })
}

/** Vendable = actif, en stock ET chiffré. Un prix à 0 est une absence de prix. */
export const estVendable = (e: Exemplaire) => e.isActive && e.quantity > 0 && e.price > 0
