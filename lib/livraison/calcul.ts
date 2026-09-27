/**
 * Calcul des options de livraison — CŒUR PUR.
 *
 * ─── POURQUOI CE FICHIER NE TOUCHE PAS À LA BASE ──────────────────────────
 * La règle métier (qui a droit à la lettre, quel tarif l'emporte, quel poids
 * fait basculer d'une ligne à l'autre) est ce qui doit être vérifiable ligne à
 * ligne. Mêlée aux requêtes, elle ne se teste qu'en semant des données ; isolée
 * ici, elle se teste en une milliseconde et sans base. `devis.ts` s'occupe de
 * lire les prix et les poids, et n'a plus aucune décision à prendre.
 *
 * ─── TOUT EST CALCULÉ EN CENTIMES ─────────────────────────────────────────
 * 3,26 € et 1,00 € ne sont pas représentables exactement en binaire : leur
 * somme rend 4,260000000000001. Sur un montant facturé, c'est une erreur, pas
 * une approximation. Les euros n'apparaissent qu'en sortie, arrondis une fois.
 */

export type Transporteur = 'bpost' | 'mondial_relay'
export type NatureEnvoi = 'letter' | 'service_point' | 'home'
export type PaysLivre = 'BE' | 'FR' | 'LU' | 'NL' | 'DE'

export const PAYS_LIVRES: readonly PaysLivre[] = ['BE', 'FR', 'LU', 'NL', 'DE'] as const

/** Libellé imposé du forfait. Jamais « frais bancaires » ni « frais Stripe ». */
export const LIBELLE_FORFAIT = "Frais de préparation et d'emballage"

/**
 * Tarifs au format BOÎTE AUX LETTRES : le colis doit passer par la fente.
 *
 * ⚠️ Exclusion par CODE, et c'est un pis-aller assumé. La vraie contrainte est
 * une épaisseur maximale (38 × 26 × 3 cm pour `bp_home_nl_box`), or le modèle ne
 * porte aucune dimension : ni les scellés, ni les tarifs. Un display de boosters
 * ne passe pas 3 cm, donc dès qu'un scellé est au panier, ces lignes sortent.
 *
 * Ce qui ferait disparaître cette liste : des dimensions sur `sealed_products` et
 * un encombrement maximal sur `shipping_rates`. Tant qu'elles n'existent pas,
 * mieux vaut une règle grossière et écrite qu'un colis refusé au guichet.
 */
export const TARIFS_BOITE_AUX_LETTRES: readonly string[] = ['bp_home_nl_box'] as const

export interface ReglagesLivraison {
  /** Forfait fixe par commande, en euros. `0` = pas de forfait, et rien ne s'affiche. */
  forfait: number
  /**
   * Minimum sur la VALEUR DES ARTICLES, hors port et hors forfait. `0` le désactive.
   *
   * Il vit dans les réglages de livraison sans être une règle de livraison : le
   * devis est le seul endroit qui lise déjà le panier valorisé ET les réglages.
   * L'y calculer évite une seconde lecture qui pourrait diverger.
   */
  minimumCommande: number
  /** La lettre n'est proposée qu'en DESSOUS de cette valeur d'articles. */
  valeurMaxLettre: number
  /** …et jusqu'à ce poids inclus. */
  poidsMaxLettreG: number
  /** Poids d'une carte. Les cartes n'ont pas de poids propre en base. */
  poidsCarteG: number
  /** Tare : enveloppe, protection, calage. Ajoutée une fois par commande. */
  poidsEnveloppeG: number
}

export interface TarifLivraison {
  id: string
  code: string
  label: string
  carrier: Transporteur
  kind: NatureEnvoi
  country: string
  maxWeightG: number
  /** Prix du PORT seul, en euros. Le forfait s'y ajoute ensuite. */
  price: number
  sendcloudMethodCode: string | null
  needsServicePoint: boolean
  tracked: boolean
}

export interface LignePanier {
  libelle: string
  quantite: number
  /** Prix unitaire en euros, LU EN BASE — jamais celui envoyé par le client. */
  prixUnitaire: number
  nature: 'carte' | 'scelle'
  /**
   * Poids unitaire d'un scellé, en grammes. `null` = non pesé, ce qui BLOQUE
   * le devis. Ignoré pour une carte, qui prend `poidsCarteG`.
   */
  poidsUnitaireG?: number | null
}

export interface OptionLivraison {
  tarifId: string
  code: string
  label: string
  carrier: Transporteur
  kind: NatureEnvoi
  needsServicePoint: boolean
  tracked: boolean
  sendcloudMethodCode: string | null
  /** Port seul. */
  prixPort: number
  /** Forfait de préparation, identique sur toutes les options. */
  forfait: number
  /** Port + forfait — le seul montant à afficher comme « total livraison ». */
  totalLivraison: number
}

export interface DevisLivraison {
  ok: boolean
  poidsTotalG: number
  valeurArticles: number
  forfait: number
  /** Recopié des réglages pour que l'écran affiche le montant exact attendu. */
  minimumCommande: number
  /** Faux = le paiement doit être refusé, ici comme sur le serveur. */
  minimumAtteint: boolean
  options: OptionLivraison[]
  /** Renseigné UNIQUEMENT quand `ok` est faux : dit pourquoi, en clair. */
  message?: string
}

const cts = (euros: number) => Math.round(euros * 100)
const eur = (centimes: number) => centimes / 100

/**
 * Options de livraison pour un panier et un pays.
 *
 * Ne reçoit que des tarifs déjà restreints au pays voulu et déjà actifs ;
 * refiltre quand même, parce qu'une fonction qui suppose son entrée propre
 * finit par recevoir une entrée sale.
 */
