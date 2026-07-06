'use client'

import { useCart } from '@/hooks/useCart'
import CartItem from '@/components/cart/CartItem'
import { formatPrice } from '@/lib/utils'
import Link from 'next/link'

export default function PanierClient() {
  const { items, removeItem, updateQty, total, count, clearCart } = useCart()

  if (items.length === 0) {
    return (
      <main style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--cream)' }}>Panier vide</div>
        <Link href="/catalogue" className="btn btn-primary btn-sm">Voir le catalogue</Link>
      </main>
    )
  }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ padding: '28px 40px', maxWidth: '860px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--cream)', fontWeight: 600, marginBottom: '24px' }}>
          Panier{' '}
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)', fontWeight: 300 }}>
            {count} article{count > 1 ? 's' : ''}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '24px' }}>
          <div style={{ flex: 1 }}>
            {items.map(item => (
              <CartItem key={item.listingId} item={item} onRemove={removeItem} onUpdateQty={updateQty} />
            ))}
            <button onClick={clearCart} style={{ fontSize: '10px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', marginTop: '12px' }}>
              Vider le panier
            </button>
          </div>

          <div style={{ width: '220px', flexShrink: 0 }}>
            <div style={{ background: 'var(--surface-1)', borderRadius: '3px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Sous-total</span>
                <span style={{ fontSize: '11px', color: 'var(--cream)' }}>{formatPrice(total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Livraison</span>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>À calculer</span>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
                <span style={{ fontSize: '12px', color: 'var(--cream)', fontWeight: 500 }}>Total</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--amber)', fontWeight: 700 }}>
                  {formatPrice(total)}
                </span>
              </div>
              <Link href="/checkout" style={{ display: 'block', textAlign: 'center', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--bg)', background: 'var(--cream)', padding: '12px', borderRadius: '2px', textDecoration: 'none', fontWeight: 500 }}>
                Commander
              </Link>
              <Link href="/catalogue" style={{ display: 'block', textAlign: 'center', fontSize: '10px', color: 'var(--muted)', marginTop: '10px', textDecoration: 'none' }}>
                ← Continuer mes achats
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
