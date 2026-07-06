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
