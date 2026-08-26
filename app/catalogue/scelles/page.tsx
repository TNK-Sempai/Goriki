import Link from 'next/link'
import { Suspense } from 'react'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import PageContainer from '@/components/layout/PageContainer'
import SealedTile, { type SealedProduct } from '@/components/catalogue/SealedTile'
import CardCursor from '@/components/motion/CardCursor'
import Reveal from '@/components/motion/Reveal'
import { PaginationUrl } from '@/components/ui/Pagination'
import { createClient } from '@/lib/supabase/server'
import { decouper, lirePage } from '@/lib/pagination'
import { resoudreParPage } from '@/lib/pagination.server'

export const metadata = { title: 'Scellés' }
export const dynamic = 'force-dynamic'

/**
 * Scellés — case 5 de la planche de référence.
 *
 * Composition de la planche : grand titre à gauche, rangée de pilules de
 * filtre, puis GRILLE 3 colonnes de tuiles produit. La liste de lignes pleine
 * largeur de la version précédente est remplacée.
 *
 * Les libellés de filtre suivent l'énumération RÉELLE de `sealed_products.type`
 * (booster · display · etb · tin · coffret · accessoire) — la planche dessine
 * un onglet « Decks » qui n'existe pas dans la contrainte de la table.
 * Seuls les types effectivement présents en base sont proposés.
 */

const LABELS: Record<string, string> = {
  display: 'Displays',
  booster: 'Boosters',
  etb: 'ETB',
  tin: 'Tins',
  coffret: 'Coffrets',
  accessoire: 'Accessoires',
}

const SORTS = [
  { value: 'price-desc', label: 'Prix ↓' },
  { value: 'price-asc', label: 'Prix ↑' },
  { value: 'name', label: 'A → Z' },
]

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ScellesPage({ searchParams }: Props) {
  const sp = await searchParams
  const type = typeof sp.type === 'string' ? sp.type : ''
  const sort = typeof sp.sort === 'string' ? sp.sort : 'price-desc'

  const supabase = await createClient()

  const [{ data: all }, listing] = await Promise.all([
    // Sert uniquement à savoir quelles pilules ont lieu d'être affichées.
    supabase.from('sealed_products').select('type').eq('is_active', true),
    (async () => {
      let q = supabase
        .from('sealed_products')
        .select('id, name, type, tcg_type, description, image_url, price, quantity')
        .eq('is_active', true)
      if (type) q = q.eq('type', type)
      if (sort === 'price-asc') q = q.order('price', { ascending: true })
      else if (sort === 'name') q = q.order('name')
      else q = q.order('price', { ascending: false })
      return q.limit(120)
    })(),
  ])

  const present = [...new Set((all ?? []).map(r => r.type))].filter(t => t in LABELS)

  const tous: SealedProduct[] = (listing.data ?? []).map(p => ({
    id: p.id,
    name: p.name,
    meta: [LABELS[p.type] ?? p.type, p.tcg_type === 'autre' ? null : p.tcg_type]
      .filter(Boolean)
      .join(' · '),
    price: p.price,
    quantity: p.quantity,
    imageUrl: p.image_url,
  }))

  // Découpage en dernier : `tous` est déjà filtré par type et déjà trié en base.
  const parPage = await resoudreParPage(sp)
  const tranche = decouper(tous, lirePage(sp), parPage)
  const products = tranche.elements

  const qs = (patch: Record<string, string>) => {
    const next = new URLSearchParams()
    if (type) next.set('type', type)
    if (sort) next.set('sort', sort)
    // Le choix « par page » (30/50) survit au changement de filtre — c'est une
    // préférence d'affichage. La page courante, elle, n'est jamais reportée :
    // le résultat change de taille, elle n'aurait plus de sens.
    if (typeof sp.par === 'string') next.set('par', sp.par)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    const s = next.toString()
    return s ? `/catalogue/scelles?${s}` : '/catalogue/scelles'
  }

  return (
    <>
      <SiteHeader />
      <CardCursor />

      <main className="font-grotesk text-ink">
        <PageContainer as="section" className="pb-16 pt-10 lg:pb-20 lg:pt-14">
          <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between lg:mb-9">
            <div>
              <h1 className="display-section m-0">Scellés</h1>
              <p className="m-0 mt-3 max-w-[46ch] text-[14px] leading-[1.55] text-ink-70">
                Displays, boosters et coffrets d&apos;origine, jamais ouverts.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SORTS.map(s => (
                <Link key={s.value} href={qs({ sort: s.value })} className="pill" data-active={sort === s.value}>
                  {s.label}
                </Link>
              ))}
            </div>
          </div>

          {present.length > 1 && (
            <div className="mb-7 flex flex-wrap gap-2 lg:mb-9">
              <Link href={qs({ type: '' })} className="pill" data-active={type === ''}>
                Tous
              </Link>
              {present.map(t => (
                <Link key={t} href={qs({ type: t })} className="pill" data-active={type === t}>
                  {LABELS[t]}
                </Link>
              ))}
            </div>
          )}

          {products.length === 0 ? (
            <div className="glass rounded-block px-8 py-16 text-center">
              <p className="m-0 text-[14px] text-ink-70">
                Aucun produit scellé en ligne pour le moment. Le stock est en cours de saisie.
              </p>
            </div>
          ) : (
            <Reveal className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" stagger={0.06} y={16}>
              {products.map(p => (
                <SealedTile key={p.id} product={p} />
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
              unite="produit"
            />
          </Suspense>
        </PageContainer>
      </main>

      <SiteFooter />
    </>
  )
}
