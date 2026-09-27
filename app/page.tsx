import Link from 'next/link'
import Image from 'next/image'
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
 *      rail d'index à l'extrême gauche, bandeau de garanties en pied de hero.
 *      Depuis la mission NOVA, le visuel du hero n'est plus l'éventail de
 *      cartes mais l'illustration fournie par le propriétaire
 *      (`public/hero.webp`), posée en panneau plein derrière le manifeste.
 *      L'éventail de sets (`NouveautesHero`) est posé par-dessus, dans la
 *      moitié droite du panneau (sous le texte avant 1024 px).
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

/**
 * Une ligne de `nouveautes_achetables()` (migration 0058), telle quelle.
 *
 * `achetables` arrive en `bigint` : PostgREST le sérialise en NOMBRE quand il
 * tient dans un entier sûr, mais le type reste large côté base. On le repasse
 * par `Number` au moment de le lire plutôt que de le déclarer `number` ici et
 * de faire confiance à la sérialisation.
 */
interface SetNouveaute {
  universe: 'pokemon' | 'onepiece'
  set_id: string
  code: string
  name_fr: string
  release_date: string | null
  achetables: number | string
  images: string[] | null
}

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
    { data: setsNouveaute }] =
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
      // Nouveautés : les 2 sets les plus récents de CHAQUE univers parmi ceux
      // qui ont au moins une carte ACHETABLE. La sélection, le décompte et les
      // aperçus tiennent dans cet unique appel (migration 0058) : c'est un
      // classement par groupe, que PostgREST ne sait pas exprimer et qui aurait
      // demandé de rapatrier toutes les annonces en vente pour les regrouper
      // ici, au-dessus du plafond de 1 000 lignes qui tronque sans erreur.
      supabase.rpc('nouveautes_achetables'),
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


  // ── Nouveautés ────────────────────────────────────────────────────────────
  // Plus aucun calcul ici. Le regroupement par set, le report du stock d'un set
  // rattaché sur son parent, le décompte et le choix des trois aperçus se font
  // en base, sur les seules cartes achetables.
  //
  // CE QUI A CHANGÉ, ET POURQUOI. La vitrine retenait les 2 sets les plus
  // récents, en vente ou non : elle affichait « Bientôt » sur des sets vides et,
  // pour DP-12, dont les deux seules cartes sont des DON!!, le filigrane SAMPLE
  // de l'éditeur. La sélection porte désormais sur les sets réellement
  // achetables, et l'aperçu est pris parmi leurs seules cartes en vente.
  //
  // Parité 2+2 quand elle est possible, jamais compensée : un univers sans set
  // achetable ne cède pas sa place à l'autre, il ne paraît simplement pas.
  //
  // L'ordre d'affichage reste Pokémon d'abord, comme avant : la fonction rend
  // ses lignes par univers alphabétique, ce tri de deux à quatre éléments le
  // rétablit sans faire dépendre une décision de présentation d'une migration.
  const ORDRE_UNIVERS = { pokemon: 0, onepiece: 1 } as const

  const nouveautes: Nouveaute[] = ((setsNouveaute ?? []) as SetNouveaute[])
    .slice()
    .sort((a, b) => ORDRE_UNIVERS[a.universe] - ORDRE_UNIVERS[b.universe])
    .map(r => ({
    setId: r.set_id,
    universe: r.universe,
    code: r.code,
    name: r.name_fr,
    releaseDate: r.release_date,
    images: r.images ?? [],
    dispo: Number(r.achetables ?? 0),
  }))

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
        <PageContainer as="section" className="relative pb-9 pt-6 lg:pb-14 lg:pt-8">
          {/* Rail d'index : numérotation de planche, à l'extrême gauche. */}
          <div className="pointer-events-none absolute left-4 top-[38%] hidden flex-col items-center gap-2.5 2xl:flex">
            <span className="data text-[9px] text-ink-55">01</span>
            <span className="h-1.5 w-1.5 rounded-full bg-ochre" />
            <span className="h-1.5 w-1.5 rounded-full bg-[rgba(26,22,17,0.18)]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[rgba(26,22,17,0.18)]" />
          </div>

          {/* Panneau illustré. L'image remplace l'éventail de cartes qui tenait
              la colonne droite : c'est un panorama, il perdrait tout son sens
              recadré dans une demi-colonne. Le manifeste passe donc AU-DESSUS,
              sur la moitié gauche, et le voile directionnel (`.voile-hero`)
              garantit son contraste sans éteindre la cité de droite.
              `isolate` : l'image et le voile sont en `-z-10`, l'isolation les
              enferme dans ce panneau au lieu de les envoyer sous la page.

              Le panneau sort de la gouttière sous 1024 px (`-mx-5 sm:-mx-8`) et
              la rétablit lui-même en padding interne. Ce n'est pas un effet de
              style : le manifeste est composé en trois lignes INSÉCABLES, et la
              plus longue mesure 331 px à la taille mobile du titre. Sans ce
              débord, la gouttière de la page et le padding du panneau se
              cumuleraient et la troisième ligne serait rognée à 390 px. Le
              texte retrouve ainsi exactement la largeur qu'il avait avant cette
              mission, et l'illustration passe bord à bord. */}
          <div className="relative isolate -mx-5 flex min-h-[420px] flex-col overflow-hidden lg:flex-row border-0 shadow-none sm:-mx-8 lg:mx-0 lg:min-h-[560px] lg:rounded-hero lg:border lg:border-[rgba(255,255,255,0.55)] lg:shadow-[0_28px_70px_-40px_rgba(26,22,17,0.45)]">
            <Image
              src="/hero.webp"
              alt="Trois voyageurs sur un promontoire de cartes géantes, face à une cité flottante"
              fill
              priority
              sizes="(min-width: 64rem) 1200px, 100vw"
              className="-z-10 object-cover object-[50%_55%]"
            />
            {/* `sizes` plafonné à 1200 px au-delà de 1024 px, et non à la
                largeur réelle du panneau (1328 px à 1440) : la source ne fait
                que 1672 px de large, demander le palier supérieur ferait
                AGRANDIR l'image par l'optimiseur, pour un fichier plus lourd et
                aucun détail de plus. Le navigateur étire 1200 en 1328, soit 10 %
                sur une aquarelle déjà voilée. 64rem = le point `lg` du design
                system, le même que celui du wallpaper. */}
            {/* Voile directionnel, sur tout le panneau à partir de 1024 px
                seulement. En dessous, il est porté par la colonne de texte
                (voir plus bas) pour ne pas recouvrir l'éventail. */}
            <div aria-hidden="true" className="voile-hero absolute inset-0 -z-10 hidden lg:block" />

            {/* `pt-32` sous 1024 px : la bande haute laissée à découvert par le
                voile. C'est la seule façon de montrer l'illustration sur un
                écran étroit, où le texte prend toute la largeur. */}
            <div className="relative flex flex-col px-5 pb-10 pt-32 sm:px-8 lg:w-[46%] lg:shrink-0 lg:self-center lg:px-12 lg:pb-14 lg:pt-14">
              {/* Sous 1024 px, le voile vertical couvre la colonne de texte et
                  s'arrête avec elle : ses arrêts en pixels et ses pourcentages
                  se calculent sur la même hauteur qu'avant, le texte garde donc
                  exactement son contraste. Pas de `z-index` sur la colonne :
                  ce `-z-10` reste dans le contexte isolé du panneau, au-dessus
                  de l'image qui le précède. */}
              <div aria-hidden="true" className="voile-hero absolute inset-0 -z-10 lg:hidden" />
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

            {/* Nouveautés : l'éventail de sets, posé SUR l'illustration, dans la
                moitié droite (sous le texte avant 1024 px). Aucun encadré, les
                cartes sont dans l'espace. `.voile-nouveautes` n'éclaircit que
                la zone du cartouche de set et de sa navigation, l'illustration
                reste visible autour des cartes.

                RIEN N'EST RENDU s'il n'y a aucun set achetable. Le bloc n'est
                pas vidé, il est absent : la colonne de texte garde ses 46 % et
                l'illustration occupe le reste, exactement comme le hero avant
                que la vitrine y revienne. Un conteneur conservé aurait réservé
                sa place en `flex-1` et laissé une zone vide au milieu du
                panneau, ce que le composant ne pouvait pas remplir puisqu'il
                n'a rien à montrer. */}
            {nouveautes.length > 0 && (
              <div className="relative flex flex-1 items-center justify-center px-5 pb-8 sm:px-8 lg:px-6 lg:py-6">
                <div aria-hidden="true" className="voile-nouveautes absolute inset-0 -z-10" />
                <div className="w-full">
                  <NouveautesHero sets={nouveautes} />
                </div>
              </div>
            )}
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
