/**
 * Pagination — socle partagé par toutes les grilles longues du site.
 *
 * DEUX SOURCES POUR LE CHOIX « 30 ou 50 » :
 *   1. l'URL (`?par=50`) — partageable, et c'est elle qui gagne ;
 *   2. un cookie — c'est la MÉMOIRE : elle survit au changement de page et de
 *      set, là où un paramètre d'URL serait perdu au premier lien suivi.
 *
 * Pourquoi un cookie et non `localStorage` : ces grilles sont rendues côté
 * SERVEUR. Le serveur lit un cookie, il ne lit pas `localStorage` — celui-ci
 * imposerait un premier rendu à 30 puis un re-rendu client, donc un
 * clignotement de la grille à chaque arrivée sur une page.
 */

export const OPTIONS_PAR_PAGE = [30, 50] as const
export const PAR_PAGE_DEFAUT = 30
export const COOKIE_PAR_PAGE = 'goriki_par_page'

export function normaliserParPage(v: unknown): number | null {
  const n = Number(v)
  return (OPTIONS_PAR_PAGE as readonly number[]).includes(n) ? n : null
}

export function lirePage(searchParams: Record<string, string | string[] | undefined>): number {
  const brut = searchParams.page
  const n = Number(typeof brut === 'string' ? brut : 1)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
}

export interface Tranche<T> {
  /** Page effectivement servie — bornée, jamais hors de [1, pages]. */
  page: number
  pages: number
  total: number
  elements: T[]
  /** Index du premier élément affiché, base 1. Sert au libellé « 31–60 sur 299 ». */
  premier: number
  dernier: number
}

/**
 * Découpe une liste DÉJÀ filtrée et DÉJÀ triée.
 *
 * L'ordre compte : filtrer après avoir découpé donnerait une page de 30 dont
 * seuls quelques éléments survivent au filtre. La pagination est la toute
 * dernière opération.
 */
export function decouper<T>(elements: T[], pageDemandee: number, parPage: number): Tranche<T> {
  const total = elements.length
  const pages = Math.max(1, Math.ceil(total / parPage))
  // Une page hors bornes (filtre qui rétrécit le résultat, URL bricolée) ramène
  // sur la dernière page existante plutôt que sur une grille vide.
  const page = Math.min(Math.max(1, pageDemandee), pages)
  const debut = (page - 1) * parPage
  return {
    page,
    pages,
    total,
    elements: elements.slice(debut, debut + parPage),
    premier: total === 0 ? 0 : debut + 1,
    dernier: Math.min(debut + parPage, total),
  }
}
