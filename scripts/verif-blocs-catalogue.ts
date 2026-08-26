// VÉRIFICATION #ADMIN-04 point 3 — lecture seule.
// Confronte `grouperEnBlocs` aux 185 sets réels : ordre des blocs, ordre des
// sets dans chaque bloc, et comptes attendus du brief.
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { grouperEnBlocs, periode, comparerParParution } from '../lib/admin/blocs-catalogue'
import type { SetNettoyage } from '../components/admin/catalogue/types'

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

/** Table du brief #ADMIN-04 : bloc → nombre de sets, dans l'ordre attendu. */
const ATTENDU: [string, number][] = [
  ['Base', 6], ['Autre', 1], ['Neo', 4], ['e-cards', 2], ['EX', 16], ['POP', 7],
  ['Kits du dresseur', 20], ['Diamant & Perle', 8], ['Platine', 3],
  ['HeartGold SoulSilver', 5], ["L'appel des Légendes", 1], ['Noir & Blanc', 13],
  ["Collection McDonald's", 13], ['XY', 17], ['Soleil et Lune', 18],
  ['Épée et Bouclier', 25], ['Écarlate et Violet', 18], ['Méga-Évolution', 8],
]

/**
 * La projection de `admin_pokemon_sets_nettoyage` est refaite ici plutôt
 * qu'appelée : la RPC porte `where public.is_admin()`, et une connexion
 * service-role n'a pas de session — `auth.uid()` y est nul, la fonction rend
 * donc zéro ligne. C'est le comportement voulu de la garde, pas un défaut.
 * Les colonnes qui décident du groupement (`serie_name`, `release_date`) sont
 * de toute façon celles de `pokemon_sets`.
 */
async function chargerSets(): Promise<SetNettoyage[]> {
  const { data, error } = await supabase
    .from('pokemon_sets')
    .select('id, code, name_fr, serie_name, release_date, card_count, locked_fields, image_url, symbol_url, pokemon_cards(count)')
  if (error) throw error

  return (data ?? []).map(s => {
    const r = s as unknown as Record<string, unknown>
    const compte = (r.pokemon_cards as { count: number }[] | null)?.[0]?.count ?? 0
    return {
      set_id: String(r.id),
      code: String(r.code),
      name_fr: String(r.name_fr),
      serie_name: (r.serie_name as string | null) ?? null,
      release_date: (r.release_date as string | null) ?? null,
      card_count: (r.card_count as number | null) ?? null,
      cartes: compte,
      cartes_corrigees: 0, // aucune carte verrouillée en base à ce jour
      variantes: 0,
      variantes_sans_visuel: 0,
      champs_set_corriges: 0,
      types_restreints: 0,
      locked_fields: (r.locked_fields as string[] | null) ?? [],
      image_url: (r.image_url as string | null) ?? null,
      symbol_url: (r.symbol_url as string | null) ?? null,
    }
  })
}

async function main() {
  const sets = (await chargerSets()).sort(comparerParParution)

  const blocs = grouperEnBlocs(sets)
  console.log(`${sets.length} sets → ${blocs.length} blocs\n`)

  let ko = 0
  console.log('bloc                       sets  période        avancement       à compléter')
  for (const b of blocs) {
    const interneOk = b.sets.every((s, i) =>
      i === 0 || comparerParParution(b.sets[i - 1], s) <= 0)
    if (!interneOk) { ko++; console.log(`  !! ${b.nom} : sets NON triés par parution`) }
    console.log(
      `${b.nom.padEnd(26)} ${String(b.sets.length).padStart(4)}  ${periode(b).padEnd(13)} ` +
      `${(b.corrigees + ' / ' + b.cartes).padEnd(16)} ${b.aCompleter || '—'}`
    )
  }

  console.log('\n── confrontation au tableau du brief ──')
  const obtenu = blocs.map(b => [b.nom, b.sets.length] as [string, number])
  for (let i = 0; i < Math.max(ATTENDU.length, obtenu.length); i++) {
    const a = ATTENDU[i]
    const o = obtenu[i]
    if (!a || !o || a[0] !== o[0] || a[1] !== o[1]) {
      ko++
      console.log(`  rang ${i + 1} : attendu ${a ? `${a[0]} (${a[1]})` : '—'} · obtenu ${o ? `${o[0]} (${o[1]})` : '—'}`)
    }
  }
  if (ko === 0) console.log('  ordre et comptes IDENTIQUES sur les 18 blocs')

  // Les blocs qui hachent la liste plate — la raison d'être du groupement.
  console.log('\nchevauchements (blocs dont la période en recouvre d’autres) :')
  for (const b of blocs) {
    const traverses = blocs.filter(x => x !== b && x.premier > b.premier && x.premier < b.dernier)
    if (traverses.length >= 3) {
      console.log(`  ${b.nom} (${periode(b)}) traverse ${traverses.length} blocs : ${traverses.map(t => t.nom).join(', ')}`)
    }
  }

  // `process.exitCode` et non `process.exit()` : sortir de force pendant que le
  // client Supabase a encore des sockets ouvertes fait planter libuv sous Windows
  // (« Assertion failed: !(handle->flags & UV_HANDLE_CLOSING) »), et le code de
  // sortie devient 127 — soit un échec là où la vérification a réussi.
  process.exitCode = ko === 0 ? 0 : 1
}

main()
