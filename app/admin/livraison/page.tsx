import { createClient } from '@/lib/supabase/server'
import Topbar from '@/components/admin/Topbar'
import GrilleLivraison, {
  type Reglages,
  type Tarif,
} from '@/components/admin/livraison/GrilleLivraison'

export const dynamic = 'force-dynamic'

/**
 * Réglages de livraison.
 *
 * Les tarifs ne sont plus dans le code. `lib/constants.ts` portait une grille
 * forfaitaire (BE 5 € / autres 8 € / offerte dès 60 €) qu'il fallait redéployer
 * pour corriger un prix — or une grille transporteur change sans prévenir.
 *
 * L'écran lit TOUTES les lignes, actives ou non : c'est un écran de réglage,
 * pas la boutique. La policy RLS le permet à l'admin seul (`is_active or
 * is_admin()`), le public ne voit que les lignes actives.
 */
export default async function LivraisonPage() {
  const supabase = await createClient()

  const [{ data: reglagesRow }, { data: tarifsRows, error }] = await Promise.all([
    supabase
      .from('shipping_settings')
      .select('min_order_value, handling_fee, letter_max_value, letter_max_weight_g, card_weight_g, envelope_weight_g')
      .eq('id', 1)
      .maybeSingle(),
    supabase
      .from('shipping_rates')
      .select('id, code, label, carrier, kind, country, max_weight_g, price, sendcloud_method_code, needs_service_point, tracked, is_active, sort_order')
      .order('country')
      .order('sort_order'),
  ])

  const tarifs = ((tarifsRows ?? []) as Tarif[]).map(t => ({
    ...t,
    max_weight_g: Number(t.max_weight_g),
    price: Number(t.price),
    sort_order: Number(t.sort_order),
  }))

  const reglages: Reglages | null = reglagesRow
    ? {
        min_order_value: Number(reglagesRow.min_order_value ?? 0),
        handling_fee: Number(reglagesRow.handling_fee),
        letter_max_value: Number(reglagesRow.letter_max_value),
        letter_max_weight_g: Number(reglagesRow.letter_max_weight_g),
        card_weight_g: Number(reglagesRow.card_weight_g),
        envelope_weight_g: Number(reglagesRow.envelope_weight_g),
      }
    : null

  const pays = new Set(tarifs.map(t => t.country)).size
  const actifs = tarifs.filter(t => t.is_active).length

  return (
    <>
      <Topbar
        titre="Livraison"
        eyebrow={`${actifs} tarif(s) actif(s) · ${pays} pays · forfait ${reglages ? reglages.handling_fee.toFixed(2).replace('.', ',') : '—'} €`}
        action={{ label: 'Retour au tableau de bord', href: '/admin' }}
      />

      {error || !reglages ? (
        <div className="gk-corps">
          <div className="gk-vide" style={{ borderColor: 'rgba(255,122,104,0.3)' }}>
            <span className="gk-vide-titre">Réglages illisibles</span>
            <span className="gk-vide-texte">
              {error?.message ?? 'La ligne de réglages (id = 1) est absente de shipping_settings.'}
            </span>
          </div>
        </div>
      ) : (
        <GrilleLivraison reglages={reglages} tarifs={tarifs} />
      )}
    </>
  )
}
