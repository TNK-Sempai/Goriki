'use client'

import { useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import CartDrawer from './CartDrawer'

export default function CartTrigger() {
  const [open, setOpen] = useState(false)
  const { count } = useCart()

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative p-2 rounded text-muted hover:text-cream hover:bg-surface-2 transition-colors"
        aria-label="Ouvrir le panier"
      >
        <ShoppingCart size={18} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber text-bg text-[10px] font-bold flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      <CartDrawer open={open} onClose={() => setOpen(false)} />
    </>
  )
}
