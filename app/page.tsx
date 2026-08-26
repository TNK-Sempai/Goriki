import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import PageContainer from '@/components/layout/PageContainer'
import NouveautesHero, { type Nouveaute } from '@/components/home/NouveautesHero'
import Reveal from '@/components/motion/Reveal'
import Magnetic from '@/components/motion/Magnetic'
import CardCursor from '@/components/motion/CardCursor'
import { createClient } from '@/lib/supabase/server'
import { prixDepuis, prixOuEpuise } from '@/lib/utils'
import { PHOTO_PRICE_THRESHOLD } from '@/lib/constants'

/**
 * Accueil — case 1 de la planche de référence.
 *
 * Composition imposée par la planche, dans cet ordre :
 *   1. Hero asymétrique : manifeste typographique à gauche (3 lignes capitales),
 *      éventail de cartes + rose des vents à droite, rail d'index à l'extrême
 *      gauche, bandeau de garanties en pied de hero.
 *   2. Bande double : « Derniers arrivages » (rangée de 5) | « Pièces à
 *      inspecter » (mise en avant d'une pièce scannée).
 *   3. Rangée de 5 tuiles de rayon, visuel débordant à droite de chaque tuile.
 *   4. Rangée de 4 panneaux de service.
 *
 * Divergences assumées vis-à-vis de l'image, faute de donnée réelle :
 * la planche affiche des variations de cote (« +12,4 % ») et deux sparklines
 * « Marché ». Goriki n'a AUCUN historique de prix en base ; `price_cm` existe
 * mais est admin-only. Ces blocs sont remplacés par des indicateurs de
 * catalogue réels, à masse visuelle identique.
 */

export const dynamic = 'force-dynamic'

interface ListingRow {
  id: string
  price: number
  quantity: number
  condition: string | null
  image_api: string | null
  front_photo_url: string | null
  created_at: string
  cards: { name_fr: string; number: string; rarity: string | null } | null
  /**
   * Chemin Pokémon depuis ARCHI-01 : l'exemplaire ne connaît plus la carte
   * directement, il passe par sa variante — qui porte aussi le visuel.
   * One Piece conserve le chemin direct via `cards`.
   */
  pokemon_card_variants?:
    | {
        id: string
        image_url: string | null
        cards: { name_fr: string; number: string; rarity: string | null } | null
      }
    | {
        id: string
        image_url: string | null
        cards: { name_fr: string; number: string; rarity: string | null } | null
      }[]
    | null
}

/** Les jointures Supabase peuvent remonter des tableaux — cf. CLAUDE.md. */
function flatten<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

interface Piece {
  id: string
  name: string
  ref: string
  rarity: string | null
  price: number
  quantity: number
  condition: string | null
  imageUrl: string | null
}

function toPiece(row: ListingRow): Piece {
  const variante = flatten(row.pokemon_card_variants ?? null)
  const card = flatten(variante?.cards ?? row.cards)
  return {
    // L'id exposé est celui de la VARIANTE quand elle existe : c'est lui qui
    // sert d'URL de fiche produit.
    id: variante?.id ?? row.id,
    name: card?.name_fr ?? 'Carte',
    ref: card?.number ?? '—',
    rarity: card?.rarity ?? null,
    price: row.price,
    quantity: row.quantity,
    condition: row.condition,
    imageUrl: row.front_photo_url ?? variante?.image_url ?? row.image_api,
  }
}

const SELECT =
  'id, price, quantity, condition, image_api, front_photo_url, created_at, cards:onepiece_cards!inner(name_fr, number, rarity)'
// Depuis ARCHI-01 : exemplaire → variante → carte. Le visuel vient de la
// variante (`image_url`, généré), le scan de l'exemplaire quand il existe.
const SELECT_PKM =
  'id, price, quantity, condition, front_photo_url, created_at, ' +
  'pokemon_card_variants!inner(id, image_url, cards:pokemon_cards!inner(name_fr, number, rarity))'

/** Garanties du pied de hero — reprises littéralement de la planche. */
const GARANTIES = [
  { t: 'Cartes 100 % authentifiées', s: 'Scannées recto-verso' },
  { t: 'Inspection premium', s: 'Avant chaque achat' },
  { t: 'Expédition sécurisée', s: 'Emballage renforcé' },
]

