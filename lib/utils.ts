import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(amount: number, currency = 'EUR'): string {
  // Filet de sécurité, pas une politique d'affichage. `Intl.NumberFormat`
  // rend « NaN € » pour `undefined` — ce qui s'est produit en production sur la
  // rangée « du même set », où la requête ne fournissait pas le champ lu. Un
  // tiret est faux-mais-inoffensif là où « NaN € » est un bug visible.
  //
  // Les tuiles de catalogue ne doivent PAS compter sur ce filet : elles ont
  // `prixDepuis` et `prixOuEpuise` ci-dessous, qui disent « Épuisé » — la
  // bonne réponse quand aucun prix n'est saisi.
  if (!Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(amount)
}

/**
 * Prix d'une pièce en vitrine, quand la vignette représente une CARTE dont
 * plusieurs exemplaires peuvent coexister à des prix différents (mission
 * « exemplaires multiples »). Le montant affiché est donc toujours le plus bas
 * disponible, et il est annoncé comme tel.
 *
 * Règle métier déjà actée et rappelée ici : **un prix à 0 est une absence de
 * prix**, pas une gratuité. Aucun prix saisi → la pièce n'est pas vendable →
 * « Épuisé ». Le terme reprend celui de la fiche produit (« Épuisé pour le
 * moment ») plutôt que d'en inventer un troisième.
 */
export function prixDepuis(prix: number | null | undefined): string {
  if (prix == null || !Number.isFinite(prix) || prix <= 0) return 'Épuisé'
  return `À partir de ${formatPrice(prix)}`
}

/**
 * Même règle, pour une vignette qui représente UNE pièce précise et pas une
 * carte à exemplaires multiples : un produit scellé, un exemplaire déjà choisi.
 * Pas de « à partir de » — il n'y a rien de moins cher derrière.
 */
export function prixOuEpuise(prix: number | null | undefined): string {
  if (prix == null || !Number.isFinite(prix) || prix <= 0) return 'Épuisé'
  return formatPrice(prix)
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
