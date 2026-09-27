import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { cache } from 'react'

/**
 * Checklists PokéCardex — la RÉFÉRENCE contre laquelle on compare la base.
 *
 * Chaque checklist dit, pour un numéro de carte, COMBIEN de cases existent :
 * c'est le nombre de variantes que la carte devrait porter. Sans elle,
 * l'éditeur oblige à deviner — avec elle, l'écart saute aux yeux.
 *
 * Deux fichiers, et il en faut deux : `checklists.json` est indexé par CHEMIN de
 * PDF (« Wizards/checklist-JU.pdf »), pas par code de set. `mapping.csv` fait la
 * jonction `checklist-JU.pdf` → `BASE2`. Les joindre à la main reviendrait à
 * réécrire ce mapping dans le code, où il divergerait au premier ajout.
 *
 * ⚠️ COUVERTURE PARTIELLE, ET C'EST NORMAL. 267 checklists, mais seulement 176
 * lignes de mapping : une checklist sans correspondance n'est pas rattachable à
 * un set, et un set sans checklist n'a simplement pas de référence. L'écran doit
 * dire « pas de checklist » plutôt que d'afficher un tableau vide qu'on lirait
 * comme « zéro case attendue ».
 *
 * Lu une seule fois par requête grâce à `cache()` : le fichier fait 1,1 Mo et
 * l'éditeur le demande à chaque rendu de set.
 */

export interface CarteChecklist {
  /** Nombre de cases de la checklist = nombre de variantes attendues. */
  cases: number
  /** Cases déjà cochées dans la source, le cas échéant. */
  Y?: number
}

export interface ChecklistSet {
  cards: Record<string, CarteChecklist>
  /** Blocs nommés — « Tampon (W doré) »: ["60"]. Futurs axes tampon/finition. */
  blocks?: Record<string, string[]>
  header?: unknown
}

const RACINE = path.join(process.cwd(), 'data')

const chargerTout = cache(async (): Promise<{
  parCode: Map<string, ChecklistSet>
  totalChecklists: number
  codesMappes: number
}> => {
  const [brutJson, brutCsv] = await Promise.all([
    readFile(path.join(RACINE, 'checklists.json'), 'utf8'),
    readFile(path.join(RACINE, 'mapping.csv'), 'utf8'),
  ])

  const checklists = JSON.parse(brutJson) as Record<string, ChecklistSet>

  // `mapping.csv` : « checklist-JU.pdf;BASE2 », séparateur point-virgule.
  const fichierVersCode = new Map<string, string>()
  for (const ligne of brutCsv.split(/\r?\n/)) {
    if (!ligne.trim()) continue
    const [fichier, code] = ligne.split(';')
    if (fichier && code) fichierVersCode.set(fichier.trim(), code.trim().toUpperCase())
  }

  const parCode = new Map<string, ChecklistSet>()
  for (const [chemin, entree] of Object.entries(checklists)) {
    // La clé porte le dossier ; le mapping ne connaît que le nom de fichier.
    const fichier = chemin.split('/').pop() ?? chemin
    const code = fichierVersCode.get(fichier)
    if (code) parCode.set(code, entree)
  }

  return { parCode, totalChecklists: Object.keys(checklists).length, codesMappes: parCode.size }
})

/** La checklist d'un set, ou `null` si aucune ne lui est rattachée. */
export async function checklistDuSet(codeSet: string | null | undefined): Promise<ChecklistSet | null> {
  if (!codeSet) return null
  const { parCode } = await chargerTout()
  return parCode.get(codeSet.toUpperCase()) ?? null
}

/**
 * Cases attendues par numéro de carte, prêtes à comparer.
 *
 * Les numéros sont normalisés en retirant les zéros de tête : la base stocke
 * « 001 » là où la checklist écrit « 1 ». Sans ça, la comparaison échouerait
 * silencieusement sur des sets entiers en donnant « pas de checklist » alors
 * qu'elle existe.
 */
export function casesParNumero(checklist: ChecklistSet | null): Map<string, number> {
  const out = new Map<string, number>()
  if (!checklist) return out
  for (const [numero, carte] of Object.entries(checklist.cards ?? {})) {
    const cle = numero.replace(/^0+(?=\d)/, '')
    out.set(cle, carte.cases ?? 0)
  }
  return out
}

/** Normalise un numéro de carte de la base pour l'aligner sur la checklist. */
export const numeroNormalise = (n: string) => n.replace(/^0+(?=\d)/, '')
