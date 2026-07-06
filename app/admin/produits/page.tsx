'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

interface SealedProduct {
  id: string
  tcg_type: string
  name: string
  type: string
  description: string | null
  image_url: string | null
  price: number
  quantity: number
  is_active: boolean
}

const EMPTY: Omit<SealedProduct, 'id'> = {
  tcg_type: 'pokemon', name: '', type: 'booster',
  description: null, image_url: null, price: 0, quantity: 0, is_active: true,
}

const TCG_TYPES = ['pokemon', 'onepiece', 'autre']
const PRODUCT_TYPES = ['booster', 'display', 'etb', 'tin', 'coffret', 'accessoire']

export default function ProduitsPage() {
  const [products, setProducts] = useState<SealedProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SealedProduct | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  async function load() {
    const res = await fetch('/api/produits')
    const data = await res.json()
    setProducts(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() { setForm(EMPTY); setEditing(null); setShowForm(true) }
  function openEdit(p: SealedProduct) { setForm(p); setEditing(p); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditing(null) }

  async function handleSave() {
    setSaving(true)
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
    <div>
      <div className="admin-header-row">
        <div>
          <div className="admin-title">Produits scellés</div>
          <div className="admin-sub">Boosters, displays, ETBs, accessoires</div>
        </div>
        <button onClick={openCreate} className="btn btn-primary btn-sm">+ Ajouter</button>
      </div>

      {/* Formulaire create/edit */}
      {showForm && (
        <div style={{ background: 'var(--surface-1)', border: '1px solid rgba(212,144,12,0.08)', borderRadius: '3px', padding: '16px', marginBottom: '16px', maxWidth: '480px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span className="admin-title">{editing ? 'Modifier' : 'Nouveau produit'}</span>
            <button onClick={closeForm} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}><X size={14} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>TCG</label>
                <select value={form.tcg_type} onChange={e => setForm(f => ({ ...f, tcg_type: e.target.value }))} className="admin-input">
                  {TCG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="admin-input">
                  {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Nom</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="admin-input" placeholder="Booster Écarlate et Violet..." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Prix €</label>
                <input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} className="admin-input" />
              </div>
              <div>
                <label style={labelStyle}>Quantité</label>
                <input type="number" min="0" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 0 }))} className="admin-input" />
              </div>
            </div>
            <div>
              <label style={labelStyle}>URL image</label>
              <input value={form.image_url ?? ''} onChange={e => setForm(f => ({ ...f, image_url: e.target.value || null }))} className="admin-input" placeholder="https://..." />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" id="active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} style={{ width: '14px', height: '14px', accentColor: 'var(--amber)' }} />
              <label htmlFor="active" style={{ fontSize: '11px', color: 'var(--muted)' }}>Produit actif</label>
            </div>
            <button onClick={handleSave} disabled={saving || !form.name} className="btn btn-primary btn-sm">
              {saving ? 'Sauvegarde...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      <div className="admin-table">
        <div className="admin-col-heads" style={{ display: 'grid', gridTemplateColumns: '1fr 70px 80px 60px 70px 60px 60px' }}>
          <span className="admin-col-head">Nom</span>
          <span className="admin-col-head">TCG</span>
          <span className="admin-col-head">Type</span>
          <span className="admin-col-head">Prix</span>
          <span className="admin-col-head">Qté</span>
          <span className="admin-col-head">Statut</span>
          <span className="admin-col-head"></span>
        </div>
        {loading ? (
          <div style={{ padding: '24px 14px', fontSize: '11px', color: 'var(--muted)' }}>Chargement…</div>
        ) : products.length === 0 ? (
          <div style={{ padding: '24px 14px', fontSize: '11px', color: 'var(--muted)' }}>
            Aucun produit. Cliquez sur Ajouter.
          </div>
        ) : products.map((p: any) => (
          <div
            key={p.id}
            className="admin-row"
            style={{ gridTemplateColumns: '1fr 70px 80px 60px 70px 60px 60px', cursor: 'default' }}
          >
            <span className="admin-cell">{p.name}</span>
            <span className="admin-cell"><span className="ab ab-muted">{p.tcg_type}</span></span>
            <span className="admin-cell muted">{p.type}</span>
            <span className="admin-cell amber">{p.price?.toFixed(2)} €</span>
            <span className="admin-cell">{p.quantity}</span>
            <span className="admin-cell">
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
