import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://goriki.be'

  // Sets Pokémon
  const { data: pkmSets } = await supabase
    .from('pokemon_sets')
    .select('id, updated_at')
    .eq('is_active', true)

  // Sets One Piece
  const { data: opSets } = await supabase
    .from('onepiece_sets')
    .select('id, updated_at')
    .eq('is_active', true)

  // Listings (pages produit)
  const { data: pkmListings } = await supabase
    .from('pokemon_listings')
    .select('id, updated_at')
    .eq('is_active', true)
    .gt('quantity', 0)
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

  const pkmSetPages: MetadataRoute.Sitemap = (pkmSets ?? []).map(s => ({
    url: `${baseUrl}/catalogue/pokemon/${s.id}`,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
    lastModified: s.updated_at ? new Date(s.updated_at) : undefined,
  }))

  const opSetPages: MetadataRoute.Sitemap = (opSets ?? []).map(s => ({
    url: `${baseUrl}/catalogue/onepiece/${s.id}`,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
    lastModified: s.updated_at ? new Date(s.updated_at) : undefined,
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

  return [...staticPages, ...pkmSetPages, ...opSetPages, ...productPages]
}
