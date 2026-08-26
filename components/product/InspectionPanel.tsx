import { prixOuEpuise } from '@/lib/utils'

/**
 * Relevé d'inspection — ce qui distingue une pièce vérifiée d'une fiche générique.
 * Dégrade proprement : si `inspection` est null, le panneau ne s'affiche pas.
 *
 * ⚠️ Aucune de ces colonnes n'existe encore en base (vérifié 2026-08-19 :
 * 0 colonne surface/corners/edges/centering/back/defects/inspected_at, 0 table
 * d'inspection). Le composant reçoit donc TOUJOURS `null` aujourd'hui et ne rend
 * rien. Structure à prévoir le jour où la donnée arrive : JSONB sur les tables de
 * listings, ou table `listing_inspections` dédiée.
 *
 * Issu du handoff Claude Design ; vocabulaire visuel remappé sur la v3.
 */

export interface Inspection {
  surface: string
  corners: string
  edges: string
  centering: string
  back: string
  defects?: { x: number; y: number; label: string }[]
  inspected_at?: string | null
}

interface InspectionPanelProps {
  inspection: Inspection | null
  price: number
}

const OK = /^(nette?|impeccable|4 nets|parfait)/i

export default function InspectionPanel({ inspection, price }: InspectionPanelProps) {
  if (!inspection) return null

  const rows = [
    { label: 'Surface', value: inspection.surface },
    { label: 'Coins', value: inspection.corners },
    { label: 'Bords', value: inspection.edges },
    { label: 'Centrage', value: inspection.centering },
    { label: 'Dos', value: inspection.back },
  ]

  const date = inspection.inspected_at
    ? new Date(inspection.inspected_at).toLocaleDateString('fr-FR')
    : null

  return (
    <section className="glass rounded-block p-6 sm:p-8">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">Inspection</h2>
        <span className="data text-[10px]">
          Relevé maison{date ? ` · ${date}` : ''} · pièce à {prixOuEpuise(price)}
        </span>
      </div>

      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
        {rows.map(r => {
          const ok = OK.test(r.value ?? '')
          return (
            <div key={r.label} className="glass-light flex flex-col gap-1.5 rounded-control px-4 py-3.5">
              <span className="data text-[9px]">{r.label}</span>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-ink">{r.value ?? '—'}</span>
                <span className="text-[11px]" style={{ color: ok ? 'oklch(0.52 0.1 150)' : 'var(--amber)' }}>
                  {ok ? '✓' : '·'}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {inspection.defects && inspection.defects.length > 0 && (
        <p className="mt-4 text-[13px] text-ink-60">
          {inspection.defects.length} défaut{inspection.defects.length > 1 ? 's' : ''} mineur
          {inspection.defects.length > 1 ? 's' : ''} enregistré{inspection.defects.length > 1 ? 's' : ''} :{' '}
          {inspection.defects.map(d => d.label).join(', ')}. Affichez-les sur le scan
          depuis le viewer ci-dessus.
        </p>
      )}
    </section>
  )
}
