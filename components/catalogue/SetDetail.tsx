import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import PageContainer from '@/components/layout/PageContainer'
import CardGrid from '@/components/catalogue/CardGrid'
import SetToolbar from '@/components/catalogue/SetToolbar'
import { createClient } from '@/lib/supabase/server'
import { UNIVERSES } from '@/lib/universe-theme'

const TABLES = {
  pokemon: { sets: 'pokemon_sets', cards: 'pokemon_cards', listings: 'pokemon_listings', variants: 'pokemon_variant_types' },
  onepiece: { sets: 'onepiece_sets', cards: 'onepiece_cards', listings: 'onepiece_listings', variants: 'onepiece_variant_types' },
} as const

const SORTS = [
  { value: 'num', label: 'N° croissant' },
  { value: 'price-desc', label: 'Prix décroissant' },
  { value: 'price-asc', label: 'Prix croissant' },
  { value: 'name', label: 'A → Z' },
]

const CONDITIONS = ['Mint', 'Near Mint', 'Excellent', 'Light Played', 'Moderate Played']

/**
 * Détail d'une extension — case 3 de la planche de référence.
 *
 * Composition de la planche :
 *   · fil d'ariane fin,
 *   · BANDE HÉRO en deux colonnes : code + grand titre + fiche technique
 *     (sortie / nombre de cartes / disponibles) + CTA à gauche, visuel du set
 *     et rose des vents à droite,
 *   · barre d'onglets de RARETÉ pleine largeur,
 *   · ligne d'outils compacte,
 *   · grille de cartes DENSE sur toute la largeur.
 *
 * La colonne de filtres collante à gauche de la version précédente est
 * supprimée : elle amputait la grille d'un quart de la largeur et ne figure
 * pas dans la planche.
 *
 * Divergence de données assumée : la planche montre un visuel produit (boîte
 * de booster) à droite du hero. `*_sets.image_url` est NULL pour la totalité
 * des sets en base — aucun visuel de set n'a été importé. On affiche donc un
 * éventail de cartes RÉELLES du set, à masse visuelle équivalente, plutôt que
 * de laisser un trou ou d'inventer une image.
 */
