import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/auth/LogoutButton'
import ThemeToggle from '@/components/ui/ThemeToggle'
import CartTrigger from '@/components/cart/CartTrigger'

export default async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    isAdmin = profile?.role === 'admin'
  }

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 40px',
          height: '56px',
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '16px',
            color: 'var(--amber)',
            letterSpacing: '5px',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          GORIKI
        </Link>

        <nav style={{ display: 'flex', gap: '32px' }}>
          {[
            { href: '/catalogue/pokemon', label: 'Pokémon' },
            { href: '/catalogue/onepiece', label: 'One Piece' },
            { href: '/catalogue/scelles', label: 'Scellés' },
          ].map(item => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                fontSize: '11px',
                color: 'var(--muted)',
                textDecoration: 'none',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <CartTrigger />
          <ThemeToggle />
          {user ? (
            <>
              {isAdmin && (
                <Link
                  href="/admin"
                  style={{ fontSize: '11px', color: 'var(--amber)', textDecoration: 'none' }}
                >
                  Admin
                </Link>
              )}
              <Link
                href="/compte"
                style={{ fontSize: '11px', color: 'var(--muted)', textDecoration: 'none' }}
              >
                Mon compte
              </Link>
              <LogoutButton className="btn btn-ghost btn-sm" />
            </>
          ) : (
            <>
              <Link
                href="/login"
                style={{ fontSize: '11px', color: 'var(--muted)', textDecoration: 'none' }}
              >
                Connexion
              </Link>
              <Link
                href="/register"
                className="btn btn-primary btn-sm"
              >
                S&apos;inscrire
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
