// VÉRIFICATION #ADMIN-04 point 1 — lecture seule.
// Rejoue la requête exacte de GET /api/listings, puis passe le payload dans les
// accesseurs de `lib/admin/listings` : ce sont eux que l'écran Listings utilise.
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  carteDuListing,
  varianteDuListing,
  visuelDuListing,
  comparerParCarte,
  type ListingAdmin,
} from '../lib/admin/listings'

for (const ligne of fs.readFileSync(path.resolve(__dirname, '..', '.env.local'), 'utf-8').split('\n')) {
  const l = ligne.trim()
  if (!l || l.startsWith('#') || !l.includes('=')) continue
  const k = l.slice(0, l.indexOf('=')).trim()
  if (!(k in process.env)) process.env[k] = l.slice(l.indexOf('=') + 1).trim()
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const CODE = process.argv[2] ?? 'SV10'

async function main() {
  const { data: set } = await supabase.from('pokemon_sets').select('id, code').eq('code', CODE).single()
  if (!set) throw new Error(`set ${CODE} introuvable`)

  const { data, error } = await supabase
    .from('pokemon_listings')
    .select(`
      id, quantity, price, condition, needs_photo, is_active, copy_index,
      front_photo_url, back_photo_url,
      pokemon_card_variants!inner(
        id, image_url,
        pokemon_cards!inner(id, number, name_fr, set_id, rarity, sort_prefix, sort_num),
        pokemon_variant_types!inner(id, code, label)
      )
    `)
    .eq('pokemon_card_variants.pokemon_cards.set_id', set.id)

  if (error) { console.error('ERREUR', error); process.exit(1) }

  const lignes = [...((data ?? []) as unknown as ListingAdmin[])].sort(comparerParCarte)
  console.log(`set ${set.code} → ${lignes.length} exemplaire(s)\n`)

  const manque = { nom: 0, numero: 0, visuel: 0, variante: 0, rarete: 0 }
  for (const l of lignes) {
    const c = carteDuListing(l)
    const v = varianteDuListing(l)
    if (!c?.name_fr) manque.nom++
    if (!c?.number) manque.numero++
    if (!visuelDuListing(l)) manque.visuel++
    if (!v?.label) manque.variante++
    if (!c?.rarity) manque.rarete++
  }

  console.log('12 premières lignes, telles que l’écran les rendra :')
  for (const l of lignes.slice(0, 12)) {
    const c = carteDuListing(l)!
    const v = varianteDuListing(l)!
    const img = visuelDuListing(l)
    console.log(
      `  #${String(c.number).padEnd(5)} ${String(c.name_fr).slice(0, 26).padEnd(27)} ` +
      `${String(v.label).padEnd(9)} ${String(c.rarity ?? '—').padEnd(16)} ` +
      `${img ? 'visuel ✓' : 'visuel ✗'}`
    )
  }

  console.log('\nlignes SANS la donnée, sur les', lignes.length, ':')
  console.log('  nom', manque.nom, '· numéro', manque.numero, '· visuel', manque.visuel,
              '· variante', manque.variante, '· rareté', manque.rarete)

  const nums = lignes.map(l => carteDuListing(l)?.sort_num ?? -1)
  const croissant = nums.every((n, i) => i === 0 || nums[i - 1] <= n)
  console.log('\nordre par numéro de carte :', croissant ? 'CROISSANT' : 'NON TRIÉ')

  const ko = manque.nom + manque.numero + manque.variante
  process.exitCode = ko === 0 && croissant ? 0 : 1
}

main()
