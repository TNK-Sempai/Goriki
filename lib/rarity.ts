/**
 * Rareté → intensité d'interaction.
 * L'animation devient une information sur la rareté.
 *
 * Les codes viennent de `pokemon_cards.rarity` / `onepiece_cards.rarity`.
 * Les libellés varient selon l'import : on normalise avant de comparer,
 * et on ne hardcode aucune liste exhaustive — inconnu ⇒ tier 0 (calme).
 */

export type RarityTier = 0 | 1 | 2 | 3

export interface SurfaceBehaviour {
  tier: RarityTier
  /** amplitude de rotation au curseur, en degrés */
  tiltAmp: number
  /** décollement vertical, en px */
  lift: number
  /** parallaxe image / cadre, en px */
  parallax: number
  /** reflet spéculaire */
  shine: false | 'soft' | 'foil'
  /** bordure qui s'allume au survol */
  glowEdge: boolean
}

const CHASE = /(secret|hyper|rainbow|special art|alt(ernate)? art|manga|sec\b|sar\b|sir\b|ir\b|gold)/i
const SUPER = /(super rare|ultra rare|\bsr\b|\bur\b|double rare|\bdr\b|\bex\b|\bv\b|vmax|vstar|full art)/i
const RARE = /(rare|holo|leader|\bl\b|uncommon|\buc\b|\brr\b)/i

export function rarityTier(rarity?: string | null): RarityTier {
  if (!rarity) return 0
  const r = rarity.trim()
  if (CHASE.test(r)) return 3
  if (SUPER.test(r)) return 2
  if (RARE.test(r)) return 1
  return 0
}

const BEHAVIOURS: Record<RarityTier, Omit<SurfaceBehaviour, 'tier'>> = {
  0: { tiltAmp: 0, lift: 0, parallax: 0, shine: false, glowEdge: false },
  1: { tiltAmp: 3, lift: 2, parallax: 0, shine: false, glowEdge: false },
  2: { tiltAmp: 6, lift: 4, parallax: 6, shine: 'soft', glowEdge: false },
  3: { tiltAmp: 9, lift: 6, parallax: 6, shine: 'foil', glowEdge: true },
}

export function surfaceBehaviour(rarity?: string | null): SurfaceBehaviour {
  const tier = rarityTier(rarity)
  return { tier, ...BEHAVIOURS[tier] }
}

/** Gradient spéculaire orienté par la position du curseur (0 → 1 sur X). */
export function shineGradient(kind: 'soft' | 'foil', mx: number): string {
  const angle = Math.round(mx * 170 + 40)
  return kind === 'foil'
    ? `linear-gradient(${angle}deg, rgba(200,134,10,0.5) 0%, rgba(255,255,255,0.8) 34%, rgba(150,190,215,0.45) 54%, rgba(200,134,10,0.4) 74%, transparent 100%)`
    : `linear-gradient(${angle}deg, transparent 20%, rgba(255,255,255,0.72) 48%, transparent 78%)`
}
