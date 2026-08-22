import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import PageContainer from '@/components/layout/PageContainer'
import CardCursor from '@/components/motion/CardCursor'
import Reveal from '@/components/motion/Reveal'
import { createClient } from '@/lib/supabase/server'
import { formatPrice } from '@/lib/utils'

export const metadata = { title: 'Dépôt-vente' }
export const dynamic = 'force-dynamic'

/**
 * Dépôt-vente — case 6 de la planche de référence.
 *
 * Composition de la planche : titre et accroche à gauche, DEUX GRANDS COMPTEURS
 * alignés à droite sur la même ligne de base, CTA ocre en dessous, puis une
 * rangée de cartes portant chacune une étiquette d'angle « DÉPÔT ».
 *
 * Route PUBLIQUE : la planche place « Dépôt-vente » dans la navigation
 * principale, aux côtés de One Piece et Pokémon — c'est un rayon de la
 * boutique, pas une page de compte. L'ancienne page `/compte/depot-vente`
 * n'était qu'un écran « Bientôt disponible ».
 *
 * Lecture rendue possible par la migration 0023 : `consignment_items` était en
 * lecture strictement propriétaire, un visiteur ne voyait rien. La policy
 * n'ouvre que les pièces `active`, et les colonnes sensibles
 * (`commission_rate`, `notes`, `user_id`) restent hors du GRANT.
 */

interface Piece {
  id: string
  price: number
  name: string
  ref: string
  rarity: string | null
  imageUrl: string | null
  isNew: boolean
}

const NOUVEAUTE_JOURS = 30

export default async function DepotVentePage() {
  const supabase = await createClient()

  const { data: items } = await supabase
    .from('consignment_items')
    .select('id, card_id, asking_price, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(60)

  const ids = (items ?? []).map(i => i.card_id).filter(Boolean) as string[]

  // `consignment_items.card_id` ne porte AUCUN discriminant d'univers : on
  // résout la carte dans les deux tables et on garde celle qui répond.
  const [{ data: opCards }, { data: pkmCards }] = ids.length
    ? await Promise.all([
        supabase.from('onepiece_cards').select('id, name_fr, number, rarity, image_url').in('id', ids),
        supabase.from('pokemon_cards').select('id, name_fr, number, rarity, image_url').in('id', ids),
      ])
    : [{ data: [] }, { data: [] }]

  const byId = new Map<string, { name_fr: string; number: string; rarity: string | null; image_url: string | null }>()
  for (const c of [...(opCards ?? []), ...(pkmCards ?? [])]) byId.set(c.id, c)

  // Composant SERVEUR rendu a chaque requete (`force-dynamic`) : lire l'heure
  // ici est legitime. La regle `react-hooks/purity` vise les rendus client.
  // eslint-disable-next-line react-hooks/purity
  const seuil = Date.now() - NOUVEAUTE_JOURS * 86_400_000

  const pieces: Piece[] = (items ?? [])
    .map(i => {
      const c = i.card_id ? byId.get(i.card_id) : undefined
      if (!c) return null
      return {
        id: i.id,
        price: i.asking_price,
        name: c.name_fr,
        ref: c.number,
        rarity: c.rarity,
        imageUrl: c.image_url,
        isNew: new Date(i.created_at).getTime() >= seuil,
      }
    })
    .filter((p): p is Piece => p !== null)

  const nouveautes = pieces.filter(p => p.isNew).length
  const pad = (v: number) => String(v).padStart(3, '0')

  return (
    <>
      <SiteHeader />
      <CardCursor />

      <main className="font-grotesk text-ink">
        <PageContainer as="section" className="pb-16 pt-10 lg:pb-20 lg:pt-14">
          <div className="mb-8 flex flex-col gap-8 lg:mb-10 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[46ch]">
              <h1 className="display-section m-0">Dépôt-vente</h1>
              <p className="m-0 mt-4 text-[14px] leading-[1.6] text-ink-70">
                Les cartes de la communauté, contrôlées et expédiées par Goriki. Chaque
                pièce passe la même inspection que notre propre stock.
              </p>
              <Link
                href="/compte/depot-vente"
                className="btn-ochre mt-6 inline-flex w-fit items-center gap-2.5 px-6 py-3.5 font-mono text-[11px] uppercase tracking-[0.14em]"
              >
                Déposer mes cartes <span aria-hidden>→</span>
              </Link>
            </div>

            {/* Deux compteurs, alignés à droite — signature de cet écran. */}
            <div className="flex gap-10 lg:gap-14">
              <div className="flex flex-col">
                <span className="text-[40px] font-semibold leading-none tracking-[-0.03em] text-ink lg:text-[46px]">
                  {pad(pieces.length)}
                </span>
                <span className="data mt-2 text-[9px]">pièces disponibles</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[40px] font-semibold leading-none tracking-[-0.03em] text-ink lg:text-[46px]">
                  {pad(nouveautes)}
                </span>
                <span className="data mt-2 text-[9px]">nouveautés</span>
              </div>
            </div>
          </div>

          {pieces.length === 0 ? (
            <div className="glass rounded-block px-8 py-16 text-center">
              <p className="m-0 text-[14px] text-ink-70">
                Aucune pièce en dépôt-vente pour le moment.
              </p>
            </div>
          ) : (
            <Reveal
              className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5"
              stagger={0.05}
              y={14}
            >
              {pieces.map(p => (
                <div key={p.id} data-card-hover className="glass group flex flex-col overflow-hidden rounded-panel">
                  <div className="relative aspect-[2.5/3.5] overflow-hidden">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- vignette dense de grille
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="scan-pending h-full w-full" />
                    )}
                    <span className="corner-tag absolute left-2 top-2" data-tone="ochre">
                      Dépôt
                    </span>
                  </div>
                  <div className="flex flex-col px-3 py-2.5">
                    <span className="data text-[8px]">{p.ref}</span>
                    <span className="line-clamp-1 text-[12px] font-medium leading-tight text-ink">{p.name}</span>
                    <span className="mt-1.5 text-[14px] font-semibold text-ink">{formatPrice(p.price)}</span>
                  </div>
                </div>
              ))}
            </Reveal>
          )}
        </PageContainer>
      </main>

      <SiteFooter />
    </>
  )
}