export default async function SetDetail({
  universe,
  setId,
  searchParams,
}: {
  universe: 'pokemon' | 'onepiece'
  setId: string
  searchParams: Record<string, string | string[] | undefined>
}) {
  const t = TABLES[universe]
  const theme = UNIVERSES[universe]
  const supabase = await createClient()

  const sp = (k: string) => {
    const v = searchParams[k]
    return typeof v === 'string' ? v : undefined
  }

  const { data: setData } = await supabase
    .from(t.sets)
    .select('id, code, name_fr, card_count, release_date, serie_name, image_url')
    .eq('id', setId)
    .single()

  if (!setData) notFound()

  const [{ data: rarities }, { data: variants }, dispo, { data: preview }] = await Promise.all([
    supabase.from(t.cards).select('rarity').eq('set_id', setId).not('rarity', 'is', null),
    supabase.from(t.variants).select('code, label').or(`set_id.eq.${setId},set_id.is.null`),
    supabase
      .from(t.listings)
      .select(`id, ${t.cards}!inner(set_id)`, { count: 'exact', head: true })
      .eq('is_active', true)
      .gt('quantity', 0)
      .gt('price', 0)
      .eq(`${t.cards}.set_id`, setId),
    supabase
      .from(t.listings)
      .select(`price, image_api, front_photo_url, ${t.cards}!inner(set_id, image_url)`)
      .eq('is_active', true)
      .gt('quantity', 0)
      .gt('price', 0)
      .eq(`${t.cards}.set_id`, setId)
      .order('price', { ascending: false })
      .limit(3),
  ])

  let query = supabase
    .from(t.listings)
    .select(`
      id, price, quantity, condition, front_photo_url, image_api, needs_photo,
      ${t.cards}!inner(id, number, name_fr, rarity, set_id),
      ${t.variants}!inner(id, code, label)
    `)
    .eq('is_active', true)
    .eq(`${t.cards}.set_id`, setId)

  if (sp('rarity')) query = query.eq(`${t.cards}.rarity`, sp('rarity')!)
  if (sp('variant')) query = query.eq(`${t.variants}.code`, sp('variant')!)
  if (sp('condition')) query = query.eq('condition', sp('condition')!)
  if (sp('stock') === '1') query = query.gt('quantity', 0)
  if (sp('q')) query = query.ilike(`${t.cards}.name_fr`, `%${sp('q')}%`)

  const sort = sp('sort') ?? 'num'
  if (sort === 'price-desc') query = query.order('price', { ascending: false })
  else if (sort === 'price-asc') query = query.order('price', { ascending: true })
  else if (sort === 'name') query = query.order(`${t.cards}(name_fr)`)
  else query = query.order(`${t.cards}(number)`)

  const { data: listings } = await query.limit(120)

  // Les jointures Supabase peuvent remonter des tableaux — cf. CLAUDE.md.
  const flat = (listings ?? []).map(l => {
    const row = l as unknown as Record<string, unknown>
    const card = row[t.cards]
    const variant = row[t.variants]
    return {
      ...(row as object),
      [t.cards]: Array.isArray(card) ? card[0] : card,
      [t.variants]: Array.isArray(variant) ? variant[0] : variant,
    }
  }) as unknown as Parameters<typeof CardGrid>[0]['listings']

  const uniqueRarities = [...new Set((rarities ?? []).map(r => r.rarity).filter(Boolean))] as string[]

  const previewImages = ((preview ?? []) as unknown as {
    image_api: string | null
    front_photo_url: string | null
    [k: string]: unknown
  }[])
    .map(row => {
      const card = row[t.cards]
      const c = (Array.isArray(card) ? card[0] : card) as { image_url: string | null } | undefined
      return row.front_photo_url ?? row.image_api ?? c?.image_url ?? null
    })
    .filter((v): v is string => Boolean(v))

  const sortie = setData.release_date
    ? new Date(setData.release_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const FICHE = [
    sortie ? { k: 'Sortie', v: sortie } : null,
    setData.card_count ? { k: 'Cartes au set', v: String(setData.card_count) } : null,
    { k: 'Disponibles', v: String(dispo.count ?? 0) },
    setData.serie_name ? { k: 'Série', v: setData.serie_name } : null,
  ].filter(Boolean) as { k: string; v: string }[]

  return (
    <main className="font-grotesk text-ink">
      {/* ── Fil d'ariane ────────────────────────────────────────────────── */}
      <PageContainer as="nav" className="pt-8">
        <span className="data text-[9px]">
          <Link href={`/catalogue/${universe}`} className="hover:text-ochre">{theme.label}</Link>
          <span className="mx-1.5 text-ink-55">/</span>
          <Link href={`/catalogue/${universe}/series`} className="hover:text-ochre">Sets</Link>
          <span className="mx-1.5 text-ink-55">/</span>
          <span className="text-ink">{setData.code}</span>
        </span>
      </PageContainer>

      {/* ── Bande héro ──────────────────────────────────────────────────── */}
      <PageContainer as="section" className="pb-8 pt-6 lg:pb-10">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,52fr)_minmax(0,48fr)]">
          <div className="flex flex-col">
            <span className="data text-[9px]">{setData.code}</span>
            <h1 className="display-section m-0 mt-3 max-w-[16ch]">{setData.name_fr}</h1>

            <ul className="m-0 mt-6 flex list-none flex-col gap-2 lg:mt-7">
              {FICHE.map(f => (
                <li key={f.k} className="flex items-center gap-2.5">
                  <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-[rgba(26,22,17,0.35)]" />
                  <span className="text-[13px] text-ink-70">
                    {f.k} <span className="text-ink">: {f.v}</span>
                  </span>
                </li>
              ))}
            </ul>

            <a
              href="#cartes"
              className="btn-ochre mt-7 inline-flex w-fit items-center gap-2.5 px-6 py-3.5 font-mono text-[11px] uppercase tracking-[0.14em] lg:mt-9"
            >
              Voir les cartes du set <span aria-hidden>→</span>
            </a>
          </div>

          <div className="relative flex min-h-[220px] items-center justify-center lg:min-h-[280px]">
            {previewImages.length > 0 ? (
              previewImages.map((src, i) => {
                const off = i - (previewImages.length - 1) / 2
                return (
                  // eslint-disable-next-line @next/next/no-img-element -- éventail décoratif transformé
                  <img
                    key={i}
                    src={src}
                    alt=""
                    aria-hidden
                    className="absolute h-[236px] rounded-[8px] object-cover shadow-[0_30px_58px_-24px_rgba(26,22,17,0.55)]"
                    style={{ transform: `translateX(${off * 96}px) rotate(${off * 9}deg)`, zIndex: 3 - Math.abs(off) }}
                  />
                )
              })
            ) : (
              <div className="scan-pending flex aspect-[2.5/3.5] h-[236px] items-center justify-center rounded-[8px]">
                <span className="data text-[9px]">aucune pièce en vente</span>
              </div>
            )}
          </div>
        </div>
      </PageContainer>

      {/* ── Onglets · outils · grille ───────────────────────────────────── */}
      <PageContainer as="section" id="cartes" className="pb-16 lg:pb-20">
        <Suspense fallback={<div className="mb-6 h-[104px]" />}>
          <SetToolbar
            rarities={uniqueRarities.slice(0, 10).map(r => ({ value: r, label: r }))}
            variants={(variants ?? []).map(v => ({ value: v.code, label: v.label }))}
            conditions={CONDITIONS.map(c => ({ value: c, label: c }))}
            sorts={SORTS}
          />
        </Suspense>

        <CardGrid
          listings={flat}
          emptyLabel={
            setData.card_count
              ? "Aucune carte de ce set n'est encore proposée à la vente."
              : 'Ce set ne contient aucune carte importée.'
          }
        />
      </PageContainer>
    </main>
  )
}
