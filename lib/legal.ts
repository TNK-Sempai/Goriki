/**
 * Pages légales — source UNIQUE.
 *
 * Le pied de page, le sitemap et les quatre pages lisent ce même registre. Une
 * liste recopiée à trois endroits finit par diverger : c'est ainsi qu'un lien
 * de pied de page survit à une page renommée.
 */

/**
 * Date affichée en tête de chaque document légal.
 *
 * ⚠️ VALEUR FIGÉE, VOLONTAIREMENT. Ne JAMAIS la remplacer par `new Date()` :
 * « Dernière mise à jour » deviendrait la date du jour à chaque visite, et le
 * document prétendrait avoir été revu ce matin. Ce champ dit quand les TEXTES
 * ont changé pour la dernière fois ; il se met à jour à la main, en même temps
 * qu'eux.
 */
export const LEGAL_UPDATED_AT = '2026-09-27'

/** Marqueur laissé dans les fichiers Markdown, remplacé au rendu. */
export const MARQUEUR_DATE = '[DATE DE MISE EN LIGNE]'

export function dateLegaleFr(iso: string = LEGAL_UPDATED_AT): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

export interface PageLegale {
  /** Segment d'URL ET nom du fichier dans `content/legal`. */
  slug: string
  titre: string
  description: string
}

export const PAGES_LEGALES: readonly PageLegale[] = [
  {
    slug: 'cgv',
    titre: 'Conditions générales de vente',
    description:
      'Les conditions de vente de Goriki : commande, paiement, livraison, rétractation, garanties et réclamations.',
  },
  {
    slug: 'mentions-legales',
    titre: 'Mentions légales',
    description:
      'Éditeur, hébergement et propriété intellectuelle du site Goriki, boutique de cartes à collectionner.',
  },
  {
    slug: 'confidentialite',
    titre: 'Politique de confidentialité',
    description:
      'Quelles données Goriki traite, pourquoi, avec qui elles sont partagées, combien de temps, et quels sont vos droits.',
  },
  {
    slug: 'retractation',
    titre: 'Droit de rétractation',
    description:
      'Comment exercer votre droit de rétractation sur une commande Goriki, dans quel délai et selon quelles modalités.',
  },
] as const

export const pageLegale = (slug: string): PageLegale | undefined =>
  PAGES_LEGALES.find(p => p.slug === slug)
