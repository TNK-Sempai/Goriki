/**
 * Tests du calcul de livraison — `node --test lib/livraison/calcul.test.ts`.
 *
 * Exécutés par le lanceur intégré de Node 24, qui lit le TypeScript sans
 * transpilation : aucune dépendance de test n'a été ajoutée au projet pour ça.
 *
 * Le cœur testé est PUR — pas de base, pas de réseau. C'est ce qui permet de
 * couvrir les bascules exactes (24,99 € contre 25,00 €) plutôt que de les
 * supposer.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  calculerOptionsLivraison,
  optionEligible,
  type LignePanier,
  type ReglagesLivraison,
  type TarifLivraison,
} from './calcul.ts'

const REGLAGES: ReglagesLivraison = {
  forfait: 1.0,
  minimumCommande: 1.0,
  valeurMaxLettre: 25.0,
  poidsMaxLettreG: 100,
  poidsCarteG: 11,
  poidsEnveloppeG: 12,
}

/** Reprise de la grille réelle posée par la migration 0055. */
const t = (
  code: string, label: string, carrier: 'bpost' | 'mondial_relay',
  kind: 'letter' | 'service_point' | 'home', country: string,
  maxWeightG: number, price: number,
): TarifLivraison => ({
  id: code, code, label, carrier, kind, country, maxWeightG, price,
  sendcloudMethodCode: kind === 'letter' ? null : `methode:${code}`,
  needsServicePoint: kind === 'service_point',
  tracked: kind !== 'letter',
})

const GRILLE: TarifLivraison[] = [
  t('letter_be', 'Lettre simple bpost', 'bpost', 'letter', 'BE', 100, 3.26),
  t('letter_fr', 'Lettre simple bpost', 'bpost', 'letter', 'FR', 100, 3.3),
  t('letter_de', 'Lettre simple bpost', 'bpost', 'letter', 'DE', 100, 3.3),
  t('mr_sp_be', 'Mondial Relay point relais', 'mondial_relay', 'service_point', 'BE', 250, 3.89),
  t('mr_sp_fr', 'Mondial Relay point relais', 'mondial_relay', 'service_point', 'FR', 250, 9.04),
  t('bp_sp_be', 'bpost point relais', 'bpost', 'service_point', 'BE', 10000, 5.44),
  t('bp_sp_fr', 'bpost point relais', 'bpost', 'service_point', 'FR', 2000, 9.35),
  t('bp_home_be', 'bpost à domicile', 'bpost', 'home', 'BE', 10000, 6.19),
  t('bp_home_fr_light', 'bpost à domicile', 'bpost', 'home', 'FR', 200, 7.68),
  t('bp_home_fr_heavy', 'bpost à domicile', 'bpost', 'home', 'FR', 2000, 15.94),
  t('bp_home_de_light', 'bpost à domicile', 'bpost', 'home', 'DE', 200, 7.74),
  t('bp_home_de_heavy', 'bpost à domicile', 'bpost', 'home', 'DE', 2000, 12.2),
]

/** `n` cartes à `prix` l'unité. */
const cartes = (n: number, prix: number): LignePanier[] => [
  { libelle: `${n} carte(s)`, quantite: n, prixUnitaire: prix, nature: 'carte' },
]

const codes = (lignes: LignePanier[], pays: string) =>
  calculerOptionsLivraison(lignes, pays, REGLAGES, GRILLE).options.map(o => o.code)

/** Même chose, sur une grille fournie — pour les cas qui ne sont pas dans GRILLE. */
const codesDe = (lignes: LignePanier[], pays: string, grille: TarifLivraison[]) =>
  calculerOptionsLivraison(lignes, pays, REGLAGES, grille).options.map(o => o.code)

describe('seuil de valeur de la lettre simple', () => {
  test('24,99 € : la lettre est proposée', () => {
    // 1 carte à 24,99 € → 11 + 12 = 23 g, sous les deux plafonds.
    const devis = calculerOptionsLivraison(cartes(1, 24.99), 'BE', REGLAGES, GRILLE)
    assert.equal(devis.ok, true)
    assert.equal(devis.valeurArticles, 24.99)
    assert.ok(devis.options.some(o => o.kind === 'letter'), 'la lettre devrait être proposée')
  })

  test('25,00 € pile : la lettre disparaît', () => {
    // Le seuil est STRICT : « strictement inférieure à 25,00 € ».
    const devis = calculerOptionsLivraison(cartes(1, 25.0), 'BE', REGLAGES, GRILLE)
    assert.equal(devis.ok, true)
    assert.equal(devis.valeurArticles, 25.0)
    assert.ok(!devis.options.some(o => o.kind === 'letter'), 'la lettre ne devrait plus être proposée')
    assert.deepEqual(codes(cartes(1, 25.0), 'BE'), ['mr_sp_be', 'bp_sp_be', 'bp_home_be'])
  })

  test('le seuil porte sur le TOTAL, pas sur le prix unitaire', () => {
    // 3 × 9 € = 27 € : chaque carte est sous 25 €, le panier ne l'est pas.
    const trois: LignePanier[] = [{ libelle: '3 cartes', quantite: 3, prixUnitaire: 9.0, nature: 'carte' }]
    assert.ok(!codes(trois, 'BE').includes('letter_be'))
  })
})

