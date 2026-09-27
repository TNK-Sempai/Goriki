'use client'

import { useState } from 'react'
import { useCart, openCartDrawer } from '@/hooks/useCart'
import { estChiffre } from '@/lib/annonces'

interface AddToCartButtonProps {
  listingId: string
  tcg: 'pokemon' | 'onepiece' | 'sealed'
  name: string
  variantLabel?: string
  price: number
  maxQuantity: number
  imageUrl: string | null
}

interface CartValidationResponse {
  errors: string[]
  valid: boolean
}

export default function AddToCartButton({
  listingId,
  tcg,
  name,
  variantLabel,
  price,
  maxQuantity,
  imageUrl,
}: AddToCartButtonProps) {
  const { items, addItem } = useCart()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  const qtyInCart = items.find(i => i.listingId === listingId)?.quantity ?? 0

  async function handleAdd() {
    if (qtyInCart >= maxQuantity) {
      setError(`Quantité maximale atteinte (stock : ${maxQuantity})`)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ listingId, tcg, name, price, quantity: qtyInCart + 1 }],
        }),
      })

      if (!res.ok) {
        setError('Erreur, réessayez')
        return
      }

      const data: CartValidationResponse = await res.json()

      if (!data.valid) {
        let message = data.errors[0] ?? 'Erreur, réessayez'
        if (message.includes("n'est plus disponible")) {
          setUnavailable(true)
        } else if (message.includes('a changé')) {
          message = `${message} — actualisez la page`
        }
        setError(message)
        return
      }

      addItem({ listingId, tcg, name, variantLabel, price, quantity: 1, imageUrl, maxQuantity })
      openCartDrawer()
    } catch {
      setError('Erreur, réessayez')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Épuisé couvre DEUX cas, et pas seulement l'absence de stock : une pièce non
   * chiffrée n'est pas achetable non plus.
   *
   * Sans la condition sur le prix, une annonce restée en ligne à 0 € avec du
   * stock affichait « Ajouter au panier », alors que le prix juste au-dessus
   * disait « Épuisé » : deux réponses contradictoires sur le même écran. Le
   * serveur refusait déjà l'article, mais après le clic et par un message
   * d'erreur, ce qui n'est pas la même chose que ne pas le proposer.
   */
  const isSoldOut = maxQuantity <= 0 || !estChiffre(price)
  const isDisabled = isSoldOut || loading || unavailable

  let label = 'Ajouter au panier'
  if (isSoldOut) label = 'Épuisé'
  else if (loading) label = 'Ajout…'

  return (
    <div className="w-full">
      {/* CTA principal de la fiche : ocre pleine largeur, comme la planche.
          Les styles inline d'origine (fond `--cream`, rayon 2 px) dataient de
          la DA sombre et juraient sur le parcours clair. */}
      <button
        onClick={handleAdd}
        disabled={isDisabled}
        className={`w-full px-6 py-3.5 font-mono text-[11px] uppercase tracking-[0.14em] disabled:cursor-not-allowed ${
          // Épuisé : le bouton doit se lire comme INERTE. En ocre plein, même
          // à opacité réduite, il continuait de passer pour le CTA principal —
          // alors que l'action réelle, juste en dessous, est « Je la cherche ».
          isSoldOut
            ? 'rounded-control border border-[rgba(26,22,17,0.14)] bg-[rgba(26,22,17,0.05)] text-ink-55'
            : 'btn-ochre disabled:opacity-45'
        }`}
      >
        {label}
      </button>
      {error && (
        <span className="mt-2 block text-[12px] text-[#A33B2A]">{error}</span>
      )}
    </div>
  )
}
