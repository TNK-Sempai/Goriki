import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * Résolution d'une fiche produit à partir de son slug d'URL.
 *
 * Extrait de `app/[slug]/page.tsx` parce que la page n'est plus seule à en
 * avoir besoin : `app/[slug]/layout.tsx` doit connaître l'univers AVANT de
 * choisir le fond dessiné, et `generateMetadata` résout déjà le même slug.
 *
 * `cache()` de React fait la déduplication à l'échelle de la requête : layout,
 * `generateMetadata` et page appellent la même fonction avec le même slug et ne
 * déclenchent qu'UN seul aller-retour Supabase. Le montage du fond ne coûte
 * donc aucune requête supplémentaire — au contraire, la paire
 * `generateMetadata` + page en faisait deux avant cette extraction.
 *
 * `/{id}` est la route la plus fréquentée du site (29 210 variantes Pokémon
 * depuis ARCHI-01, plus les listings One Piece et les scellés) : c'est
 * exactement là qu'une requête dupliquée se paie le plus cher.
 */

export type FicheTcg = 'pokemon' | 'onepiece' | 'sealed'

export interface CardLike {
  id: string
  number: string
  name_fr: string
  rarity: string | null
  card_type?: string | null
  attribute?: string | null
  category?: string | null
  color?: string | null
  set_id: string
  pokemon_sets?: { id: string; code: string; name_fr: string }
  onepiece_sets?: { id: string; code: string; name_fr: string }
}

export interface ListingLike {
  id: string
  price: number
  quantity: number
  condition: string | null
  front_photo_url: string | null
  back_photo_url: string | null
  image_api: string | null
  /** Colonne des produits SCELLÉS — ils n'ont ni `front_photo_url` ni `image_api`. */
  image_url?: string | null
  /**
   * ARCHI-01 : côté Pokémon la fiche est une VARIANTE, et les exemplaires
   * physiques pendent dessous. Vide pour 27 569 variantes sur 29 210.
   */
  pokemon_listings?: unknown[] | null
  /** Galerie des produits scellés (migration 0030). `image_url` en est le premier élément. */
  image_urls?: string[] | null
  name?: string
  pokemon_cards?: CardLike
  onepiece_cards?: CardLike
  pokemon_variant_types?: { id: string; code: string; label: string }
  onepiece_variant_types?: { id: string; code: string; label: string }
}

export const getListing = cache(async function getListing(slug: string) {
  const supabase = await createClient()

  // La fiche produit porte la VARIANTE : elle existe pour les 29 210 lignes et
  // survit aux mouvements de stock. Les exemplaires en vente sont chargés plus
  // bas — 27 569 variantes n'en ont aucun, ce n'est pas une erreur.
  const { data: pkm } = await supabase
    .from('pokemon_card_variants')
    .select(`
      id, image_url,
      pokemon_listings(id, price, quantity, condition, front_photo_url, back_photo_url, needs_photo, is_active),
      pokemon_cards!inner(id, number, name_fr, rarity, card_type, attribute, category, set_id,
        pokemon_sets!inner(id, code, name_fr)),
      pokemon_variant_types!inner(id, code, label)
    `)
    .eq('id', slug)
    .single()

  if (pkm) return { listing: pkm as unknown as ListingLike, tcg: 'pokemon' as const }

  const { data: op } = await supabase
    .from('onepiece_listings')
    .select(`
      id, price, quantity, condition, front_photo_url, back_photo_url, image_api, needs_photo,
      onepiece_cards!inner(id, number, name_fr, rarity, card_type, color, set_id,
        onepiece_sets!inner(id, code, name_fr)),
      onepiece_variant_types!inner(id, code, label)
    `)
    .eq('id', slug)
    .single()

  if (op) return { listing: op as unknown as ListingLike, tcg: 'onepiece' as const }

  const { data: sealed } = await supabase
    .from('sealed_products')
    .select('*')
    .eq('id', slug)
    .single()

  if (sealed) return { listing: sealed as unknown as ListingLike, tcg: 'sealed' as const }

  return null
})