export default async function HomePage() {
  const supabase = await createClient()

  const [{ data: opTop }, { data: opNew }, { data: pkmNew }, opCards, pkmCards, opDispo, pkmDispo, scelles, depots,
    { data: apercusOp }, { data: apercusPkm }, { data: scelleVisuels },
    { data: recentsPkm }, { data: recentsOp }] =
    await Promise.all([
      supabase.from('onepiece_listings').select(SELECT).eq('is_active', true).gt('quantity', 0).gt('price', 0).order('price', { ascending: false }).limit(4),
      supabase.from('onepiece_listings').select(SELECT).eq('is_active', true).gt('quantity', 0).gt('price', 0).order('created_at', { ascending: false }).order('price', { ascending: false }).limit(6),
      supabase.from('pokemon_listings').select(SELECT_PKM).eq('is_active', true).gt('quantity', 0).gt('price', 0).order('created_at', { ascending: false }).order('price', { ascending: false }).limit(6),
      supabase.from('onepiece_cards').select('id', { count: 'exact', head: true }),
      supabase.from('pokemon_cards').select('id', { count: 'exact', head: true }),
      supabase.from('onepiece_listings').select('id', { count: 'exact', head: true }).eq('is_active', true).gt('quantity', 0).gt('price', 0),
      supabase.from('pokemon_listings').select('id', { count: 'exact', head: true }).eq('is_active', true).gt('quantity', 0).gt('price', 0),
      supabase.from('sealed_products').select('id', { count: 'exact', head: true }).eq('is_active', true).gt('quantity', 0),
      supabase.from('consignment_items').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      // Visuels de REPLI, tirés du catalogue et non du stock : les tuiles de
      // rayon sont de la décoration, elles ne doivent pas se vider quand rien
      // n'est à vendre (fonction `apercus_de_set`, migration 0031).
      supabase.rpc('apercus_de_set', { p_universe: 'onepiece' }),
      supabase.rpc('apercus_de_set', { p_universe: 'pokemon' }),
      // Les visuels du rayon Scellés. Trois demandés, mais la base n'en contient
      // qu'UN aujourd'hui (une seule ligne dans `sealed_products`) : l'éventail
      // se réduit à ce qui existe, il ne se complète pas avec des cartes.
      supabase.from('sealed_products').select('image_url').eq('is_active', true)
        .gt('quantity', 0).not('image_url', 'is', null).limit(3),
      // Nouveautés du hero : les 2 sets les plus récents de CHAQUE univers,
      // classés dans leur propre univers. La parité 2+2 est structurelle — on
      // ne compense jamais un univers avec l'autre.
      supabase.from('pokemon_sets').select('id, code, name_fr, release_date')
        .eq('is_active', true).not('release_date', 'is', null)
        .order('release_date', { ascending: false }).limit(2),
      supabase.from('onepiece_sets').select('id, code, name_fr, release_date')
        .eq('is_active', true).not('release_date', 'is', null)
        .order('release_date', { ascending: false }).limit(2),
    ])

  const top = ((opTop ?? []) as unknown as ListingRow[]).map(toPiece)

  // « Derniers arrivages » : les deux univers mêlés, les plus récents d'abord.
  const arrivages = [
    ...((opNew ?? []) as unknown as ListingRow[]),
    ...((pkmNew ?? []) as unknown as ListingRow[]),
  ]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .map(toPiece)
    .slice(0, 5)

  // « Pièce à inspecter » : la plus valorisée au-dessus du seuil de scan réel.
  const inspect = top.find(p => p.price >= PHOTO_PRICE_THRESHOLD && p.imageUrl) ?? top[0] ?? null

  const n = (v: number | null | undefined) => (v ?? 0).toLocaleString('fr-FR')

  // Visuels de repli : les cartes les plus rares du catalogue, stock ou non.
  // On ne garde que le `rang = 1` de chaque set — la rareté la moins fréquente
  // du set (migration 0031) — pour que l'éventail d'une tuile montre trois
  // cartes prestigieuses de sets DIFFÉRENTS, et non trois cartes du même set.
  const plusRares = (rows: unknown) =>
    ((rows ?? []) as { image_url: string; rang: number }[])
      .filter(a => Number(a.rang) === 1)
      .map(a => a.image_url)
  const replisOp = plusRares(apercusOp)
  const replisPkm = plusRares(apercusPkm)


  // ── Nouveautés du hero ────────────────────────────────────────────────────
  // Un aperçu par set : la carte la plus rare, comme les tuiles de catalogue.
  // Jusqu'à trois visuels par set : l'éventail du hero en montre trois, la plus
  // rare en tête (`rang` croissant).
  const apercuParSet = new Map<string, string[]>()
  const tousApercus = [
    ...((apercusOp ?? []) as { set_id: string; image_url: string; rang: number }[]),
    ...((apercusPkm ?? []) as { set_id: string; image_url: string; rang: number }[]),
  ].sort((a, b) => Number(a.rang) - Number(b.rang))
  for (const a of tousApercus) {
    const liste = apercuParSet.get(a.set_id)
    if (liste) { if (liste.length < 3) liste.push(a.image_url) }
    else apercuParSet.set(a.set_id, [a.image_url])
  }

  interface SetRecent { id: string; code: string; name_fr: string; release_date: string | null }

  const enNouveaute = (
    rows: SetRecent[] | null,
    universe: 'pokemon' | 'onepiece',
    dispoParSet: Map<string, number>,
  ): Nouveaute[] =>
    (rows ?? []).map(r => ({
      setId: r.id,
      universe,
      code: r.code,
      name: r.name_fr,
      releaseDate: r.release_date,
      images: apercuParSet.get(r.id) ?? [],
      dispo: dispoParSet.get(r.id) ?? 0,
    }))

  // Stock réel des sets mis en avant — affiché tel quel, zéro compris.
  const idsMisEnAvant = [
    ...((recentsPkm ?? []) as SetRecent[]).map(r => r.id),
    ...((recentsOp ?? []) as SetRecent[]).map(r => r.id),
  ]

  const dispoPkm = new Map<string, number>()
  const dispoOp = new Map<string, number>()
  if (idsMisEnAvant.length > 0) {
    const [{ data: sPkm }, { data: sOp }] = await Promise.all([
      supabase.from('pokemon_listings')
        .select('id, pokemon_cards!inner(set_id)')
        .eq('is_active', true).gt('quantity', 0).gt('price', 0)
        .in('pokemon_cards.set_id', ((recentsPkm ?? []) as SetRecent[]).map(r => r.id)),
      supabase.from('onepiece_listings')
        .select('id, onepiece_cards!inner(set_id)')
        .eq('is_active', true).gt('quantity', 0).gt('price', 0)
        .in('onepiece_cards.set_id', ((recentsOp ?? []) as SetRecent[]).map(r => r.id)),
    ])
    const compter = (rows: unknown[] | null, cle: string, cible: Map<string, number>) => {
      for (const row of (rows ?? []) as Record<string, unknown>[]) {
        const c = row[cle]
        const carte = (Array.isArray(c) ? c[0] : c) as { set_id: string } | undefined
        if (carte) cible.set(carte.set_id, (cible.get(carte.set_id) ?? 0) + 1)
      }
    }
    compter(sPkm, 'pokemon_cards', dispoPkm)
    compter(sOp, 'onepiece_cards', dispoOp)
  }

  // Parité 2+2 : Pokémon d'abord, puis One Piece, jamais l'un à la place de l'autre.
  const nouveautes: Nouveaute[] = [
    ...enNouveaute(recentsPkm as SetRecent[] | null, 'pokemon', dispoPkm),
    ...enNouveaute(recentsOp as SetRecent[] | null, 'onepiece', dispoOp),
  ]

  // Chaque tuile de rayon porte un petit éventail au lieu d'un visuel isolé.
  // On sert d'abord les visuels RÉELS du rayon, puis on complète avec le
  // catalogue — et jamais deux fois le même visuel d'une tuile à l'autre,
  // sinon la rangée donne l'impression d'un seul et même rayon répété.
  const dejaServis = new Set<string>()
  const eventail = (...sources: (string | null | undefined)[]) => {
    const out: string[] = []
    for (const src of sources) {
      if (!src || dejaServis.has(src)) continue
      out.push(src)
      dejaServis.add(src)
      if (out.length === 3) break
    }
    return out
  }

  const visuelsScelles = ((scelleVisuels ?? []) as { image_url: string }[]).map(s => s.image_url)

  const RAYONS = [
    { name: 'One Piece', sub: `${n(opDispo.count)} pièces disponibles`, href: '/catalogue/onepiece', imgs: eventail(...top.map(p => p.imageUrl), ...replisOp) },
    { name: 'Pokémon', sub: `${n(pkmDispo.count)} pièces disponibles`, href: '/catalogue/pokemon', imgs: eventail(...arrivages.map(a => a.imageUrl), ...replisPkm) },
    // Un seul scellé existe en base : cet éventail-là n'aura qu'une carte tant
    // que le rayon n'est pas rempli. On ne le complète pas avec des singles.
    { name: 'Scellés', sub: `${n(scelles.count)} référence${(scelles.count ?? 0) > 1 ? 's' : ''}`, href: '/catalogue/scelles', imgs: eventail(...visuelsScelles) },
    // Aucun dépôt actif en base : le visuel est donc du catalogue, pas de la
    // communauté. Décoration assumée, comme avant cette mission.
    { name: 'Dépôt-vente', sub: `${n(depots.count)} pièces de la communauté`, href: '/depot-vente', imgs: eventail(...replisOp, ...replisPkm) },
    { name: 'Tout le catalogue', sub: 'Les deux univers', href: '/catalogue', imgs: eventail(...replisPkm, ...replisOp) },
  ]

  return (
    <>
      <SiteHeader />
      <CardCursor />

      <main className="font-grotesk text-ink">
        {/* ── 1. Hero ─────────────────────────────────────────────────── */}
        <PageContainer as="section" className="relative pb-9 pt-12 lg:pb-14 lg:pt-16">
          {/* Rail d'index : numérotation de planche, à l'extrême gauche. */}
          <div className="pointer-events-none absolute left-4 top-[38%] hidden flex-col items-center gap-2.5 2xl:flex">
            <span className="data text-[9px] text-ink-55">01</span>
            <span className="h-1.5 w-1.5 rounded-full bg-ochre" />
            <span className="h-1.5 w-1.5 rounded-full bg-[rgba(26,22,17,0.18)]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[rgba(26,22,17,0.18)]" />
          </div>

          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,46fr)_minmax(0,54fr)] lg:gap-6">
            <div className="flex flex-col">
              <span className="data mb-6 text-[9px] text-ink-55 lg:mb-8">
                Maison de vente — cartes à collectionner
              </span>

              {/* Trois lignes, exactement comme la planche : chaque ligne est
                  insecable, le retour est decide ici et jamais par le navigateur. */}
              <h1 className="display-hero m-0 flex flex-col">
                <span className="whitespace-nowrap">Les cartes</span>
                <span className="whitespace-nowrap">ne sont pas</span>
                <span className="whitespace-nowrap">
                  des miniatures<span className="text-ochre">.</span>
                </span>
              </h1>

              <p className="m-0 mt-6 max-w-[38ch] text-[15px] leading-[1.62] text-ink-70 lg:mt-7 lg:text-[16px]">
                Chaque carte au-dessus d&apos;un euro est scannée recto-verso, authentifiée
                et passe entre nos mains avant d&apos;arriver chez vous.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3 lg:mt-9">
                <Magnetic>
                  <Link
                    href="/catalogue/onepiece"
                    className="btn-ochre inline-flex items-center gap-2.5 px-6 py-3.5 font-mono text-[11px] uppercase tracking-[0.14em]"
                  >
                    Explorer One Piece <span aria-hidden>→</span>
                  </Link>
                </Magnetic>
                <Link
                  href="/catalogue/pokemon"
                  className="btn-ghost inline-flex items-center gap-2.5 px-6 py-3.5 font-mono text-[11px] uppercase tracking-[0.14em]"
                >
                  Voir Pokémon <span aria-hidden>→</span>
                </Link>
              </div>

              {/* Bandeau de garanties : rangée FINE en pied de hero, pas quatre
                  grosses cartes de verre reléguées en bas de page. */}
              <ul className="m-0 mt-9 flex list-none flex-wrap gap-x-8 gap-y-4 lg:mt-12">
                {GARANTIES.map(g => (
                  <li key={g.t} className="flex items-start gap-2.5">
                    <span
                      aria-hidden
                      className="mt-[3px] h-3 w-3 shrink-0 rotate-45 border border-[rgba(26,22,17,0.42)]"
                    />
                    <span className="flex flex-col leading-tight">
                      <span className="text-[12px] font-medium text-ink">{g.t}</span>
                      <span className="text-[11px] text-ink-55">{g.s}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <NouveautesHero sets={nouveautes} />
          </div>
        </PageContainer>

        {/* ── 2. Derniers arrivages | Pièce à inspecter ────────────────── */}
        <PageContainer as="section" className="pb-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,53fr)_minmax(0,47fr)]">
            <div className="glass rounded-panel-lg p-5 lg:p-6">
              <div className="mb-5 flex items-baseline justify-between gap-4">
                <h2 className="display-sub m-0">
                  Derniers arrivages
                  <span className="data ml-2.5 text-[9px] text-ink-55">
                    {arrivages.length} nouvelles pièces
                  </span>
                </h2>
                <Link href="/catalogue" className="data shrink-0 text-[9px] hover:text-ochre">
                  Voir tout →
                </Link>
              </div>

              {arrivages.length > 0 ? (
                <Reveal className="grid grid-cols-3 gap-3 sm:grid-cols-5" stagger={0.05} y={12}>
                  {arrivages.map(p => (
                    <Link key={p.id} href={`/${p.id}`} data-card-hover className="group flex flex-col">
                      <div className="relative mb-2 aspect-[2.5/3.5] overflow-hidden rounded-[10px] shadow-[0_10px_22px_-12px_rgba(26,22,17,0.45)]">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- vignette dense, pas de wrapper next/image ici
                          <img src={p.imageUrl} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <div className="scan-pending h-full w-full" />
                        )}
                      </div>
                      <span className="data text-[8px] text-ink-55">{p.ref}</span>
                      <span className="line-clamp-1 text-[12px] font-medium leading-tight text-ink">{p.name}</span>
                      <span className="mt-1 text-[13px] font-semibold text-ink">{prixDepuis(p.price)}</span>
                    </Link>
                  ))}
                </Reveal>
              ) : (
                <p className="m-0 text-[13px] text-ink-70">
                  Le stock est en cours de saisie. Les premières pièces apparaîtront ici.
                </p>
              )}
            </div>

            <div className="glass relative overflow-hidden rounded-panel-lg p-5 lg:p-6">
              <div className="mb-5 flex items-baseline justify-between gap-4">
                <h2 className="display-sub m-0">
                  Pièce à inspecter
                  <span className="data ml-2.5 text-[9px] text-ink-55">Scan HD</span>
                </h2>
                <Link href="/catalogue" className="data shrink-0 text-[9px] hover:text-ochre">
                  Voir tout →
                </Link>
              </div>

              {inspect ? (
                <div className="flex items-center gap-5">
                  <Link
                    href={`/${inspect.id}`}
                    data-card-hover
                    className="block w-[108px] shrink-0 overflow-hidden rounded-[10px] shadow-[0_16px_30px_-14px_rgba(26,22,17,0.5)]"
                  >
                    {inspect.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- vignette dense
                      <img src={inspect.imageUrl} alt={inspect.name} className="aspect-[2.5/3.5] w-full object-cover" />
                    ) : (
                      <div className="scan-pending aspect-[2.5/3.5] w-full" />
                    )}
                  </Link>

                  <div className="flex min-w-0 flex-col">
                    <span className="text-[15px] font-semibold leading-tight text-ink">{inspect.name}</span>
                    <span className="data mt-1 text-[9px] text-ink-55">
                      {inspect.rarity ?? 'Carte'} · {inspect.ref}
                    </span>
                    <span className="mt-3 text-[26px] font-semibold leading-none text-ink">
                      {prixOuEpuise(inspect.price)}
                    </span>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/${inspect.id}`}
                        className="rounded-control border border-[rgba(26,22,17,0.16)] bg-[rgba(255,255,255,0.6)] px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink transition-colors hover:bg-white"
                      >
                        Inspecter
                      </Link>
                      <span className="data rounded-control border border-[rgba(26,22,17,0.12)] px-3 py-2.5 text-[9px]">
                        360°
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="m-0 text-[13px] text-ink-70">
                  Aucune pièce scannée en vitrine pour le moment.
                </p>
              )}

              <span className="pointer-events-none absolute bottom-4 right-5 hidden text-[12px] italic text-ink-55 lg:block">
                Cliquez pour inspecter
              </span>
            </div>
          </div>
        </PageContainer>

        {/* ── 3. Rayons ───────────────────────────────────────────────── */}
        <PageContainer as="section" className="pb-4">
          <Reveal className="grid grid-cols-2 gap-4 lg:grid-cols-5" stagger={0.07} y={16}>
            {RAYONS.map(r => (
              <Link
                key={r.href}
                href={r.href}
                className="glass glass-hoverable relative flex h-[132px] flex-col justify-between overflow-hidden rounded-panel-lg p-4 transition-colors"
              >
                {/* Éventail débordant à droite de la tuile — traitement produit
                    de la planche : les cartes sortent du cadre, elles ne sont
                    pas posées bien au centre d'une vignette.
                    Même formule que les tuiles de set (`off` × écartement,
                    `off` × rotation, `zIndex: 3 − off`), à l'échelle réduite de
                    ces tuiles. Empilement simple : ni flou ni profondeur 3D,
                    ces 132 px ne sont pas le hero. La carte de tête garde
                    exactement la position et l'inclinaison qu'elle avait ;
                    les suivantes viennent DERRIÈRE elle. */}
                {r.imgs.map((src, i) => {
                  const off = r.imgs.length - 1 - i // 0 = carte de tête
                  return (
                    // eslint-disable-next-line @next/next/no-img-element -- éventail décoratif recadré en débord
                    <img
                      key={src}
                      src={src}
                      alt=""
                      aria-hidden
                      loading="lazy"
                      className="pointer-events-none absolute -bottom-3.5 h-[104px] rounded-[6px] object-cover shadow-[0_14px_26px_-12px_rgba(26,22,17,0.5)]"
                      style={{
                        right: -20 + off * 22,
                        transform: `rotate(${9 - off * 7}deg)`,
                        zIndex: 3 - off,
                        opacity: 0.9 - off * 0.12,
                      }}
                    />
                  )
                })}
                <div className="relative">
                  <span className="display-sub block">{r.name}</span>
                  <span className="mt-1.5 block max-w-[56%] text-[11px] leading-tight text-ink-55">{r.sub}</span>
                </div>
                <span className="data relative text-[9px]">Voir →</span>
              </Link>
            ))}
          </Reveal>
        </PageContainer>

        {/* ── 4. Services ─────────────────────────────────────────────── */}
        <PageContainer as="section" className="pb-16 lg:pb-20">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="glass-light flex flex-col rounded-panel p-5">
              <span className="data text-[9px]">Catalogue One Piece</span>
              <span className="mt-3 text-[24px] font-semibold leading-none text-ink">{n(opCards.count)}</span>
              <span className="mt-1.5 text-[11px] text-ink-55">cartes indexées</span>
              <span className="mt-auto pt-4 text-[12px] text-ink-70">{n(opDispo.count)} en vente</span>
            </div>

            <div className="glass-light flex flex-col rounded-panel p-5">
              <span className="data text-[9px]">Catalogue Pokémon</span>
              <span className="mt-3 text-[24px] font-semibold leading-none text-ink">{n(pkmCards.count)}</span>
              <span className="mt-1.5 text-[11px] text-ink-55">cartes indexées</span>
              <span className="mt-auto pt-4 text-[12px] text-ink-70">{n(pkmDispo.count)} en vente</span>
            </div>

            <Link href="/want-to-buy" className="glass-light glass-hoverable flex flex-col rounded-panel p-5 transition-colors">
              <span className="data text-[9px]">Want to Buy</span>
              <span className="mt-3 max-w-[24ch] text-[13px] leading-[1.5] text-ink">
                Voyez ce que la communauté recherche, et signalez les pièces que vous cherchez.
              </span>
              <span className="data mt-auto pt-4 text-[9px]">Voir le radar →</span>
            </Link>

            <Link href="/rachat" className="glass-light glass-hoverable flex flex-col rounded-panel p-5 transition-colors">
              <span className="data text-[9px]">Rachat</span>
              <span className="mt-3 max-w-[24ch] text-[13px] leading-[1.5] text-ink">
                Estimation rapide de vos cartes, offre détaillée, paiement sous 72 h.
              </span>
              <span className="data mt-auto pt-4 text-[9px]">Estimer →</span>
            </Link>
          </div>
        </PageContainer>
      </main>

      <SiteFooter />
    </>
  )
}
