export const SITE_NAME = 'Goriki'
export const SITE_DESCRIPTION = 'Boutique TCG Pokémon & One Piece — Cartes singles, scellés et accessoires'
export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

/**
 * Frontière du back-office — SOURCE UNIQUE.
 *
 * Deux couches du parcours public s'éteignent derrière cette frontière, et pas
 * par goût : le lissage Lenis et le canvas d'atmosphère. Le lissage n'est pas
 * un simple effet — il pose sur `window` un écouteur `wheel` NON PASSIF qui
 * appelle `preventDefault()` et pilote lui-même le défilement du document.
 *
 * MESURÉ (24 août 2026, Chrome 151, coquille `gk` réelle, molette dispatchée
 * par CDP en trois points de l'écran) :
 *   · 1 écouteur `wheel` non passif sur `window` → .gk-main défile de   0 px
 *   · 0 écouteur                                 → .gk-main défile de 600 px
 * Même DOM, même CSS, une seule variable. La coquille du back-office
 * (`height:100dvh; overflow:hidden` + `.gk-main{overflow-y:auto}`) ne défile
 * QUE si cette frontière est respectée.
 *
 * C'est pourquoi le préfixe est ici et non recopié à côté de chaque usage :
 * il a déjà été perdu deux fois, et rien dans le CSS de l'admin ne dit tout
 * haut qu'il en dépend.
 */
export const PREFIXE_ADMIN = '/admin'

export const TCG_TYPES = {
  POKEMON: 'pokemon',
  ONEPIECE: 'onepiece',
} as const

export type TCGType = (typeof TCG_TYPES)[keyof typeof TCG_TYPES]

export const CONDITIONS = ['Mint', 'Near Mint', 'Excellent', 'Light Played', 'Moderate Played'] as const
export type Condition = (typeof CONDITIONS)[number]

export const PHOTO_PRICE_THRESHOLD = 1.0

// ─────────────────────────────────────────────────────────────────────────────
// Livraison — PLUS AUCUN TARIF ICI.
//
// `SHIPPING_RATES` (BE 5 € / EU 8 € / offerte dès 60 €) et `MIN_ORDER_AMOUNT`
// ont été SUPPRIMÉS. Les tarifs vivent en base, dans `shipping_rates` et
// `shipping_settings` (migration 0055), et se règlent depuis /admin/livraison :
// une grille transporteur change sans prévenir, et une grille en dur obligeait
// à redéployer pour corriger un prix.
//
// Le propriétaire a par ailleurs tranché : pas de livraison gratuite, pas de
// seuil, pas de minimum de commande. Ne pas réintroduire ces trois notions.
//
// Le calcul est dans `lib/livraison/calcul.ts` (pur, testé) et
// `lib/livraison/devis.ts` (lecture en base).
// ─────────────────────────────────────────────────────────────────────────────

// Durée de vie d'un checkout : la commande `pending` et sa réservation de stock
// expirent au-delà. Aligné sur `expires_at` de la Checkout Session Stripe,
// dont le minimum autorisé est 30 minutes.
export const CHECKOUT_TTL_MINUTES = 30

// ─────────────────────────────────────────────────────────────────────────────
// Rachat
//
// RÈGLE MÉTIER NON NÉGOCIABLE : aucun prix n'est jamais affiché à l'utilisateur
// avant inspection physique. Il n'y a donc AUCUN barème de reprise ici — les
// anciens `BUYBACK_RATES` ont été supprimés avec l'estimateur instantané qui
// affichait « 0,00 € » en direct, à rebours de la logique de la maison.
// L'offre est saisie par Goriki après réception du lot (`buyback_requests.offer_amount`,
// NULL par construction à la soumission).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Au-delà de ce nombre de cartes, le bulk ne passe plus par un formulaire :
 * on invite à un contact direct. Un lot de cette taille se négocie, il ne se
 * déclare pas en cases à cocher.
 *
 * TODO seuil à valider par l'utilisateur.
 */
export const BULK_CONTACT_THRESHOLD = 2000

/**
 * Catégories grossières du rachat bulk. Volontairement peu nombreuses : le
 * bulk se pèse et se trie au lot, il ne s'inventorie pas carte par carte.
 *
 * TODO catégories à valider par l'utilisateur.
 */
export const BULK_CATEGORIES = [
  { code: 'commune', label: 'Communes & peu communes', hint: 'Le gros du volume, tout état confondu' },
  { code: 'rare', label: 'Rares', hint: 'Rares classiques, holos incluses' },
  { code: 'brillante', label: 'Brillantes & spéciales', hint: 'EX, V, SR, alt art…' },
  { code: 'abime', label: 'Abîmées', hint: 'Pliées, rayées, jouées sans protection' },
] as const

/** Adresse de contact pour les gros stocks bulk. */
export const BULK_CONTACT_EMAIL = 'contact@tanuki-corporation.com'