describe('seuil de poids de la lettre simple', () => {
  test('100 g pile : la lettre passe encore', () => {
    // 8 cartes × 11 g + 12 g = 100 g.
    const devis = calculerOptionsLivraison(cartes(8, 1.0), 'BE', REGLAGES, GRILLE)
    assert.equal(devis.poidsTotalG, 100)
    assert.ok(devis.options.some(o => o.code === 'letter_be'))
  })

  test('101 g : la lettre est exclue, le reste demeure', () => {
    // 9 cartes × 11 g + 12 g = 111 g.
    const devis = calculerOptionsLivraison(cartes(9, 1.0), 'BE', REGLAGES, GRILLE)
    assert.equal(devis.poidsTotalG, 111)
    assert.ok(!devis.options.some(o => o.kind === 'letter'))
    assert.ok(devis.options.length > 0, 'les options suivies restent disponibles')
  })
})

describe('plafonds de poids des transporteurs', () => {
  test('Mondial Relay disparaît au-delà de 250 g', () => {
    // 22 cartes = 242 + 12 = 254 g.
    const devis = calculerOptionsLivraison(cartes(22, 1.0), 'BE', REGLAGES, GRILLE)
    assert.equal(devis.poidsTotalG, 254)
    assert.ok(!devis.options.some(o => o.carrier === 'mondial_relay'))
    // 21 cartes = 231 + 12 = 243 g : encore dedans.
    assert.ok(codes(cartes(21, 1.0), 'BE').includes('mr_sp_be'))
  })

  test('FR : la bascule domicile 200 g change de ligne et de prix', () => {
    // 17 cartes = 187 + 12 = 199 g → la ligne légère à 7,68 €.
    const leger = calculerOptionsLivraison(cartes(17, 1.0), 'FR', REGLAGES, GRILLE)
    assert.equal(leger.poidsTotalG, 199)
    const domicileLeger = leger.options.find(o => o.kind === 'home')
    assert.equal(domicileLeger?.code, 'bp_home_fr_light')
    assert.equal(domicileLeger?.prixPort, 7.68)

    // 18 cartes = 198 + 12 = 210 g → seule la ligne lourde couvre encore.
    const lourd = calculerOptionsLivraison(cartes(18, 1.0), 'FR', REGLAGES, GRILLE)
    assert.equal(lourd.poidsTotalG, 210)
    const domicileLourd = lourd.options.find(o => o.kind === 'home')
    assert.equal(domicileLourd?.code, 'bp_home_fr_heavy')
    assert.equal(domicileLourd?.prixPort, 15.94)
  })

  test('une seule ligne par transporteur et par nature', () => {
    // À 199 g en FR, les deux lignes « domicile » sont éligibles : une seule sort.
    const devis = calculerOptionsLivraison(cartes(17, 1.0), 'FR', REGLAGES, GRILLE)
    const domicile = devis.options.filter(o => o.carrier === 'bpost' && o.kind === 'home')
    assert.equal(domicile.length, 1)
  })
})

describe('couverture par pays', () => {
  test("l'Allemagne n'a aucun Mondial Relay", () => {
    const devis = calculerOptionsLivraison(cartes(1, 5.0), 'DE', REGLAGES, GRILLE)
    assert.equal(devis.ok, true)
    assert.ok(!devis.options.some(o => o.carrier === 'mondial_relay'))
    assert.deepEqual(codes(cartes(1, 5.0), 'DE'), ['letter_de', 'bp_home_de_light'])
  })

  test('un pays non livré est refusé', () => {
    const devis = calculerOptionsLivraison(cartes(1, 5.0), 'ES', REGLAGES, GRILLE)
    assert.equal(devis.ok, false)
    assert.equal(devis.options.length, 0)
    assert.match(devis.message ?? '', /ne livrons pas/)
  })
})

