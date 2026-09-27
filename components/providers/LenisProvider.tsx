'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Lenis from 'lenis'
import { PREFIXE_ADMIN } from '@/lib/constants'

/**
 * Smooth scroll — couche 1 du motion system.
 *
 * Les quatre guards de la doctrine sont tous ici :
 *  - SSR       : l'init vit dans un `useEffect`, jamais au rendu.
 *  - StrictMode: `lenisRef` empêche la double initialisation du double-montage.
 *  - Touch     : le lissage est désactivé sur pointeur grossier — sur mobile il
 *                casse le scroll natif et le rend poisseux.
 *  - Reduced   : `prefers-reduced-motion: reduce` neutralise complètement Lenis.
 *
 * Le scroll natif reste la référence : Lenis ne fait que l'interpoler.
 *
 * ─── CINQUIÈME GUARD : L'ADMIN ────────────────────────────────────────────
 * `smoothWheel` pose un écouteur `wheel` sur `window` avec `preventDefault()`
 * et pilote lui-même `window.scrollTo`. Conséquence : AUCUN conteneur interne
 * en `overflow: auto` ne reçoit jamais la molette — il faut attraper sa barre
 * de défilement à la souris. C'est exactement le défaut signalé sur les écrans
 * d'administration, qui sont bâtis sur des colonnes défilantes.
 *
 * La doctrine réserve déjà Lenis au parcours PUBLIC ; `natureDuFond()` écarte
 * `/admin` de tout fond pour la même raison. On aligne : pas de lissage dans
 * l'outil de travail, le scroll natif y est la bonne réponse.
 *
 * Le préfixe vient de `PREFIXE_ADMIN` et n'est PAS réécrit ici : recopié, il a
 * déjà été perdu deux fois lors de refontes. Le commentaire de la constante
 * porte la mesure qui établit le lien de cause à effet.
 */
const EXCLUS = [PREFIXE_ADMIN]

export default function LenisProvider({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null)
  const pathname = usePathname()

  // On dépend du FRANCHISSEMENT de la frontière, pas du chemin. Mettre
  // `pathname` en dépendance détruirait et reconstruirait l'instance à chaque
  // navigation publique : le lissage repartirait de zéro à chaque page, ce qui
  // se ressent comme une transition brutale.
  const estAdmin = EXCLUS.some(p => pathname.startsWith(p))

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (lenisRef.current) return // StrictMode : deuxième montage ignoré

    if (estAdmin) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarse = window.matchMedia('(pointer: coarse)').matches
    if (reduced || coarse) return

    const lenis = new Lenis({
      duration: 1.05,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })
    lenisRef.current = lenis

    let raf = 0
    const loop = (time: number) => {
      lenis.raf(time)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
      lenisRef.current = null
    }
    // `estAdmin` et non `pathname` : l'instance n'est détruite et recréée qu'au
    // passage réel de la frontière. Entrer dans /admin la détruit — sans quoi
    // le lissage y avalerait la molette ; en sortir la recrée. Une navigation
    // publique → publique ne la touche pas.
  }, [estAdmin])

  // ─── POSITION DE DÉFILEMENT À LA NAVIGATION ──────────────────────────────
  //
  // Mesuré : depuis une liste de cartes défilée à 1600 px, cliquer une carte
  // ouvrait sa fiche à 1118 px — au milieu du contenu, la carte hors écran.
  //
  // Ce n'est pas un bug de Next, c'est son comportement DOCUMENTÉ : « the
  // default scrolling behavior of <Link> is to maintain scroll position […] as
  // long as the Page is visible in the viewport ». La page de destination
  // occupant l'écran, Next considère qu'il n'y a rien à faire et garde la
  // position. Le raisonnement se tient pour une liste paginée ; il ne tient pas
  // pour un catalogue où l'on ouvre une fiche.
  //
  // Vérifié avant d'écrire ces lignes : ce n'est ni Lenis (même position avec
  // le lissage désactivé) ni `scroll-behavior: smooth` (même position en le
  // forçant à `auto`). Les corriger aurait été traiter deux innocents.
  //
  // Le retour arrière est EXCLU : il restitue déjà correctement la position,
  // et l'écraser serait remplacer un défaut par un autre. `popstate` précède
  // le rendu React, donc le drapeau est posé avant que cet effet ne s'exécute.
  const premierRendu = useRef(true)
  const parHistorique = useRef(false)

  useEffect(() => {
    const onPop = () => { parHistorique.current = true }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    // Au tout premier rendu il n'y a pas eu de navigation : remettre en haut
    // écraserait l'ancre demandée dans l'URL ou la position restaurée au
    // rafraîchissement.
    if (premierRendu.current) { premierRendu.current = false; return }
    if (parHistorique.current) { parHistorique.current = false; return }

    const lenis = lenisRef.current
    if (lenis) {
      // Passer par Lenis quand il tourne : écrire `scrollTop` sous ses pieds
      // le laisserait avec une position interne périmée, qu'il rattraperait au
      // premier cran de molette — soit précisément un ressaut.
      lenis.scrollTo(0, { immediate: true })
    } else {
      // `instant` explicite : `html { scroll-behavior: smooth }` transformerait
      // sinon ce repositionnement en défilement animé sur toute la hauteur.
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [pathname])

  return <>{children}</>
}
