import type { SupabaseClient } from '@supabase/supabase-js'
import {
  calculerOptionsLivraison,
  type DevisLivraison,
  type LignePanier,
  type ReglagesLivraison,
  type TarifLivraison,
} from './calcul'

/**
 * Devis de livraison à partir du panier — LECTURE EN BASE.
 *
 * Ce module ne prend AUCUNE décision : il résout les prix et les poids, puis
 * passe la main à `calcul.ts`. La séparation n'est pas cosmétique — c'est elle
 * qui rend la règle testable sans base, et c'est dans les tests que les
 * bascules (24,99 € contre 25,00 €) sont réellement vérifiées.
 *
 * ⚠️ AUCUN PRIX ENVOYÉ PAR LE CLIENT N'EST LU ICI. L'appelant ne fournit que
 * des identifiants et des quantités ; le prix vient de la table. Un devis qui
 * ferait confiance au panier du navigateur se ferait dicter ses frais de port.
 */

export type NatureArticle = 'pokemon' | 'onepiece' | 'sealed'

export interface ArticlePanier {
  listingId: string
  tcg: NatureArticle
  quantity: number
}

const TABLE_PAR_TCG: Record<NatureArticle, string> = {
  pokemon: 'pokemon_listings',
  onepiece: 'onepiece_listings',
  sealed: 'sealed_products',
}

/** Réglages + grille du pays. Une seule lecture, réutilisable par l'appelant. */
export async function chargerBaremeLivraison(
  supabase: SupabaseClient,
  pays: string,
): Promise<{ reglages: ReglagesLivraison; tarifs: TarifLivraison[] } | null> {
  const [{ data: reglagesRow }, { data: tarifsRows }] = await Promise.all([
    supabase
      .from('shipping_settings')
      .select('handling_fee, letter_max_value, letter_max_weight_g, card_weight_g, envelope_weight_g, min_order_value')
      .eq('id', 1)
      .maybeSingle(),
    supabase
      .from('shipping_rates')
      .select('id, code, label, carrier, kind, country, max_weight_g, price, sendcloud_method_code, needs_service_point, tracked')
      .eq('country', pays)
      .eq('is_active', true),
  ])

  if (!reglagesRow) return null

  return {
    reglages: {
      forfait: Number(reglagesRow.handling_fee),
      minimumCommande: Number(reglagesRow.min_order_value ?? 0),
      valeurMaxLettre: Number(reglagesRow.letter_max_value),
      poidsMaxLettreG: Number(reglagesRow.letter_max_weight_g),
      poidsCarteG: Number(reglagesRow.card_weight_g),
      poidsEnveloppeG: Number(reglagesRow.envelope_weight_g),
    },
    tarifs: (tarifsRows ?? []).map(r => ({
      id: r.id as string,
      code: r.code as string,
      label: r.label as string,
      carrier: r.carrier as TarifLivraison['carrier'],
      kind: r.kind as TarifLivraison['kind'],
      country: r.country as string,
      maxWeightG: Number(r.max_weight_g),
      price: Number(r.price),
      sendcloudMethodCode: (r.sendcloud_method_code as string | null) ?? null,
      needsServicePoint: Boolean(r.needs_service_point),
      tracked: Boolean(r.tracked),
    })),
  }
}

/**
 * Traduit le panier en lignes pesées et valorisées.
 *
 * Les scellés sont lus à part des cartes : eux seuls portent un `weight_g`, et
 * eux seuls peuvent manquer de poids. Une carte n'a pas de poids propre en
 * base — c'est `card_weight_g` des réglages qui s'applique, et `calcul.ts` le
 * pose lui-même pour que la règle ne vive qu'à un seul endroit.
 */
async function lireLignes(
  supabase: SupabaseClient,
  articles: ArticlePanier[],
): Promise<{ lignes: LignePanier[] } | { erreur: string }> {
  const lignes: LignePanier[] = []

  for (const article of articles) {
    const table = TABLE_PAR_TCG[article.tcg]
    if (!table) return { erreur: `Type d'article inconnu : ${article.tcg}` }
    if (!Number.isInteger(article.quantity) || article.quantity < 1) {
      return { erreur: 'Quantité invalide dans le panier.' }
    }

    if (article.tcg === 'sealed') {
      const { data } = await supabase
        .from('sealed_products')
        .select('id, name, price, weight_g')
        .eq('id', article.listingId)
        .maybeSingle()

      if (!data) return { erreur: 'Un produit du panier n’existe plus.' }

      lignes.push({
        libelle: (data.name as string) ?? 'Produit scellé',
        quantite: article.quantity,
        prixUnitaire: Number(data.price),
        nature: 'scelle',
        // NULL conservé tel quel : c'est `calcul.ts` qui décide qu'un poids
        // manquant bloque, et qui nomme le produit fautif.
        poidsUnitaireG: data.weight_g === null ? null : Number(data.weight_g),
      })
      continue
    }

    const { data } = await supabase
      .from(table)
      .select('id, price')
      .eq('id', article.listingId)
      .maybeSingle()

    if (!data) return { erreur: 'Une carte du panier n’est plus disponible.' }

    lignes.push({
      libelle: 'Carte',
      quantite: article.quantity,
      prixUnitaire: Number(data.price),
      nature: 'carte',
    })
  }

  return { lignes }
}

/**
 * Options de livraison pour un panier et un pays.
 *
 * Rend toujours un `DevisLivraison` : un échec se lit dans `ok` et `message`,
 * jamais par une exception. L'écran doit pouvoir afficher la raison au client.
 */
export async function devisLivraisonPourPanier(
  supabase: SupabaseClient,
  articles: ArticlePanier[],
  pays: string,
): Promise<DevisLivraison> {
  const echec = (message: string): DevisLivraison => ({
    ok: false, poidsTotalG: 0, valeurArticles: 0, forfait: 0,
    minimumCommande: 0, minimumAtteint: false, options: [], message,
  })

  const bareme = await chargerBaremeLivraison(supabase, pays)
  if (!bareme) return echec('Les réglages de livraison sont introuvables.')

  const lu = await lireLignes(supabase, articles)
  if ('erreur' in lu) return echec(lu.erreur)

  return calculerOptionsLivraison(lu.lignes, pays, bareme.reglages, bareme.tarifs)
}