describe('scellé non pesé', () => {
  const scelleSansPoids: LignePanier[] = [
    { libelle: 'Display Écarlate & Violet', quantite: 1, prixUnitaire: 120, nature: 'scelle', poidsUnitaireG: null },
  ]

  test('aucune option, et un message qui nomme le produit', () => {
    const devis = calculerOptionsLivraison(scelleSansPoids, 'BE', REGLAGES, GRILLE)
    assert.equal(devis.ok, false)
    assert.equal(devis.options.length, 0)
    assert.match(devis.message ?? '', /Display Écarlate & Violet/)
    assert.match(devis.message ?? '', /pesé/)
  })

  test('un seul scellé non pesé bloque tout le panier', () => {
    const melange: LignePanier[] = [...cartes(2, 3.0), ...scelleSansPoids]
    assert.equal(calculerOptionsLivraison(melange, 'BE', REGLAGES, GRILLE).ok, false)
  })

  test('une fois pesé, le calcul reprend et compte le poids', () => {
    const pese: LignePanier[] = [
      { libelle: 'Display', quantite: 1, prixUnitaire: 120, nature: 'scelle', poidsUnitaireG: 400 },
    ]
    const devis = calculerOptionsLivraison(pese, 'BE', REGLAGES, GRILLE)
    assert.equal(devis.ok, true)
    assert.equal(devis.poidsTotalG, 412)
    // 412 g : trop lourd pour Mondial Relay (250 g), trop cher pour la lettre.
    assert.deepEqual(devis.options.map(o => o.code), ['bp_sp_be', 'bp_home_be'])
  })
})

describe('forfait et arithmétique', () => {
  test('le forfait s’ajoute au port, sans dérive de virgule flottante', () => {
    const devis = calculerOptionsLivraison(cartes(1, 5.0), 'BE', REGLAGES, GRILLE)
    const lettre = devis.options.find(o => o.code === 'letter_be')
    assert.equal(lettre?.prixPort, 3.26)
    assert.equal(lettre?.forfait, 1.0)
    // 3.26 + 1 en flottant nu rend 4.260000000000001.
    assert.equal(lettre?.totalLivraison, 4.26)
  })

  test('le forfait est identique sur toutes les options', () => {
    const devis = calculerOptionsLivraison(cartes(1, 5.0), 'BE', REGLAGES, GRILLE)
    assert.ok(devis.options.every(o => o.forfait === 1.0))
  })

  test('les options sont triées du moins cher au plus cher', () => {
    const devis = calculerOptionsLivraison(cartes(1, 5.0), 'BE', REGLAGES, GRILLE)
    const totaux = devis.options.map(o => o.totalLivraison)
    assert.deepEqual(totaux, [...totaux].sort((a, b) => a - b))
  })
})

describe('garde-fou de la mission 2', () => {
  test('un code proposé est reconnu', () => {
    const devis = calculerOptionsLivraison(cartes(1, 5.0), 'BE', REGLAGES, GRILLE)
    assert.equal(optionEligible(devis, 'letter_be')?.prixPort, 3.26)
  })

  test('la lettre forcée sur un panier à 30 € est refusée', () => {
    // C’est exactement la requête forgée que la mission 2 doit repousser.
    const devis = calculerOptionsLivraison(cartes(1, 30.0), 'BE', REGLAGES, GRILLE)
    assert.equal(devis.ok, true)
    assert.equal(optionEligible(devis, 'letter_be'), null)
  })

  test('aucun code n’est éligible sur un devis en échec', () => {
    const devis = calculerOptionsLivraison([], 'BE', REGLAGES, GRILLE)
    assert.equal(optionEligible(devis, 'letter_be'), null)
  })
})

