'use client'

import { useState, useEffect, useCallback } from 'react'

export interface CartItem {
  listingId: string
  tcg: 'pokemon' | 'onepiece' | 'sealed'
  name: string
  variantLabel?: string
  price: number
  quantity: number
  imageUrl: string | null
  maxQuantity: number
}

const CART_KEY = 'goriki_cart'

export const CART_UPDATED_EVENT = 'goriki:cart-updated'
export const CART_OPEN_EVENT = 'goriki:cart-open'

export function openCartDrawer() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(CART_OPEN_EVENT))
}

function readCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(sessionStorage.getItem(CART_KEY) ?? '[]')
  } catch {
    return []
  }
}

function writeCart(items: CartItem[]) {
  sessionStorage.setItem(CART_KEY, JSON.stringify(items))
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([])

  useEffect(() => {
    setItems(readCart())

    function handleCartUpdated() {
      setItems(readCart())
    }

    window.addEventListener(CART_UPDATED_EVENT, handleCartUpdated)
    return () => window.removeEventListener(CART_UPDATED_EVENT, handleCartUpdated)
  }, [])

  const sync = useCallback((next: CartItem[]) => {
    writeCart(next)
    setItems(next)
    window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT))
  }, [])

  const addItem = useCallback((item: CartItem) => {
    const current = readCart()
    const existing = current.find(i => i.listingId === item.listingId)
    if (existing) {
      const newQty = Math.min(existing.quantity + item.quantity, item.maxQuantity)
      sync(current.map(i => i.listingId === item.listingId ? { ...i, quantity: newQty } : i))
    } else {
      sync([...current, item])
    }
  }, [sync])

  const removeItem = useCallback((listingId: string) => {
    sync(readCart().filter(i => i.listingId !== listingId))
  }, [sync])

  const updateQty = useCallback((listingId: string, qty: number) => {
    if (qty <= 0) { removeItem(listingId); return }
    sync(readCart().map(i => i.listingId === listingId ? { ...i, quantity: Math.min(qty, i.maxQuantity) } : i))
  }, [sync, removeItem])

  const clearCart = useCallback(() => sync([]), [sync])

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const count = items.reduce((sum, i) => sum + i.quantity, 0)

  return { items, addItem, removeItem, updateQty, clearCart, total, count }
}
