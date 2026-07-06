'use client'

import { useState } from 'react'
import { Save, Eye, EyeOff } from 'lucide-react'

interface Listing {
  id: string
  quantity: number
  price: number
  condition: string
  is_active: boolean
  needs_photo: boolean
  image_api: string | null
  front_photo_url: string | null
  pokemon_cards?: { number: string; name_fr: string; rarity: string | null }
  onepiece_cards?: { number: string; name_fr: string; rarity: string | null }
  pokemon_variant_types?: { code: string; label: string }
  onepiece_variant_types?: { code: string; label: string }
}

interface MassListingTableProps {
  listings: Listing[]
  onSave: (updates: Partial<Listing & { id: string }>[]) => Promise<void>
}

const CONDITIONS = ['Mint', 'Near Mint', 'Excellent', 'Light Played', 'Moderate Played']

export default function MassListingTable({ listings, onSave }: MassListingTableProps) {
  const [edits, setEdits] = useState<Record<string, Partial<Listing>>>({})
  const [saving, setSaving] = useState(false)

  function updateEdit(id: string, field: keyof Listing, value: unknown) {
    setEdits(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }))
  }

  function getValue<K extends keyof Listing>(id: string, field: K, original: Listing[K]): Listing[K] {
    return (edits[id]?.[field] ?? original) as Listing[K]
  }

  async function handleSave() {
    const updates = Object.entries(edits).map(([id, fields]) => ({ id, ...fields }))
    if (updates.length === 0) return
    setSaving(true)
    await onSave(updates)
    setEdits({})
    setSaving(false)
  }

  const hasEdits = Object.keys(edits).length > 0

  return (
    <div>
      {hasEdits && (
        <div className="flex items-center justify-between mb-4 p-3 bg-amber/10 border border-amber/30 rounded-lg">
          <span className="text-sm text-amber">{Object.keys(edits).length} modification(s) non sauvegardée(s)</span>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm flex items-center gap-2">
            <Save size={13} />
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dim text-left">
              <th className="pb-3 pr-4 text-muted font-medium text-xs uppercase tracking-wider">Carte</th>
              <th className="pb-3 pr-4 text-muted font-medium text-xs uppercase tracking-wider">Variante</th>
              <th className="pb-3 pr-4 text-muted font-medium text-xs uppercase tracking-wider w-24">Qté</th>
              <th className="pb-3 pr-4 text-muted font-medium text-xs uppercase tracking-wider w-28">Prix €</th>
              <th className="pb-3 pr-4 text-muted font-medium text-xs uppercase tracking-wider">Condition</th>
              <th className="pb-3 text-muted font-medium text-xs uppercase tracking-wider w-16">Actif</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dim">
            {listings.map((listing) => {
              const card = listing.pokemon_cards ?? listing.onepiece_cards
              const variant = listing.pokemon_variant_types ?? listing.onepiece_variant_types
              const isEdited = !!edits[listing.id]

              return (
                <tr key={listing.id} className={`${isEdited ? 'bg-amber/5' : ''} hover:bg-surface-2/50 transition-colors`}>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      {listing.needs_photo && (
                        <span className="badge badge-danger text-[9px]">Photo</span>
                      )}
                      <div>
                        <p className="text-cream text-xs font-medium">{card?.name_fr}</p>
                        <p className="text-muted text-[11px]">#{card?.number} · {card?.rarity ?? '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className="badge badge-muted">{variant?.label}</span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <input
                      type="number"
                      min="0"
                      value={getValue(listing.id, 'quantity', listing.quantity)}
                      onChange={(e) => updateEdit(listing.id, 'quantity', parseInt(e.target.value) || 0)}
                      className="input py-1 px-2 text-xs w-20"
                    />
                  </td>
                  <td className="py-2.5 pr-4">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={getValue(listing.id, 'price', listing.price)}
                      onChange={(e) => updateEdit(listing.id, 'price', parseFloat(e.target.value) || 0)}
                      className="input py-1 px-2 text-xs w-24"
                    />
                  </td>
                  <td className="py-2.5 pr-4">
                    <select
                      value={getValue(listing.id, 'condition', listing.condition)}
                      onChange={(e) => updateEdit(listing.id, 'condition', e.target.value)}
                      className="input py-1 px-2 text-xs"
                    >
                      {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="py-2.5">
                    <button
                      onClick={() => updateEdit(listing.id, 'is_active', !getValue(listing.id, 'is_active', listing.is_active))}
                      className={`p-1.5 rounded transition-colors ${
                        getValue(listing.id, 'is_active', listing.is_active)
                          ? 'text-amber hover:bg-amber/10'
                          : 'text-muted hover:bg-surface-2'
                      }`}
                    >
                      {getValue(listing.id, 'is_active', listing.is_active)
                        ? <Eye size={14} />
                        : <EyeOff size={14} />
                      }
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
