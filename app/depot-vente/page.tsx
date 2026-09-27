import Link from 'next/link'
import { Suspense } from 'react'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import PageContainer from '@/components/layout/PageContainer'
import CardCursor from '@/components/motion/CardCursor'
import Reveal from '@/components/motion/Reveal'
import { createClient } from '@/lib/supabase/server'
import { PaginationUrl } from '@/components/ui/Pagination'
import { decouper, lirePage } from '@/lib/pagination'
import { resoudreParPage } from '@/lib/pagination.server'
import { prixOuEpuise } from '@/lib/utils'
import { DEPOT_VENTE_OUVERT } from '@/lib/fonctionnalites'
import SiteHeaderFerme from '@/components/layout/SiteHeader'
import SiteFooterFerme from '@/components/layout/SiteFooter'
import BientotDisponible from '@/components/layout/BientotDisponible'

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
  universe: 'onepiece' | 'pokemon'
}

const NOUVEAUTE_JOURS = 30

const TRIS = [
  { value: 'recent', label: 'Plus récentes' },
  { value: 'price-desc', label: 'Prix ↓' },
  { value: 'price-asc', label: 'Prix ↑' },
]

const UNIVERS: Record<string, string> = { onepiece: 'One Piece', pokemon: 'Pokémon' }

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function DepotVentePage({ searchParams }: Props) {
  /**
   * FERMÉ AU LANCEMENT. Le reste de cette page est conservé INTACT :
   * rouvrir la fonction consiste à passer `DEPOT_VENTE_OUVERT` à `true`.
   * La route serveur refuse de son côté, indépendamment de cet écran.
   */
  if (!DEPOT_VENTE_OUVERT) {
    return (
      <>
        <SiteHeaderFerme />
        <BientotDisponible titre={'Dépôt-vente'} accroche={"Vous pourrez confier vos pièces à la boutique, qui les met en vitrine et vous reverse le produit de la vente."} />
        <SiteFooterFerme />
      </>
    )
  }

  const sp = await searchParams
  const tri = typeof sp.tri === 'string' && TRIS.some(t => t.value === sp.tri) ? sp.tri : 'recent'
  const univers = typeof sp.univers === 'string' && sp.univers in UNIVERS ? sp.univers : ''

  const supabase = await createClient()

  // Le tri s'applique en SQL : `asking_price` et `created_at` sont deux vraies
  // colonnes de `consignment_items`. Le filtre par univers, lui, ne PEUT pas
  // être poussé en SQL — `card_id` ne porte aucun discriminant d'univers, il
  // faut résoudre la carte pour savoir de quel univers elle vient.
  const { data: items } = await (() => {
    const q = supabase
      .from('consignment_items')
      .select('id, card_id, asking_price, created_at')
      .eq('status', 'active')
    if (tri === 'price-desc') return q.order('asking_price', { ascending: false }).limit(60)
    if (tri === 'price-asc') return q.order('asking_price', { ascending: true }).limit(60)
    return q.order('created_at', { ascending: false }).limit(60)
  })()

  const ids = (items ?? []).map(i => i.card_id).filter(Boolean) as string[]

  // `consignment_items.card_id` ne porte AUCUN discriminant d'univers : on
  // résout la carte dans les deux tables et on garde celle qui répond.
  const [{ data: opCards }, { data: pkmCards }] = ids.length
    ? await Promise.all([
        supabase.from('onepiece_cards').select('id, name_fr, number, rarity, image_url').in('id', ids),
        supabase.from('pokemon_cards').select('id, name_fr, number, rarity, image_url').in('id', ids),
      ])
    : [{ data: [] }, { data: [] }]

  // La table qui a répondu EST le discriminant d'univers — c'est la seule
  // source d'information disponible, `consignment_items` n'en porte aucune.
  const byId = new Map<
    string,
    { name_fr: string; number: string; rarity: string | null; image_url: string | null; universe: 'onepiece' | 'pokemon' }
  >()
  for (const c of opCards ?? []) byId.set(c.id, { ...c, universe: 'onepiece' })
  for (const c of pkmCards ?? []) byId.set(c.id, { ...c, universe: 'pokemon' })

  // Composant SERVEUR rendu a chaque requete (`force-dynamic`) : lire l'heure
  // ici est legitime. La regle `react-hooks/purity` vise les rendus client.
  // eslint-disable-next-line react-hooks/purity
  const seuil = Date.now() - NOUVEAUTE_JOURS * 86_400_000

  const toutes: Piece[] = (items ?? [])
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
        universe: c.universe,
      }
    })
    .filter((p): p is Piece => p !== null)

  const filtrees = univers ? toutes.filter(p => p.universe === univers) : toutes

  // Découpage en DERNIER : après le tri (SQL) et après le filtre d'univers (JS).
  const parPage = await resoudreParPage(sp)
  const tranche = decouper(filtrees, lirePage(sp), parPage)
  const pieces = tranche.elements

  // Les compteurs suivent le filtre actif — mais PAS la pagination : ils
  // annoncent le rayon filtré dans son entier, pas la tranche affichée.
  const nouveautes = filtrees.filter(p => p.isNew).length
  const pad = (v: number) => String(v).padStart(3, '0')

  // Univers réellement représentés, pour ne pas proposer une pilule vide.
  const universPresents = [...new Set(toutes.map(p => p.universe))]

  const qs = (patch: Record<string, string>) => {
    const next = new URLSearchParams()
    if (univers) next.set('univers', univers)
    if (tri !== 'recent') next.set('tri', tri)
    // Le choix « par page » survit au changement de filtre ; la page courante,
    // non — le résultat change de taille, elle n'aurait plus de sens.
    if (typeof sp.par === 'string') next.set('par', sp.par)
    for (const [k, v] of Object.entries(patch)) {
      if (v && !(k === 'tri' && v === 'recent')) next.set(k, v)
      else next.delete(k)
    }
    const s = next.toString()
    return s ? `/depot-vente?${s}` : '/depot-vente'
  }

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
                  {pad(filtrees.length)}
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

          {/* Tri et filtre — même grammaire que les autres rayons (pilules sur
              searchParams, page serveur). Rendus dès qu'il y a QUELQUE CHOSE à
              trier dans le rayon, y compris quand le filtre courant ne ramène
              rien : sans ça, on ne pourrait plus revenir à « Tous ». */}
          {toutes.length > 0 && (
            <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:mb-9">
              <div className="flex flex-wrap gap-2">
                {universPresents.length > 1 && (
                  <>
                    <Link href={qs({ univers: '' })} className="pill" data-active={univers === ''}>
                      Tous
                    </Link>
                    {universPresents.map(u => (
                      <Link key={u} href={qs({ univers: u })} className="pill" data-active={univers === u}>
                        {UNIVERS[u]}
                      </Link>
                    ))}
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {TRIS.map(t => (
                  <Link key={t.value} href={qs({ tri: t.value })} className="pill" data-active={tri === t.value}>
                    {t.label}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {pieces.length === 0 ? (
            <div className="glass rounded-block px-8 py-16 text-center">
              <p className="m-0 text-[14px] text-ink-70">
                {univers
                  ? `Aucune pièce ${UNIVERS[univers]} en dépôt-vente pour le moment.`
                  : 'Aucune pièce en dépôt-vente pour le moment.'}
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
                    <span className="mt-1.5 text-[14px] font-semibold text-ink">{prixOuEpuise(p.price)}</span>
                  </div>
                </div>
              ))}
            </Reveal>
          )}

          <Suspense fallback={<div className="mt-8 h-[52px]" />}>
            <PaginationUrl
              page={tranche.page}
              pages={tranche.pages}
              total={tranche.total}
              parPage={parPage}
              premier={tranche.premier}
              dernier={tranche.dernier}
              unite="pièce"
            />
          </Suspense>
        </PageContainer>
      </main>

      <SiteFooter />
    </>
  )
}
