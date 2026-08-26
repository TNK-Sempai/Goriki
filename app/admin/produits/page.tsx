'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

interface SealedProduct {
  id: string
  tcg_type: string
  name: string
  type: string
  description: string | null
  /** Visuels du produit, dans l'ordre d'affichage. Le premier sert de vignette. */
  image_urls: string[]
  price: number
  quantity: number
  is_active: boolean
}

const EMPTY: Omit<SealedProduct, 'id'> = {
  tcg_type: 'pokemon', name: '', type: 'booster',
  description: null, image_urls: [], price: 0, quantity: 0, is_active: true,
}

const TCG_TYPES = ['pokemon', 'onepiece', 'autre']
const PRODUCT_TYPES = ['booster', 'display', 'etb', 'tin', 'coffret', 'accessoire']

export default function ProduitsPage() {
  const [products, setProducts] = useState<SealedProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SealedProduct | null>(null)
  const [formBrut, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  // Aucun `setState` avant le premier `await` : l'indicateur de chargement part
  // de `true` à l'initialisation.
  async function load() {
    const res = await fetch('/api/produits')
    const data = await res.json().catch(() => null)
    setProducts(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => {
    // Chargement de données au montage : les `setState` de `load` sont posés
    // après un `await`, jamais dans le corps synchrone de l'effet.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [])

  function openCreate() { setForm(EMPTY); setEditing(null); setShowForm(true) }
  function openEdit(p: SealedProduct) {
    // On ne reprend QUE les champs écrivables : `image_url` arrive du GET mais
    // elle est générée en base, la renvoyer ferait échouer la mise à jour.
    setForm({
      tcg_type: p.tcg_type, name: p.name, type: p.type, description: p.description,
      image_urls: Array.isArray(p.image_urls) ? p.image_urls : [],
      price: p.price, quantity: p.quantity, is_active: p.is_active,
    })
    setEditing(p)
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditing(null) }

  async function handleSave() {
    setSaving(true)
    // Les champs laissés vides ne partent pas : une URL blanche donnerait une
    // vignette cassée en boutique.
    const form = { ...formBrut, image_urls: formBrut.image_urls.map(u => u.trim()).filter(Boolean) }
    if (editing) {
      await fetch('/api/produits', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing.id, ...form }) })
    } else {
      await fetch('/api/produits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    }
    await load()
    closeForm()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce produit ?')) return
    await fetch('/api/produits', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await load()
  }

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '8px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(238,228,204,0.25)', marginBottom: '5px' }

  return (
    <div className="gk-corps">
      <div className="gk-entete-ecran">
        <div>
          <div className="gk-titre">Produits scellés</div>
          <div className="gk-eyebrow-texte">Boosters, displays, ETBs, accessoires</div>
        </div>
        <button onClick={openCreate} className="gk-btn" data-primaire="true">+ Ajouter</button>
      </div>

      {/* Formulaire create/edit */}
      {showForm && (
        <div style={{ background: 'var(--surface-1)', border: '1px solid rgba(212,144,12,0.08)', borderRadius: '3px', padding: '16px', marginBottom: '16px', maxWidth: '480px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span className="gk-titre">{editing ? 'Modifier' : 'Nouveau produit'}</span>
            <button onClick={closeForm} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}><X size={14} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>TCG</label>
                <select value={formBrut.tcg_type} onChange={e => setForm(f => ({ ...f, tcg_type: e.target.value }))} className="gk-input">
                  {TCG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Type</label>
                <select value={formBrut.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="gk-input">
                  {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Nom</label>
              <input value={formBrut.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="gk-input" placeholder="Booster Écarlate et Violet..." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Prix €</label>
                <input type="number" min="0" step="0.01" value={formBrut.price} onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} className="gk-input" />
              </div>
              <div>
                <label style={labelStyle}>Quantité</label>
                <input type="number" min="0" value={formBrut.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 0 }))} className="gk-input" />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Visuels ({formBrut.image_urls.length})</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {formBrut.image_urls.map((url, i) => (
                  <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {/* Aperçu : une URL fautive se voit tout de suite. */}
                    {/* eslint-disable-next-line @next/next/no-img-element -- aperçu admin, hôte arbitraire saisi à la main */}
                    <img
                      src={url}
                      alt=""
                      aria-hidden
                      style={{ width: '30px', height: '40px', objectFit: 'cover', borderRadius: '2px', background: 'rgba(232,225,216,0.06)', flexShrink: 0 }}
                    />
                    <input
                      value={url}
                      onChange={e => setForm(f => ({
                        ...f,
                        image_urls: f.image_urls.map((u, k) => (k === i ? e.target.value : u)),
                      }))}
                      className="gk-input"
                      placeholder="https://..."
                    />
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, image_urls: f.image_urls.filter((_, k) => k !== i) }))}
                      title={i === 0 ? 'Retirer (le suivant deviendra la vignette)' : 'Retirer'}
                      style={{ background: 'none', border: 'none', color: 'rgba(248,113,113,0.5)', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, image_urls: [...f.image_urls, ''] }))}
                  className="ab ab-muted"
                  style={{ padding: '5px 10px', cursor: 'pointer', fontSize: '9px', alignSelf: 'flex-start' }}
                >
                  + Ajouter un visuel
                </button>
                <span style={{ fontSize: '10px', color: 'rgba(238,228,204,0.3)' }}>
                  Le premier visuel sert de vignette au catalogue.
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" id="active" checked={formBrut.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} style={{ width: '14px', height: '14px', accentColor: 'var(--amber)' }} />
              <label htmlFor="active" style={{ fontSize: '11px', color: 'var(--muted)' }}>Produit actif</label>
            </div>
            <button onClick={handleSave} disabled={saving || !formBrut.name} className="gk-btn" data-primaire="true">
              {saving ? 'Sauvegarde...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      <div className="gk-panneau">
        <div className="gk-heads" style={{ display: 'grid', gridTemplateColumns: '1fr 70px 80px 60px 70px 60px 60px' }}>
          <span className="gk-label">Nom</span>
          <span className="gk-label">TCG</span>
          <span className="gk-label">Type</span>
          <span className="gk-label">Prix</span>
          <span className="gk-label">Qté</span>
          <span className="gk-label">Statut</span>
          <span className="gk-label"></span>
        </div>
        {loading ? (
          <div style={{ padding: '24px 14px', fontSize: '11px', color: 'var(--muted)' }}>Chargement…</div>
        ) : products.length === 0 ? (
          <div style={{ padding: '24px 14px', fontSize: '11px', color: 'var(--muted)' }}>
            Aucun produit. Cliquez sur Ajouter.
          </div>
        ) : products.map(p => (
          <div
            key={p.id}
            className="gk-row"
            style={{ gridTemplateColumns: '1fr 70px 80px 60px 70px 60px 60px', cursor: 'default' }}
          >
            <span className="gk-cell">{p.name}</span>
            <span className="gk-cell"><span className="ab ab-muted">{p.tcg_type}</span></span>
            <span className="gk-cell muted">{p.type}</span>
            <span className="gk-cell amber">{p.price?.toFixed(2)} €</span>
            <span className="gk-cell">{p.quantity}</span>
            <span className="gk-cell">
              <span className={`ab ${p.is_active ? 'ab-green' : 'ab-muted'}`}>
                {p.is_active ? 'Actif' : 'Inactif'}
              </span>
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={() => openEdit(p)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '11px' }}>✎</button>
              <button onClick={() => handleDelete(p.id)} style={{ background: 'none', border: 'none', color: 'rgba(248,113,113,0.4)', cursor: 'pointer', fontSize: '11px' }}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