describe('format boîte aux lettres et produits scellés', () => {
  // Grille NL complète : les deux lignes « domicile » partagent le plafond de
  // 2 000 g, seule la boîte aux lettres est moins chère.
  const NL: TarifLivraison[] = [
    t('letter_nl', 'Lettre simple bpost', 'bpost', 'letter', 'NL', 100, 3.3),
    t('mr_sp_nl', 'Mondial Relay point relais', 'mondial_relay', 'service_point', 'NL', 250, 3.88),
    t('bp_sp_nl', 'bpost point relais', 'bpost', 'service_point', 'NL', 2000, 8.44),
    t('bp_home_nl_box', 'bpost boîte aux lettres', 'bpost', 'home', 'NL', 2000, 6.7),
    t('bp_home_nl_heavy', 'bpost à domicile', 'bpost', 'home', 'NL', 2000, 11.25),
  ]

  test('sans scellé, la boîte aux lettres gagne le domicile', () => {
    const devis = calculerOptionsLivraison(cartes(20, 1.0), 'NL', REGLAGES, NL)
    const domicile = devis.options.find(o => o.kind === 'home')
    assert.equal(domicile?.code, 'bp_home_nl_box')
    assert.equal(domicile?.prixPort, 6.7)
  })

  test('avec un scellé, la boîte aux lettres disparaît', () => {
    // 900 g : au-dessus de Mondial Relay, en dessous des 2 kg bpost.
    const avecScelle: LignePanier[] = [
      { libelle: 'Display', quantite: 1, prixUnitaire: 110, nature: 'scelle', poidsUnitaireG: 900 },
    ]
    const devis = calculerOptionsLivraison(avecScelle, 'NL', REGLAGES, NL)
    assert.equal(devis.ok, true)
    assert.ok(!devis.options.some(o => o.code === 'bp_home_nl_box'), 'format boîte aux lettres exclu')
    // Et c'est ce qui rend enfin atteignable la ligne « lourde ».
    assert.equal(devis.options.find(o => o.kind === 'home')?.code, 'bp_home_nl_heavy')
  })

  test('un scellé mêlé à des cartes suffit à l’exclure', () => {
    const melange: LignePanier[] = [
      ...cartes(3, 2.0),
      { libelle: 'Coffret', quantite: 1, prixUnitaire: 40, nature: 'scelle', poidsUnitaireG: 300 },
    ]
    assert.ok(!codesDe(melange, 'NL', NL).includes('bp_home_nl_box'))
  })

  test('les autres pays ne sont pas touchés', () => {
    // La règle ne vise que les formats listés, pas « tout scellé perd le domicile ».
    const avecScelle: LignePanier[] = [
      { libelle: 'Coffret', quantite: 1, prixUnitaire: 40, nature: 'scelle', poidsUnitaireG: 300 },
    ]
    assert.ok(codes(avecScelle, 'BE').includes('bp_home_be'))
  })
})

describe('minimum de commande', () => {
  test('sous le minimum : les options restent calculées, mais le drapeau tombe', () => {
    // 0,90 € : on montre ce que coûterait la livraison, on refuse le paiement.
    const devis = calculerOptionsLivraison(cartes(1, 0.9), 'BE', REGLAGES, GRILLE)
    assert.equal(devis.ok, true)
    assert.equal(devis.minimumCommande, 1.0)
    assert.equal(devis.minimumAtteint, false)
    assert.ok(devis.options.length > 0, 'les options restent visibles')
  })

  test('1,00 € pile : atteint', () => {
    // Le seuil est inclusif, contrairement à celui de la lettre.
    const devis = calculerOptionsLivraison(cartes(1, 1.0), 'BE', REGLAGES, GRILLE)
    assert.equal(devis.minimumAtteint, true)
  })

  test('0,99 € : pas atteint', () => {
    assert.equal(calculerOptionsLivraison(cartes(1, 0.99), 'BE', REGLAGES, GRILLE).minimumAtteint, false)
  })

  test('le minimum porte sur les ARTICLES, pas sur le total avec le port', () => {
    // 0,90 € d'articles + 3,26 € de port = 4,16 € encaissés, et pourtant refusé.
    const devis = calculerOptionsLivraison(cartes(1, 0.9), 'BE', REGLAGES, GRILLE)
    assert.equal(devis.minimumAtteint, false)
    assert.ok(devis.options.some(o => o.totalLivraison > 1))
  })

  test('un minimum à zéro laisse tout passer', () => {
    const sansMinimum = { ...REGLAGES, minimumCommande: 0 }
    assert.equal(calculerOptionsLivraison(cartes(1, 0.01), 'BE', sansMinimum, GRILLE).minimumAtteint, true)
  })
})

describe('forfait à zéro', () => {
  const sansForfait = { ...REGLAGES, forfait: 0 }

  test('le total de livraison se réduit au port', () => {
    const devis = calculerOptionsLivraison(cartes(1, 5.0), 'BE', sansForfait, GRILLE)
    const lettre = devis.options.find(o => o.code === 'letter_be')
    assert.equal(lettre?.forfait, 0)
    assert.equal(lettre?.totalLivraison, lettre?.prixPort)
    assert.equal(devis.forfait, 0)
  })

  test('le tri par total reste juste sans forfait', () => {
    const devis = calculerOptionsLivraison(cartes(1, 5.0), 'BE', sansForfait, GRILLE)
    const totaux = devis.options.map(o => o.totalLivraison)
    assert.deepEqual(totaux, [...totaux].sort((a, b) => a - b))
  })
})

describe('panier vide', () => {
  test('refusé avec un message, pas une liste vide silencieuse', () => {
    const devis = calculerOptionsLivraison([], 'BE', REGLAGES, GRILLE)
    assert.equal(devis.ok, false)
    assert.match(devis.message ?? '', /vide/)
  })
})
