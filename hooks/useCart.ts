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
  }, [])

  const sync = useCallback((next: CartItem[]) => {
    writeCart(next)
    setItems(next)
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
