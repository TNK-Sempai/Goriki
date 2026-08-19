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

export const ADMIN_EMAILS: string[] = []

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
