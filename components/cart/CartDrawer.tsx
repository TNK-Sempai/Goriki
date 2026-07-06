'use client'

import { X, ShoppingCart } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import CartItem from './CartItem'
import { formatPrice } from '@/lib/utils'
import Link from 'next/link'

interface CartDrawerProps {
  open: boolean
  onClose: () => void
}

export default function CartDrawer({ open, onClose }: CartDrawerProps) {
  const { items, removeItem, updateQty, total, count } = useCart()

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed right-0 top-0 h-full z-50 w-full max-w-sm bg-surface-1 border-l border-dim flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-5 border-b border-dim">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-amber" />
            <span className="font-display text-lg text-cream">Panier</span>
            {count > 0 && <span className="badge badge-amber">{count}</span>}
          </div>
          <button onClick={onClose} className="text-muted hover:text-cream transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <ShoppingCart size={36} className="text-muted mb-4" />
              <p className="text-muted">Votre panier est vide</p>
            </div>
          ) : (
            items.map(item => (
              <CartItem
                key={item.listingId}
                item={item}
                onRemove={removeItem}
                onUpdateQty={updateQty}
              />
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="p-5 border-t border-dim">
            <div className="flex items-center justify-between mb-4">
              <span className="text-muted text-sm">Total</span>
              <span className="font-display text-xl text-amber">{formatPrice(total)}</span>
            </div>
            <Link
              href="/checkout"
              onClick={onClose}
              className="btn btn-primary btn-lg w-full text-center"
            >
              Commander
            </Link>
            <Link
              href="/panier"
              onClick={onClose}
              className="btn btn-ghost btn-sm w-full mt-2 text-center"
            >
              Voir le panier
            </Link>
          </div>
        )}
      </aside>
    </>
  )
}
