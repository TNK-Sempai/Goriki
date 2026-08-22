// Script CLI d'import des QUANTITÉS depuis l'inventaire Excel de l'utilisateur.
//
//   npx tsx scripts/import-stock-xlsx.ts "<fichier.xlsx>" [autre.xlsx ...] [--commit]
//
// Un fichier = un bloc Pokémon, une feuille = un set, une ligne = une carte.
// Le script est générique : les futurs fichiers (Mega-Évolution, Épée et Bouclier,
// Soleil et Lune…) se traitent avec la même commande, sans modification.
//
// PÉRIMÈTRE STRICT — trois règles non négociables :
//   1. Seule la colonne `quantity` est écrite. `price` n'est JAMAIS touché
//      (chantier séparé).
//   2. Aucun listing n'est jamais créé. Une carte du fichier absente de la base
//      est SIGNALÉE, pas créée.
//   3. Dry-run par défaut. `--commit` est requis pour écrire quoi que ce soit.
//
// Sémantique des cellules (confirmée par l'utilisateur) :
//   · nombre       → quantité réellement possédée
//   · « x »        → cette variante N'EXISTE PAS pour cette carte : on ignore
//   · cellule vide → la variante existe, l'utilisateur en a 0 → quantity = 0
//                    (écrit explicitement, pour qu'un second passage corrige
//                    une valeur devenue fausse)
import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from 'exceljs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// Environnement
// ─────────────────────────────────────────────────────────────────────────────

