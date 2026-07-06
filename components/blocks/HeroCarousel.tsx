'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface CarouselSet {
  id: string
  code: string
  name_fr: string
  image_url: string | null
  tcg: 'pokemon' | 'onepiece'
}

const GRADIENTS = [
  'linear-gradient(160deg,#3D3060,#0A0810)',
  'linear-gradient(160deg,#503820,#0C0604)',
  'linear-gradient(160deg,#203848,#060A10)',
  'linear-gradient(160deg,#402018,#0A0604)',
  'linear-gradient(160deg,#203420,#060808)',
  'linear-gradient(160deg,#583C18,#100804)',
]

export default function HeroCarousel({ sets }: { sets: CarouselSet[] }) {
  const [offset, setOffset] = useState(0)
  const cardW = 150

  useEffect(() => {
    const id = setInterval(() => {
      setOffset(prev => (prev >= (sets.length - 3) * cardW ? 0 : prev + cardW))
    }, 3500)
    return () => clearInterval(id)
  }, [sets.length])

  function slide(dir: number) {
    setOffset(prev => {
      const next = prev + dir * cardW
      return Math.max(0, Math.min(next, (sets.length - 3) * cardW))
    })
  }

  return (
    <section
      style={{
        position: 'relative',
        height: '440px',
        overflow: 'hidden',
        background: 'var(--bg)',
      }}
    >
      {/* Label */}
      <div
        style={{
          position: 'absolute',
          top: '32px',
          left: '40px',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div style={{ width: '16px', height: '1px', background: 'var(--amber)' }} />
          <span style={{ fontSize: '9px', letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--amber)' }}>
            Nouveautés
          </span>
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '11px',
            fontStyle: 'italic',
            color: 'var(--muted)',
          }}
        >
          Singles & scellés · FR
        </div>
      </div>

      {/* Fade gauche */}
      <div
        style={{
          position: 'absolute',
          left: '200px',
          top: 0,
          bottom: 0,
          width: '60px',
          zIndex: 4,
          background: 'linear-gradient(to right, var(--bg), transparent)',
          pointerEvents: 'none',
        }}
      />

      {/* Carousel */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          left: '200px',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '10px',
            padding: '32px 40px 32px 0',
            transform: `translateX(-${offset}px)`,
            transition: 'transform 0.55s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          {sets.map((set, i) => (
            <Link
              key={set.id}
              href={`/catalogue/${set.tcg}/${set.id}`}
              style={{ textDecoration: 'none', flexShrink: 0 }}
            >
              <div
                style={{
                  width: '140px',
                  height: '380px',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'transform 0.25s',
                  background: GRADIENTS[i % GRADIENTS.length],
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-5px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                {set.image_url && (
                  <img
                    src={set.image_url}
                    alt={set.name_fr}
                    style={{ width: '100%', height: '60%', objectFit: 'contain', padding: '12px', opacity: 0.9 }}
                  />
                )}
                {/* Overlay */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(10,6,2,0.97) 0%, transparent 60%)',
                  }}
                />
                {/* Info */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 12px' }}>
                  <span style={{ fontSize: '7px', letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(200,134,10,0.6)', marginBottom: '3px', display: 'block' }}>
                    {set.tcg === 'pokemon' ? 'Pokémon' : 'One Piece'}
                  </span>
                  <span style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--amber)', marginBottom: '5px', display: 'block' }}>
                    {set.code}
                  </span>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: '#F0EAE0', lineHeight: 1.2, fontWeight: 600 }}>
                    {set.name_fr}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Nav */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          right: '40px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 10,
        }}
      >
        {['‹', '›'].map((arrow, i) => (
          <button
            key={arrow}
            onClick={() => slide(i === 0 ? -1 : 1)}
            style={{
              width: '26px',
              height: '26px',
              border: '1px solid rgba(200,134,10,0.2)',
              borderRadius: '50%',
              background: 'none',
              color: 'var(--amber)',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {arrow}
          </button>
        ))}
      </div>
    </section>
  )
}
