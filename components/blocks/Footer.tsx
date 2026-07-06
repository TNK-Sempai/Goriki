import Link from 'next/link'

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border)',
        padding: '24px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '14px',
          color: 'var(--amber)',
          letterSpacing: '4px',
          fontWeight: 700,
        }}
      >
        GORIKI 力
      </div>
      <div style={{ display: 'flex', gap: '24px' }}>
        {[
          { href: '/catalogue/pokemon', label: 'Pokémon' },
          { href: '/catalogue/onepiece', label: 'One Piece' },
          { href: '/catalogue/scelles', label: 'Scellés' },
          { href: '/compte', label: 'Mon compte' },
        ].map(l => (
          <Link key={l.href} href={l.href} style={{ fontSize: '10px', color: 'var(--muted)', textDecoration: 'none', letterSpacing: '0.3px' }}>
            {l.label}
          </Link>
        ))}
      </div>
      <div style={{ fontSize: '9px', color: 'rgba(26,16,8,0.25)', letterSpacing: '0.3px' }}>
        © 2025 Tanuki Corporation · Bruxelles
      </div>
    </footer>
  )
}
