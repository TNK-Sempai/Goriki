/**
 * Tests des règles d'annonce chiffrée : `node --test lib/annonces.test.ts`.
 *
 * Lanceur intégré de Node 24, qui lit le TypeScript sans transpilation. Le
 * module testé est PUR : il ne touche ni la base ni le réseau, ce qui permet de
 * couvrir les bascules exactes plutôt que de les supposer.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { estChiffre, estVendable, doitRepasserEnVente } from './annonces.ts'

describe('estChiffre', () => {
  test('un prix strictement positif est un prix', () => {
    assert.equal(estChiffre(0.01), true)
    assert.equal(estChiffre(2.5), true)
    assert.equal(estChiffre(9999), true)
  })

  test('zéro est une absence de prix, pas une gratuité', () => {
    assert.equal(estChiffre(0), false)
  })

  test('un prix négatif ne vaut pas mieux que zéro', () => {
    assert.equal(estChiffre(-1), false)
  })

  test('null, undefined et NaN sont des absences de prix', () => {
    assert.equal(estChiffre(null), false)
    assert.equal(estChiffre(undefined), false)
    assert.equal(estChiffre(Number.NaN), false)
    assert.equal(estChiffre(Number.POSITIVE_INFINITY), false)
  })
})

describe('estVendable', () => {
  test('visible, en stock et chiffrée', () => {
    assert.equal(estVendable({ price: 2.5, quantity: 1, is_active: true }), true)
  })

  test('chacune des trois conditions suffit à refuser', () => {
    assert.equal(estVendable({ price: 2.5, quantity: 1, is_active: false }), false)
    assert.equal(estVendable({ price: 2.5, quantity: 0, is_active: true }), false)
    assert.equal(estVendable({ price: 0, quantity: 1, is_active: true }), false)
  })

  test('le cas réel des 108 annonces Pokémon en ligne à 0 € avec du stock', () => {
    assert.equal(estVendable({ price: 0, quantity: 3, is_active: true }), false)
  })

  test('champ absent d’un select : refus, jamais une vente au hasard', () => {
    assert.equal(estVendable({ price: undefined, quantity: 1, is_active: true }), false)
    assert.equal(estVendable({ price: 2.5, quantity: undefined, is_active: true }), false)
    assert.equal(estVendable({ price: 2.5, quantity: 1, is_active: undefined }), false)
  })
})

describe('doitRepasserEnVente', () => {
  /** L'état des 937 annonces One Piece injectées : masquées, à zéro, en stock. */
  const EN_ATTENTE_DE_PRIX = { price: 0, quantity: 2, is_active: false }

  test('le cas nominal : on chiffre une annonce masquée faute de prix', () => {
    assert.equal(doitRepasserEnVente(EN_ATTENTE_DE_PRIX, { price: 2.5, quantity: 2 }), true)
  })

  test('un prix toujours à zéro ne remet rien en vente', () => {
    assert.equal(doitRepasserEnVente(EN_ATTENTE_DE_PRIX, { price: 0, quantity: 2 }), false)
  })

  test('une annonce masquée AVEC un prix l’est pour une autre raison : intouchable', () => {
    assert.equal(
      doitRepasserEnVente({ price: 4, quantity: 2, is_active: false }, { price: 6, quantity: 2 }),
      false,
    )
  })

  test('sans stock avant, il n’y a rien à mettre en vente', () => {
    assert.equal(
      doitRepasserEnVente({ price: 0, quantity: 0, is_active: false }, { price: 2.5, quantity: 0 }),
      false,
    )
  })

  test('la même sauvegarde qui vide le stock ne met pas en vente', () => {
    assert.equal(doitRepasserEnVente(EN_ATTENTE_DE_PRIX, { price: 2.5, quantity: 0 }), false)
  })

  test('une annonce déjà en vente n’est pas concernée', () => {
    assert.equal(
      doitRepasserEnVente({ price: 0, quantity: 2, is_active: true }, { price: 2.5, quantity: 2 }),
      false,
    )
  })

  test('un centime suffit : la bascule est à zéro, pas à un seuil inventé', () => {
    assert.equal(doitRepasserEnVente(EN_ATTENTE_DE_PRIX, { price: 0.01, quantity: 2 }), true)
  })
})
