export const SITE_NAME = 'Goriki'
export const SITE_DESCRIPTION = 'Boutique TCG Pokémon & One Piece — Cartes singles, scellés et accessoires'
export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export const TCG_TYPES = {
  POKEMON: 'pokemon',
  ONEPIECE: 'onepiece',
} as const

export type TCGType = (typeof TCG_TYPES)[keyof typeof TCG_TYPES]

export const CONDITIONS = ['Mint', 'Near Mint', 'Excellent', 'Light Played', 'Moderate Played'] as const
export type Condition = (typeof CONDITIONS)[number]

export const PHOTO_PRICE_THRESHOLD = 1.0

// TODO tarifs à valider
export const SHIPPING_RATES = {
  BE: 5.00,              // zone Belgique (euros)
  EU: 8.00,              // zone UE-proche : FR, LU, NL, DE (euros)
  FREE_THRESHOLD: 60.00, // livraison offerte dès ce sous-total marchandises (euros)
} as const

// TODO montant à valider par l'utilisateur (placeholder mission 03)
// Évalué sur le sous-total MARCHANDISES, hors port et AVANT déduction du crédit boutique.
// Mettre à 0 pour désactiver le minimum de commande.
export const MIN_ORDER_AMOUNT = 5.00

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
export const BULK_CONTACT_EMAIL = 'contact@goriki.be'
