'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { COOKIE_PAR_PAGE, OPTIONS_PAR_PAGE, PAR_PAGE_DEFAUT, normaliserParPage } from '@/lib/pagination'

/**
 * Pagination — UN SEUL composant pour toutes les grilles longues du site.
 *
 * Deux modes de pilotage, une seule apparence :
 *   · `<PaginationUrl>` pour les grilles rendues côté serveur, dont l'état vit
 *     dans l'URL (détail de set, scellés, dépôt-vente) ;
 *   · `<Pagination>` piloté par `onChange` pour les grilles dont les filtres
 *     sont en état local (index des sets).
 *
 * Le choix 30/50 est écrit dans un cookie ICI, quel que soit le mode : la
 * mémoire est donc la même partout, et un seul endroit la gère.
 *
 * Registre visuel : pilules `.pill` et mono `.data`, comme la barre d'outils de
 * set et les filtres de rayon. Pas de variante par page.
 */

/**
 * Le cookie EST la source de vérité de la préférence, y compris pour les
 * grilles pilotées en état local. Ce mini-store permet à `useSyncExternalStore`
 * de s'y abonner : un `useState` + `useEffect` produirait soit une divergence
 * d'hydratation, soit un `setState` dans un effet.
 */
const abonnes = new Set<() => void>()

export function sAbonnerParPage(cb: () => void) {
  abonnes.add(cb)
  return () => { abonnes.delete(cb) }
}

export function lireParPageClient(): number {
  if (typeof document === 'undefined') return PAR_PAGE_DEFAUT
  const m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE_PAR_PAGE + '=(\\d+)'))
  return normaliserParPage(m?.[1]) ?? PAR_PAGE_DEFAUT
}

/** Valeur servie au rendu SERVEUR : le défaut, jamais le cookie. */
export const parPageServeur = () => PAR_PAGE_DEFAUT

function memoriserParPage(valeur: number) {
  // 1 an, sur tout le site. `SameSite=Lax` : ce cookie n'est qu'une préférence
  // d'affichage, il n'a aucune raison de voyager en requête tierce.
  document.cookie = `${COOKIE_PAR_PAGE}=${valeur}; path=/; max-age=31536000; samesite=lax`
  for (const cb of abonnes) cb()
}

/** Fenêtre de numéros autour de la page courante, avec ellipses. */
function fenetre(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const out: (number | '…')[] = [1]
  const debut = Math.max(2, page - 1)
  const fin = Math.min(pages - 1, page + 1)
  if (debut > 2) out.push('…')
  for (let i = debut; i <= fin; i++) out.push(i)
  if (fin < pages - 1) out.push('…')
  out.push(pages)
  return out
}

export interface PaginationProps {
  page: number
  pages: number
  total: number
  parPage: number
  premier: number
  dernier: number
  /** Nom de ce qu'on compte, au singulier : « carte », « set », « produit »… */
  unite?: string
  onChange: (patch: { page?: number; parPage?: number }) => void
}

export function Pagination({
  page,
  pages,
  total,
  parPage,
  premier,
  dernier,
  unite = 'élément',
  onChange,
}: PaginationProps) {
  // Rien à paginer ET rien à choisir : on n'encombre pas la page.
  if (total <= OPTIONS_PAR_PAGE[0]) return null

  const choisirParPage = (v: number) => {
    memoriserParPage(v)
    // Changer la taille de page renvoie en page 1 : rester en page 7 après être
    // passé de 30 à 50 par page afficherait une tranche sans rapport.
    onChange({ parPage: v, page: 1 })
  }

  const boutonPage =
    'rounded-control px-2.5 py-1.5 font-mono text-[10px] tracking-[0.08em] transition-colors'

  return (
    <nav
      aria-label="Pagination"
      className="mt-8 flex flex-col gap-4 border-t border-[rgba(26,22,17,0.12)] pt-5 sm:flex-row sm:items-center sm:justify-between lg:mt-10"
    >
      <span className="data text-[9px]">
        {premier}–{dernier} sur {total} {unite}
        {total > 1 ? 's' : ''}
      </span>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-1.5">
          <span className="data text-[9px] text-ink-55">Par page</span>
          {OPTIONS_PAR_PAGE.map(v => (
            <button
              key={v}
              type="button"
              onClick={() => choisirParPage(v)}
              data-active={parPage === v}
              aria-current={parPage === v}
              className="pill font-mono !text-[10px] !tracking-[0.08em]"
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChange({ page: page - 1 })}
            disabled={page <= 1}
            aria-label="Page précédente"
            className={`${boutonPage} text-ink-55 hover:text-ink disabled:cursor-not-allowed disabled:opacity-35`}
          >
            ‹
          </button>

          {fenetre(page, pages).map((n, i) =>
            n === '…' ? (
              <span key={`e${i}`} className="data px-1 text-[10px] text-ink-55">
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                onClick={() => onChange({ page: n })}
                aria-current={n === page ? 'page' : undefined}
                aria-label={`Page ${n}`}
                className={`${boutonPage} ${
                  n === page
                    ? 'bg-ink text-parchment'
                    : 'text-ink-70 hover:bg-[rgba(26,22,17,0.07)] hover:text-ink'
                }`}
              >
                {n}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() => onChange({ page: page + 1 })}
            disabled={page >= pages}
            aria-label="Page suivante"
            className={`${boutonPage} text-ink-55 hover:text-ink disabled:cursor-not-allowed disabled:opacity-35`}
          >
            ›
          </button>
        </div>
      </div>
    </nav>
  )
}

/**
 * Variante branchée sur l'URL, pour les grilles rendues côté serveur.
 *
 * `router.replace` et non `push` : la pagination n'est pas une étape de
 * navigation, revenir en arrière doit ramener à la page PRÉCÉDENTE du site, pas
 * dérouler à l'envers les pages de la grille. `scroll: false` puis remontée
 * explicite vers l'ancre : sinon on change de page en restant au milieu de la
 * grille précédente.
 */
export function PaginationUrl({
  ancre,
  ...props
}: Omit<PaginationProps, 'onChange'> & { ancre?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const onChange = ({ page, parPage }: { page?: number; parPage?: number }) => {
    const next = new URLSearchParams(params.toString())
    if (parPage !== undefined) next.set('par', String(parPage))
    if (page !== undefined) {
      if (page <= 1) next.delete('page')
      else next.set('page', String(page))
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    const cible = ancre ? document.querySelector(ancre) : null
    if (cible) cible.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return <Pagination {...props} onChange={onChange} />
}
