import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatPrice } from '@/lib/utils'

export const metadata = { title: 'Mes dépôts' }

/**
 * Mes dépôts — versant « compte » du dépôt-vente.
 *
 * L'écran précédent était un simple carton « Bientôt disponible » rendu avec le
 * vocabulaire sombre d'origine. La vitrine publique vit désormais sur
 * `/depot-vente` (case 6 de la planche) ; cette page-ci liste les pièces que
 * l'utilisateur a lui-même déposées, avec leur statut réel.
 */

const ETATS: Record<string, { label: string; tone: 'done' | 'transit' | 'wait' }> = {
  pending: { label: 'En attente de validation', tone: 'wait' },
  active: { label: 'En vitrine', tone: 'transit' },
  sold: { label: 'Vendue', tone: 'done' },
  returned: { label: 'Restituée', tone: 'wait' },
  cancelled: { label: 'Annulée', tone: 'wait' },
}

interface Depot {
  id: string
  card_id: string | null
  asking_price: number
  status: string
  created_at: string
}

export default async function MesDepotsPage() {
  const supabase = await createClient()

  // `user_id` n'est plus lisible par `authenticated` (migration 0023, qui
  // protège l'identité des déposants sur la vitrine publique) : on passe par la
  // fonction SECURITY DEFINER `mes_depots()` (migration 0024). La garde de
  // session est celle du layout de compte.
  const { data } = await supabase.rpc('mes_depots')
  const items = (data ?? []) as Depot[]

  const ids = items.map(i => i.card_id).filter(Boolean) as string[]

  // `card_id` ne porte aucun discriminant d'univers : on résout dans les deux tables.
  const [{ data: opCards }, { data: pkmCards }] = ids.length
    ? await Promise.all([
        supabase.from('onepiece_cards').select('id, name_fr, number, image_url').in('id', ids),
        supabase.from('pokemon_cards').select('id, name_fr, number, image_url').in('id', ids),
      ])
    : [{ data: [] }, { data: [] }]

  const cartes = new Map<string, { name_fr: string; number: string; image_url: string | null }>()
  for (const c of [...(opCards ?? []), ...(pkmCards ?? [])]) cartes.set(c.id, c)

  const rows = items.map(i => {
    const c = i.card_id ? cartes.get(i.card_id) : undefined
    return {
      id: i.id,
      name: c?.name_fr ?? 'Carte',
      ref: c?.number ?? '—',
      imageUrl: c?.image_url ?? null,
      price: i.asking_price,
      status: i.status,
    }
  })

  return (
    <>
      <h1 className="display-section m-0">Mes dépôts</h1>
      <p className="m-0 mb-7 mt-4 max-w-[56ch] text-[14px] leading-[1.6] text-ink-70 lg:mb-9">
        Les pièces que vous nous avez confiées. Elles sont contrôlées, mises en vitrine et
        expédiées par Goriki — vous êtes réglé après la vente.
      </p>

      {rows.length === 0 ? (
        <div className="glass rounded-block px-8 py-14 text-center">
          <p className="m-0 mb-5 text-[14px] text-ink-70">
            Vous n&apos;avez encore déposé aucune pièce.
          </p>
          <Link href="/depot-vente" className="data text-[9px] hover:text-ochre">
            Voir la vitrine dépôt-vente →
          </Link>
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-panel-lg">
          {rows.map(r => {
            const e = ETATS[r.status] ?? { label: r.status, tone: 'wait' as const }
            return (
              <div
                key={r.id}
                className="flex items-center gap-4 border-b border-[rgba(26,22,17,0.09)] px-4 py-3 last:border-0"
              >
                {r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- vignette de ligne
                  <img
                    src={r.imageUrl}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    className="h-16 w-[46px] shrink-0 rounded-[4px] object-cover shadow-[0_8px_16px_-8px_rgba(26,22,17,0.5)]"
                  />
                ) : (
                  <span className="scan-pending h-16 w-[46px] shrink-0 rounded-[4px]" />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="line-clamp-1 text-[13px] font-medium leading-tight text-ink">{r.name}</span>
                  <span className="data mt-1 text-[8px]">{r.ref}</span>
                </span>
                <span className="status shrink-0" data-tone={e.tone}>{e.label}</span>
                <span className="w-[86px] shrink-0 text-right text-[14px] font-semibold text-ink">
                  {formatPrice(r.price)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