/** Charge `.env.local` — les valeurs ne sont JAMAIS affichées. */
function loadEnvLocal(): void {
  const envPath = path.resolve(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) return

  for (const rawLine of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    if (quoted) value = value.slice(1, -1)
    if (!(key in process.env)) process.env[key] = value
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalisation
// ─────────────────────────────────────────────────────────────────────────────

/** Minuscule sans accent ni ponctuation — pour comparer des libellés humains. */
function normaliser(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Numéro de carte comparable : le fichier écrit « 1 » ou « 001 » selon les
 * feuilles, la base stocke « 001 ». On compare sans les zéros de tête.
 */
function normaliserNumero(n: string): string {
  const brut = n.trim().replace(/^0+(?=\d)/, '')
  return brut.toLowerCase()
}

/** Colonne de variante → code de `pokemon_variant_types`. */
const COLONNE_VERS_VARIANTE: Record<string, string> = {
  originale: 'NORMAL',
  carte: 'NORMAL',
  normale: 'NORMAL',
  reverse: 'REVERSE',
  pokeball: 'POKEBALL',
  masterball: 'MASTERBALL',
  holo: 'HOLO',
}

/**
 * Similarité grossière de libellés, pour PROPOSER un set — jamais pour en
 * choisir un. Le pluriel est neutralisé : le fichier écrit « Force temporelle »
 * et « Fables Nébuleuses » là où la base dit « Forces Temporelles » et
 * « Fable Nébuleuse ». Sans cette tolérance, les deux feuilles concernées ne
 * recevaient AUCUNE suggestion — le rapport devenait inexploitable là où
 * l'utilisateur en avait le plus besoin.
 */
function racine(mot: string): string {
  return mot.replace(/s$/, '')
}

function similarite(a: string, b: string): number {
  const ta = new Set(normaliser(a).split(' ').filter(w => w.length > 2).map(racine))
  const tb = new Set(normaliser(b).split(' ').filter(w => w.length > 2).map(racine))
  if (ta.size === 0 || tb.size === 0) return 0
  let communs = 0
  for (const w of ta) if (tb.has(w)) communs++
  return communs / Math.max(ta.size, tb.size)
}

// ─────────────────────────────────────────────────────────────────────────────
// Types de rapport
// ─────────────────────────────────────────────────────────────────────────────

interface MiseAJour {
  listingId: string
  avant: number
  apres: number
}

interface RapportFeuille {
  fichier: string
  feuille: string
  codeSet: string
  libelleFeuille: string
  /** Set résolu en base, `null` si introuvable */
  setTrouve: { id: string; code: string; name_fr: string } | null
  suggestions: string[]
  lignesLues: number
  cellulesInexistantes: number   // « x »
  majPrevues: MiseAJour[]
  inchangees: number
  lignesNonParsables: { ligne: number; contenu: string }[]
  cartesIntrouvables: { numero: string; contenu: string }[]
  listingsIntrouvables: { numero: string; variante: string }[]
  colonnesInconnues: string[]
  variantesSansType: string[]
  conflits: { numero: string; variante: string; lignes: number[] }[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Traitement d'une feuille
// ─────────────────────────────────────────────────────────────────────────────

interface ContexteBase {
  sets: { id: string; code: string; name_fr: string }[]
  variantes: Map<string, string>  // code → id
}

async function traiterFeuille(
  supabase: SupabaseClient,
  ctx: ContexteBase,
  fichier: string,
  feuille: ExcelJS.Worksheet,
): Promise<RapportFeuille> {
  const nomFeuille = feuille.name
  const tiret = nomFeuille.indexOf('-')
  const codeSet = (tiret === -1 ? nomFeuille : nomFeuille.slice(0, tiret)).trim()
  const libelleFeuille = tiret === -1 ? '' : nomFeuille.slice(tiret + 1).trim()

  const rapport: RapportFeuille = {
    fichier, feuille: nomFeuille, codeSet, libelleFeuille,
    setTrouve: null, suggestions: [],
    lignesLues: 0, cellulesInexistantes: 0, majPrevues: [], inchangees: 0,
    lignesNonParsables: [], cartesIntrouvables: [], listingsIntrouvables: [],
    colonnesInconnues: [], variantesSansType: [], conflits: [],
  }

  // ── 1. Résolution du set, par code EXACT ──────────────────────────────────
  const set = ctx.sets.find(s => s.code.toLowerCase() === codeSet.toLowerCase())
  if (!set) {
    // On ne devine JAMAIS. On propose, sur le libellé de la feuille, pour que
    // l'utilisateur corrige son fichier en connaissance de cause.
    rapport.suggestions = ctx.sets
      .map(s => ({ s, score: similarite(libelleFeuille, s.name_fr) }))
      .filter(x => x.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(x => `${x.s.code} — ${x.s.name_fr}`)
    return rapport
  }
  rapport.setTrouve = set

  // ── 2. Chargement de la base pour ce set ──────────────────────────────────
  const { data: cartes } = await supabase
    .from('pokemon_cards')
    .select('id, number')
    .eq('set_id', set.id)

  const parNumero = new Map<string, string>()  // numéro normalisé → card_id
  for (const c of cartes ?? []) parNumero.set(normaliserNumero(c.number), c.id)

  const idsCartes = (cartes ?? []).map(c => c.id)
  const listings = new Map<string, { id: string; quantity: number }>()  // `${card_id}|${variant_id}`
  for (let i = 0; i < idsCartes.length; i += 500) {
    const { data } = await supabase
      .from('pokemon_listings')
      .select('id, card_id, variant_type_id, quantity')
      .in('card_id', idsCartes.slice(i, i + 500))
    for (const l of data ?? []) {
      listings.set(`${l.card_id}|${l.variant_type_id}`, { id: l.id, quantity: l.quantity })
    }
  }

  // ── 3. En-têtes ───────────────────────────────────────────────────────────
  // La colonne A est la colonne des noms PAR POSITION, jamais par en-tête :
  // une feuille du fichier réel porte « x » en A1 au lieu de « Nom ».
  const entete = feuille.getRow(1)
  const colonnes: { col: number; libelle: string; varianteId: string }[] = []

  entete.eachCell({ includeEmpty: false }, (cell, col) => {
    if (col === 1) return
    const libelle = String(cell.value ?? '').trim()
    if (!libelle) return

    const code = COLONNE_VERS_VARIANTE[normaliser(libelle)]
    if (!code) {
      rapport.colonnesInconnues.push(libelle)
      return
    }
    const varianteId = ctx.variantes.get(code)
    if (!varianteId) {
      rapport.variantesSansType.push(`${libelle} (code attendu ${code})`)
      return
    }
    colonnes.push({ col, libelle, varianteId })
  })

  // ── 4. Lignes ─────────────────────────────────────────────────────────────
  // `cibles` sert à détecter deux lignes qui viseraient le MÊME listing : dans
  // le fichier réel, les sections « PROMO » réutilisent les numéros des cartes
  // de base. Écrire la dernière valeur écraserait silencieusement la première.
  const cibles = new Map<string, { lignes: number[]; maj: MiseAJour | null }>()

  for (let r = 2; r <= feuille.rowCount; r++) {
    const ligne = feuille.getRow(r)
    const brut = ligne.getCell(1).value
    const contenu = brut === null || brut === undefined ? '' : String(brut).trim()
    if (!contenu) continue

    rapport.lignesLues++

    const m = contenu.match(/^\s*(\d+)(?=\D|$)/)
    if (!m) {
      rapport.lignesNonParsables.push({ ligne: r, contenu })
      continue
    }
    const numero = normaliserNumero(m[1])

    const cardId = parNumero.get(numero)
    if (!cardId) {
      rapport.cartesIntrouvables.push({ numero, contenu })
      continue
    }

    for (const c of colonnes) {
      const val = ligne.getCell(c.col).value

      // « x » : la variante n'existe pas pour cette carte — on ne touche à rien.
      if (typeof val === 'string' && normaliser(val) === 'x') {
        rapport.cellulesInexistantes++
        continue
      }

      let quantite: number
      if (val === null || val === undefined || String(val).trim() === '') {
        quantite = 0
      } else if (typeof val === 'number') {
        quantite = Math.trunc(val)
      } else {
        const n = Number(String(val).replace(',', '.'))
        if (!Number.isFinite(n)) {
          rapport.colonnesInconnues.push(`valeur illisible L${r} « ${String(val)} »`)
          continue
        }
        quantite = Math.trunc(n)
      }
      if (quantite < 0) quantite = 0

      const listing = listings.get(`${cardId}|${c.varianteId}`)
      if (!listing) {
        rapport.listingsIntrouvables.push({ numero, variante: c.libelle })
        continue
      }

      const cle = `${numero}|${c.libelle}`
      const existante = cibles.get(cle)
      if (existante) {
        existante.lignes.push(r)
        existante.maj = null  // conflit : on n'écrira NI l'une NI l'autre
        continue
      }

      const maj: MiseAJour | null =
        listing.quantity === quantite
          ? null
          : { listingId: listing.id, avant: listing.quantity, apres: quantite }

      if (!maj) rapport.inchangees++
      cibles.set(cle, { lignes: [r], maj })
    }
  }

  for (const [cle, v] of cibles) {
    if (v.lignes.length > 1) {
      const [numero, variante] = cle.split('|')
      rapport.conflits.push({ numero, variante, lignes: v.lignes })
      continue
    }
    if (v.maj) rapport.majPrevues.push(v.maj)
  }

  rapport.colonnesInconnues = [...new Set(rapport.colonnesInconnues)]
  rapport.variantesSansType = [...new Set(rapport.variantesSansType)]
  return rapport
}

// ─────────────────────────────────────────────────────────────────────────────
// Rapport
// ─────────────────────────────────────────────────────────────────────────────

function afficherRapport(rapports: RapportFeuille[], commit: boolean): void {
  let totalMaj = 0
  let totalLignes = 0
  const setsIntrouvables: RapportFeuille[] = []

  for (const r of rapports) {
    totalLignes += r.lignesLues

    if (!r.setTrouve) {
      setsIntrouvables.push(r)
      console.log(`\n  ✗ ${r.feuille}`)
      console.log(`      code cherché « ${r.codeSet} » : AUCUN set de ce code en base — feuille ignorée`)
      if (r.suggestions.length) {
        console.log(`      sets proches par le libellé « ${r.libelleFeuille} » :`)
        for (const s of r.suggestions) console.log(`        · ${s}`)
      } else {
        console.log('      aucun set proche trouvé par le libellé')
      }
      continue
    }

    totalMaj += r.majPrevues.length
    const t = r.setTrouve
    console.log(`\n  ✓ ${r.feuille}`)
    console.log(`      set : ${t.code} — ${t.name_fr}`)
    console.log(
      `      ${r.lignesLues} ligne(s) · ${r.majPrevues.length} MAJ · ` +
      `${r.inchangees} inchangée(s) · ${r.cellulesInexistantes} cellule(s) « x » ignorée(s)`
    )

    if (r.colonnesInconnues.length)
      console.log(`      ⚠ colonne(s) non reconnue(s) : ${r.colonnesInconnues.join(', ')}`)
    if (r.variantesSansType.length)
      console.log(`      ⚠ variante(s) sans type en base : ${r.variantesSansType.join(', ')}`)
    if (r.lignesNonParsables.length) {
      console.log(`      ⚠ ${r.lignesNonParsables.length} ligne(s) sans numéro exploitable :`)
      for (const l of r.lignesNonParsables.slice(0, 5)) console.log(`        L${l.ligne} « ${l.contenu} »`)
      if (r.lignesNonParsables.length > 5) console.log(`        … et ${r.lignesNonParsables.length - 5} autre(s)`)
    }
    if (r.cartesIntrouvables.length) {
      console.log(`      ⚠ ${r.cartesIntrouvables.length} carte(s) sans équivalent en base :`)
      for (const c of r.cartesIntrouvables.slice(0, 5)) console.log(`        n°${c.numero} « ${c.contenu} »`)
      if (r.cartesIntrouvables.length > 5) console.log(`        … et ${r.cartesIntrouvables.length - 5} autre(s)`)
    }
    if (r.listingsIntrouvables.length) {
      const parVariante = new Map<string, number>()
      for (const l of r.listingsIntrouvables) parVariante.set(l.variante, (parVariante.get(l.variante) ?? 0) + 1)
      const detail = [...parVariante].map(([v, n]) => `${v} ×${n}`).join(', ')
      console.log(`      ⚠ ${r.listingsIntrouvables.length} listing(s) absent(s) — aucune création : ${detail}`)
    }
    if (r.conflits.length) {
      console.log(`      ⚠ ${r.conflits.length} conflit(s) — plusieurs lignes visent le MÊME listing, AUCUNE n'est écrite :`)
      for (const c of r.conflits.slice(0, 5))
        console.log(`        n°${c.numero} / ${c.variante} ← lignes ${c.lignes.join(', ')}`)
      if (r.conflits.length > 5) console.log(`        … et ${r.conflits.length - 5} autre(s)`)
    }
  }

  console.log('\n' + '─'.repeat(74))
  console.log(`  ${totalLignes} ligne(s) lue(s) · ${totalMaj} mise(s) à jour de quantité ${commit ? 'APPLIQUÉE(S)' : 'prévue(s)'}`)
  if (setsIntrouvables.length)
    console.log(`  ${setsIntrouvables.length} feuille(s) ignorée(s) faute de set correspondant en base`)
  if (!commit) console.log('  DRY-RUN — rien n\'a été écrit. Relancer avec --commit pour appliquer.')
  console.log('─'.repeat(74))
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  loadEnvLocal()

  const argv = process.argv.slice(2)
  const commit = argv.includes('--commit')
  const fichiers = argv.filter(a => !a.startsWith('--'))

  if (fichiers.length === 0) {
    console.error('Usage : npx tsx scripts/import-stock-xlsx.ts "<fichier.xlsx>" [autre.xlsx ...] [--commit]')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('[ERR] NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant.')
    process.exit(1)
  }
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: sets, error: errSets } = await supabase
    .from('pokemon_sets')
    .select('id, code, name_fr')
  if (errSets || !sets) {
    console.error('[ERR] lecture des sets impossible :', errSets?.message)
    process.exit(1)
  }

  const { data: variantes } = await supabase
    .from('pokemon_variant_types')
    .select('id, code')
  const ctx: ContexteBase = {
    sets,
    variantes: new Map((variantes ?? []).map(v => [v.code, v.id])),
  }

  console.log('═'.repeat(74))
  console.log(`  IMPORT DES QUANTITÉS — ${commit ? 'COMMIT (écriture réelle)' : 'DRY-RUN (aucune écriture)'}`)
  console.log(`  ${sets.length} sets et ${ctx.variantes.size} types de variante chargés`)
  console.log('═'.repeat(74))

  const tous: RapportFeuille[] = []

  for (const fichier of fichiers) {
    if (!fs.existsSync(fichier)) {
      console.error(`\n[ERR] fichier introuvable : ${fichier}`)
      continue
    }
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(fichier)

    console.log(`\n▸ ${path.basename(fichier)} — ${wb.worksheets.length} feuille(s)`)
    for (const feuille of wb.worksheets) {
      tous.push(await traiterFeuille(supabase, ctx, path.basename(fichier), feuille))
    }
  }

  afficherRapport(tous, commit)

  if (!commit) return

  // ── Écriture ──────────────────────────────────────────────────────────────
  // UNIQUEMENT `quantity`. Aucun autre champ n'est envoyé, `price` compris.
  let ecrites = 0
  let echecs = 0
  for (const r of tous) {
    for (const maj of r.majPrevues) {
      const { error } = await supabase
        .from('pokemon_listings')
        .update({ quantity: maj.apres })
        .eq('id', maj.listingId)
      if (error) {
        echecs++
        console.error(`[ERR] listing ${maj.listingId} : ${error.message}`)
      } else {
        ecrites++
      }
    }
  }
  console.log(`\n  ${ecrites} quantité(s) écrite(s)${echecs ? `, ${echecs} échec(s)` : ''}.`)
}

main().catch(err => {
  console.error('[ERR]', err)
  process.exit(1)
})
