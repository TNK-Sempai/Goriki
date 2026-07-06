'use client'

import { useState } from 'react'
import { useCart, openCartDrawer } from '@/hooks/useCart'

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

  const isSoldOut = maxQuantity <= 0
  const isDisabled = isSoldOut || loading || unavailable

  let label = 'Ajouter au panier'
  if (isSoldOut) label = 'Épuisé'
  else if (loading) label = 'Ajout…'

  return (
    <div style={{ flex: 1 }}>
      <button
        onClick={handleAdd}
        disabled={isDisabled}
        style={{
          width: '100%',
          fontSize: '11px',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          color: 'var(--bg)',
          background: 'var(--cream)',
          border: 'none',
          padding: '12px 24px',
          borderRadius: '2px',
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
        }}
      >
        {label}
      </button>
      {error && (
        <span style={{ fontSize: '11px', color: 'var(--danger, #b91c1c)', display: 'block', marginTop: '6px' }}>
          {error}
        </span>
      )}
    </div>
  )
}
