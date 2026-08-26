/**
 * Préférences d'affichage du catalogue admin — mode de tri et blocs repliés.
 *
 * Elles vivent dans `localStorage` et non dans l'URL : le nettoyage du
 * catalogue se fait bloc par bloc sur la durée, et rouvrir l'écran doit
 * retrouver l'état où on l'a laissé, pas un lien qu'il aurait fallu penser à
 * garder.
 *
 * Mini-store + `useSyncExternalStore`, comme le cookie « par page » de
 * `components/ui/Pagination.tsx` — et pour la même raison : un `useState` +
 * `useEffect` produirait soit une divergence d'hydratation, soit un `setState`
 * dans un effet. Le rendu serveur sert le DÉFAUT, le client adopte la
 * préférence dès le premier rendu.
 *
 * ⚠️ `getSnapshot` doit rendre une valeur RÉFÉRENTIELLEMENT STABLE : reparser
 * le JSON à chaque appel rendrait un `Set` neuf à chaque fois et React
 * boucherait à l'infini. D'où le cache indexé sur la chaîne brute.
 */

const CLE_MODE = 'gk.catalogue.mode'
const CLE_BLOCS = 'gk.catalogue.blocs-replies'

export type ModeCatalogue = 'blocs' | 'chrono'

/** Le groupement par bloc est le mode par défaut ; le plat reste l'ordre de travail. */
export const MODE_DEFAUT: ModeCatalogue = 'blocs'

const VIDE: ReadonlySet<string> = new Set()

const abonnes = new Set<() => void>()

function notifier() {
  for (const cb of abonnes) cb()
}

/**
 * L'écouteur `storage` en prime : deux onglets d'admin ouverts sur le catalogue
 * restent d'accord sur ce qui est replié. Il ne se déclenche que pour les
 * AUTRES onglets — d'où `notifier()` en plus, côté écrivain.
 */
export function sAbonnerPreferences(cb: () => void) {
  abonnes.add(cb)
  window.addEventListener('storage', cb)
  return () => {
    abonnes.delete(cb)
    window.removeEventListener('storage', cb)
  }
}

function lire(cle: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(cle)
  } catch {
    // Navigation privée, quota, stockage bloqué : la préférence est un confort,
    // jamais une condition de fonctionnement de l'écran.
    return null
  }
}

function ecrire(cle: string, valeur: string) {
  try {
    window.localStorage.setItem(cle, valeur)
  } catch {
    /* voir `lire` */
  }
  notifier()
}

// ── Mode d'affichage ────────────────────────────────────────────────────────

export function lireModeClient(): ModeCatalogue {
  return lire(CLE_MODE) === 'chrono' ? 'chrono' : MODE_DEFAUT
}

export const modeServeur = (): ModeCatalogue => MODE_DEFAUT

export function definirMode(mode: ModeCatalogue) {
  ecrire(CLE_MODE, mode)
}

// ── Blocs repliés ───────────────────────────────────────────────────────────

let brut: string | null = null
let cache: ReadonlySet<string> = VIDE

export function lireBlocsRepliesClient(): ReadonlySet<string> {
  const v = lire(CLE_BLOCS)
  if (v === brut) return cache
  brut = v
  try {
    const liste = v ? (JSON.parse(v) as unknown) : []
    cache = new Set(Array.isArray(liste) ? liste.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    cache = VIDE
  }
  return cache
}

/** Au rendu serveur, aucun bloc n'est replié : tout est ouvert. */
export const blocsRepliesServeur = (): ReadonlySet<string> => VIDE

export function basculerBloc(nom: string) {
  const suivant = new Set(lireBlocsRepliesClient())
  if (suivant.has(nom)) suivant.delete(nom)
  else suivant.add(nom)
  ecrire(CLE_BLOCS, JSON.stringify([...suivant]))
}

export function definirTousLesBlocs(noms: string[], replies: boolean) {
  ecrire(CLE_BLOCS, JSON.stringify(replies ? noms : []))
}
