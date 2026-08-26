'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

/**
 * Navigateur de sets — porte d'entrée de la gestion des listings.
 *
 * Remplace les deux compteurs globaux qui composaient tout `/admin/listings` :
 * on ne voyait ni quel set contenait du stock, ni où le travail restait à faire.
 *
 * Le tri par défaut met en tête les sets qui DEMANDENT une action (stock présent
 * mais prix manquants), puis ceux qui ont du stock, puis le reste. C'est la
 * question qu'on se pose en ouvrant cette page.
 */

export interface SetRow {
  universe: 'pokemon' | 'onepiece'
  set_id: string
  code: string
  name_fr: string
  serie_name: string | null
  total: number
  avec_stock: number
  sans_prix: number
  sans_photo: number
}

type Filtre = 'tous' | 'stock' | 'sans-prix' | 'sans-photo'

const FILTRES: { v: Filtre; label: string }[] = [
  { v: 'tous', label: 'Tous' },
  { v: 'stock', label: 'Avec stock' },
  { v: 'sans-prix', label: 'Prix manquants' },
  { v: 'sans-photo', label: 'Photos manquantes' },
]

export default function SetsBrowser({ sets }: { sets: SetRow[] }) {
  const [univers, setUnivers] = useState<'pokemon' | 'onepiece'>('pokemon')
  const [filtre, setFiltre] = useState<Filtre>('stock')
  const [q, setQ] = useState('')

  const lignes = useMemo(() => {
    const query = q.trim().toLowerCase()
    return sets
      .filter(s => s.universe === univers)
      .filter(s => {
        if (filtre === 'stock') return s.avec_stock > 0
        if (filtre === 'sans-prix') return s.sans_prix > 0
        if (filtre === 'sans-photo') return s.sans_photo > 0
        return true
      })
      .filter(s =>
        !query ||
        s.code.toLowerCase().includes(query) ||
        s.name_fr.toLowerCase().includes(query) ||
        (s.serie_name ?? '').toLowerCase().includes(query)
      )
      .sort((a, b) => {
        // À traiter d'abord : du stock en ligne mais pas de prix.
        const pa = a.sans_prix > 0 ? 0 : a.avec_stock > 0 ? 1 : 2
        const pb = b.sans_prix > 0 ? 0 : b.avec_stock > 0 ? 1 : 2
        if (pa !== pb) return pa - pb
        if (b.avec_stock !== a.avec_stock) return b.avec_stock - a.avec_stock
        return a.code.localeCompare(b.code)
      })
  }, [sets, univers, filtre, q])

  const totaux = useMemo(() => {
    const u = sets.filter(s => s.universe === univers)
    return {
      sets: u.length,
      avecStock: u.filter(s => s.avec_stock > 0).length,
      listings: u.reduce((n, s) => n + s.avec_stock, 0),
      sansPrix: u.reduce((n, s) => n + s.sans_prix, 0),
    }
  }, [sets, univers])

  return (
    <>
      <div className="gk-kpis">
        <div className="gk-kpi">
          <span className="gk-kpi-label">Sets</span>
          <span className="gk-kpi-val">{totaux.sets}</span>
          <span className="gk-kpi-sub">{totaux.avecStock} avec du stock</span>
        </div>
        <div className="gk-kpi">
          <span className="gk-kpi-label">Listings en stock</span>
          <span className="gk-kpi-val">{totaux.listings.toLocaleString('fr-FR')}</span>
          <span className="gk-kpi-sub">quantité &gt; 0</span>
        </div>
        <div className="gk-kpi">
          <span className="gk-kpi-label">Sans prix</span>
          <span className={`gk-kpi-val${totaux.sansPrix > 0 ? ' amber' : ''}`}>
            {totaux.sansPrix.toLocaleString('fr-FR')}
          </span>
          <span className="gk-kpi-sub">
            {totaux.sansPrix > 0 ? 'non vendables en l’état' : 'tout est chiffré'}
          </span>
        </div>
        <div className="gk-kpi">
          <span className="gk-kpi-label">Photos manquantes</span>
          <span className="gk-kpi-val">
            {sets.filter(s => s.universe === univers).reduce((n, s) => n + s.sans_photo, 0)}
          </span>
          <span className="gk-kpi-sub">pièces à scanner</span>
        </div>
      </div>

      <div
        style={{
          background: 'rgba(232,225,216,0.04)',
          border: '1px solid rgba(232,225,216,0.1)',
          borderRadius: 'var(--radius-gk-sm)',
          padding: '14px',
          marginBottom: '12px',
        }}
      >
        <div className="gk-facette-liste">
          {(['pokemon', 'onepiece'] as const).map(u => (
            <button
              key={u}
              onClick={() => setUnivers(u)}
              className={`ab ${univers === u ? 'ab-amber' : 'ab-muted'}`}
              style={{ padding: '4px 10px', cursor: 'pointer', fontSize: '9px' }}
            >
              {u === 'pokemon' ? 'Pokémon' : 'One Piece'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Filtrer par code, nom ou série…"
            className="gk-input"
            style={{ flex: 1, minWidth: '220px' }}
          />
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {FILTRES.map(f => (
              <button
                key={f.v}
                onClick={() => setFiltre(f.v)}
                className={`ab ${filtre === f.v ? 'ab-amber' : 'ab-muted'}`}
                style={{ padding: '4px 10px', cursor: 'pointer', fontSize: '9px' }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="gk-panneau">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '78px 1fr 150px 70px 70px 80px 80px 24px',
            gap: '10px',
            padding: '8px 14px',
            borderBottom: '1px solid rgba(212,144,12,0.06)',
          }}
        >
          {['Code', 'Set', 'Série', 'Total', 'Stock', 'Sans prix', 'Sans photo', ''].map((h, i) => (
            <span key={i} className="gk-label" style={{ textAlign: i >= 3 && i <= 6 ? 'right' : 'left' }}>
              {h}
            </span>
          ))}
        </div>

        {lignes.length === 0 ? (
          <p style={{ padding: '20px 14px', fontSize: '11px', color: 'var(--muted)' }}>
            Aucun set ne correspond à ce filtre.
          </p>
        ) : (
          lignes.map(s => (
            <Link
              key={`${s.universe}-${s.set_id}`}
              href={`/admin/listings/set/${s.universe}/${s.set_id}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '78px 1fr 150px 70px 70px 80px 80px 24px',
                gap: '10px',
                alignItems: 'center',
                padding: '9px 14px',
                borderBottom: '1px solid rgba(212,144,12,0.04)',
                textDecoration: 'none',
              }}
            >
              <span className="gk-cell mono" style={{ color: 'var(--amber)' }}>{s.code}</span>
              <span className="gk-cell" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.name_fr}
              </span>
              <span className="gk-cell muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.serie_name ?? '—'}
              </span>
              <span className="gk-cell muted" style={{ textAlign: 'right' }}>{s.total}</span>
              <span
                className="gk-cell"
                style={{ textAlign: 'right', color: s.avec_stock > 0 ? '#4ade80' : 'rgba(232,225,216,0.3)' }}
              >
                {s.avec_stock}
              </span>
              <span style={{ textAlign: 'right' }}>
                {s.sans_prix > 0
                  ? <span className="ab ab-amber">{s.sans_prix}</span>
                  : <span className="gk-cell muted">—</span>}
              </span>
              <span style={{ textAlign: 'right' }}>
                {s.sans_photo > 0
                  ? <span className="ab ab-red">{s.sans_photo}</span>
                  : <span className="gk-cell muted">—</span>}
              </span>
              <span className="gk-cell muted" style={{ textAlign: 'right' }}>→</span>
            </Link>
          ))
        )}
      </div>
    </>
  )
}
