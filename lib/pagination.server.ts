import { cookies } from 'next/headers'
import { normaliserParPage, PAR_PAGE_DEFAUT, COOKIE_PAR_PAGE } from './pagination'

/**
 * Résolution du « par page » côté SERVEUR.
 *
 * Séparé de `lib/pagination.ts` parce que ce module importe `next/headers` :
 * `lib/pagination.ts` est importé par des composants CLIENTS (`Pagination`,
 * `SetsIndex`), et y laisser cet import ferait entrer du code serveur dans le
 * bundle navigateur.
 *
 * Ordre de priorité : l'URL gagne (elle est explicite et partageable), sinon le
 * cookie (la mémoire), sinon le défaut.
 */
export async function resoudreParPage(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<number> {
  const brut = searchParams.par
  const depuisUrl = normaliserParPage(typeof brut === 'string' ? brut : undefined)
  if (depuisUrl) return depuisUrl

  const jar = await cookies()
  return normaliserParPage(jar.get(COOKIE_PAR_PAGE)?.value) ?? PAR_PAGE_DEFAUT
}