export function calculerOptionsLivraison(
  lignes: LignePanier[],
  pays: string,
  reglages: ReglagesLivraison,
  tarifs: TarifLivraison[],
): DevisLivraison {
  const forfait = eur(cts(reglages.forfait))

  const minimumCommande = eur(cts(reglages.minimumCommande ?? 0))
  const vide: DevisLivraison = {
    ok: false, poidsTotalG: 0, valeurArticles: 0, forfait,
    minimumCommande, minimumAtteint: false, options: [],
  }

  if (lignes.length === 0) {
    return { ...vide, message: 'Panier vide : aucune livraison à calculer.' }
  }
  if (!PAYS_LIVRES.includes(pays as PaysLivre)) {
    return { ...vide, message: `Nous ne livrons pas en « ${pays} ».` }
  }

  // ── Un scellé non pesé arrête tout ────────────────────────────────────────
  // Le tenter à 0 g sous-estimerait le port, et l'erreur ne se verrait qu'à
  // l'affranchissement — une fois la commande encaissée.
  const nonPeses = lignes.filter(l => l.nature === 'scelle' && (l.poidsUnitaireG ?? null) === null)
  if (nonPeses.length > 0) {
    const noms = nonPeses.map(l => l.libelle).join(', ')
    return {
      ...vide,
      message: `Poids inconnu pour : ${noms}. La livraison ne peut pas être calculée tant que ce produit n'a pas été pesé.`,
    }
  }

  const valeurArticles = eur(
    lignes.reduce((s, l) => s + cts(l.prixUnitaire) * l.quantite, 0),
  )

  const poidsTotalG =
    lignes.reduce((s, l) => {
      const unitaire = l.nature === 'carte' ? reglages.poidsCarteG : (l.poidsUnitaireG as number)
      return s + unitaire * l.quantite
    }, 0) + reglages.poidsEnveloppeG

  // ── Éligibilité ───────────────────────────────────────────────────────────
  // La lettre est la seule option non suivie : ses deux plafonds sont une
  // limite de RISQUE, pas une contrainte technique. D'où le `<` strict sur la
  // valeur (25,00 € est déjà trop) et le `<=` sur le poids (100 g passe).
  const lettreAutorisee =
    valeurArticles < reglages.valeurMaxLettre && poidsTotalG <= reglages.poidsMaxLettreG

  // Un scellé est épais : les formats « boîte aux lettres » ne l'accueillent pas,
  // et la lettre simple encore moins. Voir TARIFS_BOITE_AUX_LETTRES.
  const contientScelle = lignes.some(l => l.nature === 'scelle')

  const eligibles = tarifs.filter(t =>
    t.country === pays &&
    t.maxWeightG >= poidsTotalG &&
    (t.kind !== 'letter' || lettreAutorisee) &&
    !(contientScelle && TARIFS_BOITE_AUX_LETTRES.includes(t.code)),
  )

  if (eligibles.length === 0) {
    return {
      ...vide,
      poidsTotalG,
      valeurArticles,
      minimumAtteint: cts(valeurArticles) >= cts(minimumCommande),
      message: `Aucun mode de livraison ne convient pour ${poidsTotalG} g vers ${pays}. Contactez-nous pour un envoi sur mesure.`,
    }
  }

  // ── Une seule ligne par couple (transporteur, nature) : la moins chère ────
  // Plusieurs lignes du même transporteur couvrent des tranches de poids qui se
  // chevauchent. Les montrer toutes offrirait au client « bpost à domicile »
  // deux fois, à deux prix, pour le même service.
  const meilleures = new Map<string, TarifLivraison>()
  for (const t of eligibles) {
    const cle = `${t.carrier}|${t.kind}`
    const actuel = meilleures.get(cle)
    // À prix égal, la ligne au plafond de poids le plus bas gagne : c'est la
    // tranche la plus ajustée au colis.
    if (!actuel || cts(t.price) < cts(actuel.price) ||
        (cts(t.price) === cts(actuel.price) && t.maxWeightG < actuel.maxWeightG)) {
      meilleures.set(cle, t)
    }
  }

  const options: OptionLivraison[] = [...meilleures.values()]
    .map(t => ({
      tarifId: t.id,
      code: t.code,
      label: t.label,
      carrier: t.carrier,
      kind: t.kind,
      needsServicePoint: t.needsServicePoint,
      tracked: t.tracked,
      sendcloudMethodCode: t.sendcloudMethodCode,
      prixPort: eur(cts(t.price)),
      forfait,
      totalLivraison: eur(cts(t.price) + cts(reglages.forfait)),
    }))
    .sort((a, b) => a.totalLivraison - b.totalLivraison || a.label.localeCompare(b.label, 'fr'))

  // Le minimum n'empêche PAS de calculer les options : le client doit voir ce
  // que sa commande coûterait. C'est le paiement qui est bloqué, à l'écran et
  // sur le serveur.
  return {
    ok: true, poidsTotalG, valeurArticles, forfait,
    minimumCommande,
    minimumAtteint: cts(valeurArticles) >= cts(minimumCommande),
    options,
  }
}

/**
 * Une option proposée est-elle encore celle qu'on croit ?
 *
 * Sert au serveur en mission 2 : le client renvoie un `code`, jamais un prix.
 * On recalcule, puis on vérifie que ce code figure bien dans le résultat —
 * c'est ce qui empêche de commander une lettre à 30 € en forçant la requête.
 */
export function optionEligible(devis: DevisLivraison, code: string): OptionLivraison | null {
  if (!devis.ok) return null
  return devis.options.find(o => o.code === code) ?? null
}
