'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, BarChart2, Download, List,
  Package, ShoppingBag, Users, RefreshCw, Archive,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number }>
  exact?: boolean
  disabled?: boolean
}

interface NavSection {
  label: string
  items: NavItem[]
}

const NAV: NavSection[] = [
  {
    label: 'Principal',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { href: '/admin/stats', label: 'Statistiques', icon: BarChart2 },
    ],
  },
  {
    label: 'Inventaire',
    items: [
      { href: '/admin/import', label: 'Import', icon: Download },
      { href: '/admin/listings', label: 'Listings', icon: List },
      { href: '/admin/produits', label: 'Scellés', icon: Package },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { href: '/admin/commandes', label: 'Commandes', icon: ShoppingBag },
      { href: '/admin/clients', label: 'Clients', icon: Users },
    ],
  },
  {
    label: 'V2',
    items: [
      { href: '/admin/rachat', label: 'Rachat', icon: RefreshCw, disabled: true },
      { href: '/admin/depot-vente', label: 'Dépôt-vente', icon: Archive, disabled: true },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside style={{
      width: '200px',
      flexShrink: 0,
      background: 'var(--surface-1)',
      borderRight: '1px solid rgba(212,144,12,0.08)',
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
    }}>
      {/* Logo */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(212,144,12,0.08)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', color: 'var(--amber)', letterSpacing: '4px', fontWeight: 700 }}>
          GORIKI
        </div>
        <div style={{ fontSize: '8px', color: 'rgba(212,144,12,0.3)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '2px' }}>
          Administration
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
        {NAV.map(section => (
          <div key={section.label} style={{ marginBottom: '18px' }}>
            <span style={{
              fontSize: '7px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              color: 'rgba(238,228,204,0.18)',
              padding: '0 8px',
              marginBottom: '4px',
              display: 'block',
            }}>
              {section.label}
            </span>
            {section.items.map(item => {
              const active = isActive(item.href, item.exact)
              const disabled = item.disabled

              return disabled ? (
                <div key={item.href} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '6px 8px',
                  borderRadius: '2px',
                  fontSize: '11px',
                  color: 'rgba(238,228,204,0.18)',
                  cursor: 'not-allowed',
                }}>
                  <item.icon size={12} />
                  <span>{item.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '7px', color: 'rgba(212,144,12,0.2)' }}>V2</span>
                </div>
              ) : (
                <Link key={item.href} href={item.href} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '6px 8px',
                  borderRadius: '2px',
                  fontSize: '11px',
                  textDecoration: 'none',
                  transition: 'all 0.12s',
                  background: active ? 'rgba(212,144,12,0.1)' : 'transparent',
                  color: active ? 'var(--amber)' : 'rgba(238,228,204,0.4)',
                }}>
                  <item.icon size={12} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div style={{ padding: '10px 8px', borderTop: '1px solid rgba(212,144,12,0.08)' }}>
        <Link href="/" style={{
          fontSize: '9px',
          color: 'rgba(212,144,12,0.3)',
          textDecoration: 'none',
          padding: '4px 8px',
          display: 'block',
          marginBottom: '6px',
        }}>
          ← Voir la boutique
        </Link>
      </div>
    </aside>
  )
}
