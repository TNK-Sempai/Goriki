'use client'

import { Trash2 } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import type { CartItem as CartItemType } from '@/hooks/useCart'

interface CartItemProps {
  item: CartItemType
  onRemove: (id: string) => void
  onUpdateQty: (id: string, qty: number) => void
}

export default function CartItem({ item, onRemove, onUpdateQty }: CartItemProps) {
  return (
    <div className="flex items-center gap-4 py-4 border-b border-dim last:border-0">
      {item.imageUrl && (
        <img src={item.imageUrl} alt={item.name} className="w-14 h-20 object-cover rounded" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-cream text-sm font-medium line-clamp-1">{item.name}</p>
        {item.variantLabel && <p className="text-muted text-xs">{item.variantLabel}</p>}
        <p className="text-amber text-sm mt-1">{formatPrice(item.price)}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onUpdateQty(item.listingId, item.quantity - 1)}
          className="w-7 h-7 flex items-center justify-center rounded bg-surface-2 text-cream hover:bg-surface-1 transition-colors text-sm"
        >
          −
        </button>
        <span className="text-cream text-sm w-6 text-center">{item.quantity}</span>
        <button
          onClick={() => onUpdateQty(item.listingId, item.quantity + 1)}
          disabled={item.quantity >= item.maxQuantity}
          className="w-7 h-7 flex items-center justify-center rounded bg-surface-2 text-cream hover:bg-surface-1 transition-colors text-sm disabled:opacity-30"
        >
          +
        </button>
      </div>
      <button
        onClick={() => onRemove(item.listingId)}
        className="text-muted hover:text-red-400 transition-colors p-1"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}
