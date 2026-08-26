import Link from 'next/link'
import { Download } from 'lucide-react'

const IMPORT_SOURCES = [
  {
    href: '/admin/import/pokemon',
    label: 'Pokémon TCG',
    description: 'Import via TCGdex API — sets FR officiels',
  },
  {
    href: '/admin/import/onepiece',
    label: 'One Piece TCG',
    description: 'Import via Poneglyphe — sets FR, cartes Standard',
  },
]

export default function ImportPage() {
  return (
    <div className="gk-corps">
      <div className="gk-entete-ecran">
        <div>
          <div className="gk-titre">Import inventaire</div>
          <div className="gk-eyebrow-texte">Importer les cartes depuis les APIs officielles</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', maxWidth: '560px' }}>
        {IMPORT_SOURCES.map((source) => (
          <Link
            key={source.href}
            href={source.href}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              background: 'var(--surface-1)',
              border: '1px solid rgba(212,144,12,0.08)',
              borderRadius: '3px',
              padding: '14px',
              textDecoration: 'none',
            }}
          >
            <Download size={16} style={{ color: 'var(--amber)', marginTop: '1px', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '12px', color: 'var(--cream)', fontWeight: 500 }}>{source.label}</div>
              <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '3px' }}>{source.description}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
