'use client'

import { useState } from 'react'
import Link from 'next/link'

// Renommé `CatalogueSet` (et non `Set`) pour ne pas masquer le Set natif utilisé plus bas
interface CatalogueSet {
  id: string
  code: string
  name_fr: string
  image_url: string | null
  symbol_url: string | null
  card_count: number | null
  release_date: string | null
}

const GRADIENTS = [
  'linear-gradient(160deg,#3D3060,#0A0810)',
  'linear-gradient(160deg,#203848,#060A10)',
  'linear-gradient(160deg,#583C18,#100804)',
  'linear-gradient(160deg,#503820,#0C0604)',
  'linear-gradient(160deg,#402018,#0A0604)',
  'linear-gradient(160deg,#203420,#060808)',
]

function detectSerie(code: string): string {
  const c = code.toUpperCase().replace(/[\s_]/g, '')
  // ST30 est un starter "nouveauté" — testé avant la règle ST générique
  if (/^ST-?0*30$/.test(c)) return 'Nouveautés'
  const op = c.match(/^OP-?(\d+)/)
  if (op) return parseInt(op[1], 10) >= 9 ? 'Nouveautés' : 'Arcs fondateurs'
  if (/^ST-?/.test(c)) return 'Starter Decks'
  if (/^(EB|PRB)-?/.test(c)) return 'Premium Boosters'
  return 'Autres'
}

const SERIES_ORDER = [
  'Nouveautés', 'Arcs fondateurs', 'Starter Decks', 'Premium Boosters', 'Autres',
]

export default function OnePieceCatalogueClient({ sets }: { sets: CatalogueSet[] }) {
  // Ouvrir uniquement la 1ère série par défaut
  const [openSeries, setOpenSeries] = useState<Set<string>>(new Set([SERIES_ORDER[0]]))

  const series: Record<string, CatalogueSet[]> = {}
  sets.forEach(s => {
    const serie = detectSerie(s.code)
    if (!series[serie]) series[serie] = []
    series[serie].push(s)
  })

  const sortedSeries = SERIES_ORDER
    .filter(s => (series[s]?.length ?? 0) > 0)
    .map(s => ({ name: s, sets: series[s]! }))

  function toggle(name: string) {
    setOpenSeries(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div style={{ padding: '20px 40px 48px' }}>
      {sortedSeries.map(({ name, sets: serieSets }) => {
        const isOpen = openSeries.has(name)
        return (
          <div key={name} style={{ marginBottom: '6px', border: '1px solid var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
            {/* Header accordion */}
            <button
              onClick={() => toggle(name)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: isOpen ? 'var(--surface-1)' : 'var(--bg)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                transition: 'background 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--amber)' }}>
                  {name}
                </span>
                <span style={{ fontSize: '9px', color: 'var(--muted)' }}>
                  {serieSets.length} set{serieSets.length > 1 ? 's' : ''}
                </span>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--muted)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                ↓
              </span>
            </button>

            {/* Contenu accordion */}
            {isOpen && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1px', background: 'var(--border)', padding: '1px' }}>
                {serieSets.map((set, i) => (
                  <Link key={set.id} href={`/catalogue/onepiece/${set.id}`} style={{ textDecoration: 'none' }}>
                    <div className="set-tile">
                      <div style={{
                        height: '100px',
                        background: GRADIENTS[i % GRADIENTS.length],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        overflow: 'hidden',
                        padding: '8px',
                      }}>
                        {/* Symbole du set */}
                        {set.symbol_url && (
                          <img
                            src={set.symbol_url.match(/\.(png|jpg|webp|svg)$/) ? set.symbol_url : set.symbol_url + '.png'}
                            alt=""
                            style={{ height: '28px', objectFit: 'contain', opacity: 0.7 }}
                          />
                        )}
                        {/* Logo du set */}
                        {set.image_url ? (
                          <img
                            src={set.image_url}
                            alt={set.name_fr}
                            style={{ maxHeight: '56px', maxWidth: '110px', objectFit: 'contain', opacity: 0.9 }}
                          />
                        ) : (
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontStyle: 'italic', color: 'rgba(255,255,255,0.15)' }}>
                            {set.code}
                          </span>
                        )}
                      </div>
                      <div style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: '8px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--amber)', marginBottom: '3px', display: 'block' }}>
                          {set.code}
                        </span>
                        <div style={{ fontSize: '11px', color: 'var(--cream)', fontWeight: 500, lineHeight: 1.25, marginBottom: '4px' }}>
                          {set.name_fr}
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--muted)' }}>
                          {set.card_count ?? '?'} cartes
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
