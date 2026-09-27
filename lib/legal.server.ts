import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { LEGAL_UPDATED_AT, MARQUEUR_DATE, dateLegaleFr } from './legal'

/**
 * Lecture d'un document légal — SERVEUR.
 *
 * ─── POURQUOI UN FICHIER PLUTÔT QU'UNE CHAÎNE DANS LE CODE ────────────────
 * Un texte de contrat se relit, se fait corriger, et change sans le
 * développeur. Le garder en Markdown dans `content/legal/` permet de l'éditer
 * sans toucher au JSX, et de le comparer d'une version à l'autre.
 *
 * ⚠️ Ces fichiers doivent être EMBARQUÉS dans le déploiement : voir
 * `outputFileTracingIncludes` dans `next.config.ts`. Sans cette déclaration,
 * les pages rendraient en local et échoueraient une fois en ligne, faute de
 * trouver le fichier.
 */
export async function lireDocumentLegal(slug: string): Promise<string> {
  const chemin = path.join(process.cwd(), 'content', 'legal', `${slug}.md`)
  const brut = await readFile(chemin, 'utf8')

  // La date vit dans `LEGAL_UPDATED_AT`, pas dans les textes : une date recopiée
  // dans quatre fichiers finirait par en contredire trois.
  return brut.replaceAll(MARQUEUR_DATE, dateLegaleFr(LEGAL_UPDATED_AT))
}
