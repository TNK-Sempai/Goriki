// Vérification #CLEAN-01 point 3 — lecture seule, aucune écriture en base.
// Confirme qu'un import complet ne peut plus atteindre un set Pokémon Pocket.
import { fetchSets } from '../lib/tcgdex'
import { filtrerSetsImportables, idsDesSetsExclus, SERIES_EXCLUES } from '../lib/import/pokemon'

const CODES_PURGES = ['A1', 'A1A', 'A2', 'A2A', 'A2B', 'A3', 'A3A', 'A3B', 'A4', 'A4A', 'B1', 'B1A', 'B2', 'B2A', 'P-A']

async function main() {
  const exclus = await idsDesSetsExclus()
  console.log(`séries exclues        : ${SERIES_EXCLUES.join(', ')}`)
  console.log(`ids écartés (${exclus.size})     : ${[...exclus].sort().join(', ')}`)

  const tous = await fetchSets()
  const gardes = await filtrerSetsImportables(tous, l => console.log(l))
  console.log(`\nsets TCGdex           : ${tous.length}`)
  console.log(`sets importables      : ${gardes.length}  (écartés : ${tous.length - gardes.length})`)

  const codesGardes = new Set(gardes.map(s => s.id.toUpperCase()))
  const rescapes = CODES_PURGES.filter(c => codesGardes.has(c))
  console.log(`\ncodes purgés encore importables : ${rescapes.length === 0 ? 'AUCUN' : rescapes.join(', ')}`)

  const manquants = CODES_PURGES.filter(c => ![...exclus].some(i => i.toUpperCase() === c))
  console.log(`codes purgés non couverts       : ${manquants.length === 0 ? 'AUCUN' : manquants.join(', ')}`)

  process.exitCode = rescapes.length === 0 && manquants.length === 0 ? 0 : 1
}

main()
