import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PAGES_LEGALES, LEGAL_UPDATED_AT } from '@/lib/legal'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://goriki.be'

  // Sets Pokémon. Un set rattaché (migration 0057) n'a pas de page propre :
  // son URL redirige vers celle de son parent.
  // Les tables de sets n'ont pas de `updated_at` : le demander faisait échouer
  // la requête, et le sitemap ne listait AUCUN set. La date retenue est
  // `created_at`, l'entrée du set au catalogue, donc l'apparition de sa page.
  // `release_date` est écartée : nulle sur certains sets, et future pour un set
  // annoncé, ce qu'un `lastmod` ne peut pas être.
  const { data: pkmSets } = await supabase
    .from('pokemon_sets')
    .select('id, created_at')
    .eq('is_active', true)
    .is('display_parent_id', null)

  // Sets One Piece
  const { data: opSets } = await supabase
    .from('onepiece_sets')
    .select('id, created_at')
    .eq('is_active', true)
    .is('display_parent_id', null)

  // Listings (pages produit)
  const { data: pkmListings } = await supabase
    .from('pokemon_card_variants')
    .select('id, updated_at')
    .limit(1000)

  const { data: opListings } = await supabase
    .from('onepiece_listings')
    .select('id, updated_at')
    .eq('is_active', true)
    .gt('quantity', 0)
    .limit(1000)

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/catalogue`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/catalogue/pokemon`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/catalogue/onepiece`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/catalogue/scelles`, changeFrequency: 'weekly', priority: 0.7 },
  ]

  // Les pages légales viennent du MÊME registre que le pied de page : une liste
  // recopiée ici finirait par référencer une page renommée ailleurs.
  const legalPages: MetadataRoute.Sitemap = PAGES_LEGALES.map(p => ({
    url: `${baseUrl}/${p.slug}`,
    changeFrequency: 'yearly' as const,
    priority: 0.3,
    lastModified: new Date(`${LEGAL_UPDATED_AT}T00:00:00Z`),
  }))

  const pkmSetPages: MetadataRoute.Sitemap = (pkmSets ?? []).map(s => ({
    url: `${baseUrl}/catalogue/pokemon/${s.id}`,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
    lastModified: new Date(s.created_at),
  }))

  const opSetPages: MetadataRoute.Sitemap = (opSets ?? []).map(s => ({
    url: `${baseUrl}/catalogue/onepiece/${s.id}`,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
    lastModified: new Date(s.created_at),
  }))

  const productPages: MetadataRoute.Sitemap = [
    ...(pkmListings ?? []),
    ...(opListings ?? []),
  ].map(l => ({
    url: `${baseUrl}/${l.id}`,
    changeFrequency: 'daily' as const,
    priority: 0.6,
    lastModified: l.updated_at ? new Date(l.updated_at) : undefined,
  }))

  return [...staticPages, ...legalPages, ...pkmSetPages, ...opSetPages, ...productPages]
}
