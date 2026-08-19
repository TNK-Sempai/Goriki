'use client'

import { useEffect } from 'react'
import { useCart } from '@/hooks/useCart'

/**
 * Vide le panier à l'arrivée sur la page de confirmation.
 *
 * Sans ça, le panier survit au paiement : le client peut relancer un checkout
 * sur des articles déjà vendus, ce qui reposerait une réservation de stock
 * sur du stock qui n'existe plus.
 */
export default function CartCleaner() {
  const { clearCart } = useCart()

  useEffect(() => {
    clearCart()
  }, [clearCart])

  return null
}
