/**
 * Thème d'univers — One Piece vs Pokémon.
 *
 * Les deux univers ne diffèrent pas seulement par une couleur : ils ont une
 * VOIX distincte, définie par la DA (cf. `Tanuki Univers.dc.html`).
 *  - One Piece : registre du carnet de bord, serif italique, langage de route.
 *  - Pokémon   : registre de l'index, mono capitales, langage de classification.
 *
 * Données pures, aucun React : consommable côté serveur comme client.
 */

export type Universe = 'onepiece' | 'pokemon'

export interface UniverseTheme {
  id: Universe
  label: string
  /** Slug utilisé dans les routes `/catalogue/<slug>` */
  slug: 'onepiece' | 'pokemon'
  eyebrow: string
  /** Interlettrage de l'eyebrow : Pokémon respire plus large (registre index) */
  eyebrowTracking: string
  tagline: string
  /** Voix secondaire : serif italique (OP) vs mono capitales (Pokémon) */
  voiceClass: string
  singlesIntro: string
  singlesCta: string
  sealedCta: string
}

export const UNIVERSES: Record<Universe, UniverseTheme> = {
  onepiece: {
    id: 'onepiece',
    label: 'One Piece',
    slug: 'onepiece',
    eyebrow: 'Route · Grand Line · archives Tanuki',
    eyebrowTracking: '0.2em',
    tagline: "Le journal de bord d'une collection — série par série.",
    voiceClass: 'font-voice italic text-[21px] leading-snug',
    singlesIntro:
      "Chaque carte au-dessus d'un euro est une pièce individuelle : scannée recto-verso, authentifiée, état précis, inspectable en 3D.",
    singlesCta: 'PARCOURIR LES SÉRIES →',
    sealedCta: 'VOIR LES SCELLÉS →',
  },
  pokemon: {
    id: 'pokemon',
    label: 'Pokémon',
    slug: 'pokemon',
    eyebrow: 'Index · classification · archives Tanuki',
    eyebrowTracking: '0.34em',
    tagline: 'Chaque extension, chaque numéro, chaque état — répertorié.',
    voiceClass: 'font-mono uppercase text-[13px] tracking-[0.22em]',
    singlesIntro:
      "Toutes les extensions, de Mega-Évolution à Soleil et Lune. Chaque single au-dessus d'un euro est scanné et authentifié.",
    singlesCta: "PARCOURIR L'INDEX →",
    sealedCta: 'VOIR LES SCELLÉS →',
  },
}

export function getUniverse(id: string | null | undefined): UniverseTheme {
  return id === 'pokemon' ? UNIVERSES.pokemon : UNIVERSES.onepiece
}

export const UNIVERSE_LIST: UniverseTheme[] = [UNIVERSES.onepiece, UNIVERSES.pokemon]
