'use client'

import { useState, useEffect } from 'react'
import { Heart } from 'lucide-react'

interface WishlistButtonProps {
  itemType: 'pokemon' | 'onepiece' | 'sealed'
  itemId: string
  variantTypeId?: string | null
}

export default function WishlistButton({ itemType, itemId, variantTypeId }: WishlistButtonProps) {
  const [inWishlist, setInWishlist] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/wishlist')
      .then(r => r.json())
      .then((items: { item_id: string }[]) => {
        if (Array.isArray(items)) {
          setInWishlist(items.some(i => i.item_id === itemId))
        }
      })
  }, [itemId])

  async function toggle() {
    setLoading(true)
    const res = await fetch('/api/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_type: itemType, item_id: itemId, variant_type_id: variantTypeId }),
    })
    if (res.status === 401) {
      window.location.href = '/login'
      return
    }
    const data = await res.json()
    setInWishlist(data.action === 'added')
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-2 btn btn-outline btn-sm ${inWishlist ? 'text-red-400 border-red-400/30' : ''}`}
      aria-label={inWishlist ? 'Retirer de la wishlist' : 'Ajouter à la wishlist'}
    >
      <Heart size={14} fill={inWishlist ? 'currentColor' : 'none'} />
      {inWishlist ? 'Dans la wishlist' : 'Wishlist'}
    </button>
  )
}
