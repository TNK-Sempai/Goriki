import { createClient } from '@/lib/supabase/server'
import SetsBrowser, { type SetRow } from '@/components/admin/SetsBrowser'

export const dynamic = 'force-dynamic'

/**
 * Listings — navigateur par set.
 *
 * L'écran précédent n'affichait que deux compteurs globaux et un bouton
 * « Édition en masse » à l'aveugle : impossible de savoir quel set contenait du
 * stock, ni où le travail restait à faire. On entre désormais par les sets.
 *
 * Les compteurs viennent de `admin_sets_overview()` (migration 0026), une
 * fonction agrégée gardée par `is_admin()` : compter côté client aurait exigé de
 * rapatrier les ~31 000 listings à chaque affichage.
 */
export default async function ListingsPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_sets_overview')

  const sets = ((data ?? []) as SetRow[]).map(s => ({
    ...s,
    total: Number(s.total),
    avec_stock: Number(s.avec_stock),
    sans_prix: Number(s.sans_prix),
    sans_photo: Number(s.sans_photo),
  }))

  return (
    <div className="gk-corps">
      <div className="gk-entete-ecran">
        <div>
          <div className="gk-titre">Listings</div>
          <div className="gk-eyebrow-texte">Choisir un set pour saisir prix et stock</div>
        </div>
      </div>

      {error && (
        <div className="gk-vide">
          <span className="gk-pastille" />
          Lecture des compteurs impossible : {error.message}
        </div>
      )}

      <SetsBrowser sets={sets} />
    </div>
  )
}
