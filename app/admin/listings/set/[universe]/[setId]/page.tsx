import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SetListingsEditor from '@/components/admin/SetListingsEditor'

export const dynamic = 'force-dynamic'

/**
 * Détail d'un set — vue de gestion des listings.
 *
 * La coquille est serveur (résolution du set, garde d'univers) ; la grille est
 * cliente parce que tout y est éditable en ligne. L'ancienne page
 * `/admin/listings/masse` est repliée ici : la sélection multiple vit désormais
 * DANS le contexte visuel du set, plus dans un mode séparé.
 */
export default async function AdminSetPage({
  params,
}: {
  params: Promise<{ universe: string; setId: string }>
}) {
  const { universe, setId } = await params
  if (universe !== 'pokemon' && universe !== 'onepiece') notFound()

  const supabase = await createClient()
  const { data: set } = await supabase
    .from(universe === 'pokemon' ? 'pokemon_sets' : 'onepiece_sets')
    .select('id, code, name_fr, serie_name, card_count')
    .eq('id', setId)
    .single()

  if (!set) notFound()

  return (
    <div>
      <div className="admin-header-row">
        <div>
          <Link href="/admin/listings" className="admin-table-action" style={{ display: 'block', marginBottom: '6px' }}>
            ← Tous les sets
          </Link>
          <div className="admin-title">{set.name_fr}</div>
          <div className="admin-sub">
            {set.code} · {universe === 'pokemon' ? 'Pokémon' : 'One Piece'}
            {set.serie_name ? ` · ${set.serie_name}` : ''}
            {set.card_count ? ` · ${set.card_count} cartes au set` : ''}
          </div>
        </div>
      </div>

      <SetListingsEditor universe={universe} setId={setId} />
    </div>
  )
}
