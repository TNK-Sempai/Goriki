import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { Suspense } from 'react'
import PageContainer from '@/components/layout/PageContainer'
import CardGrid from '@/components/catalogue/CardGrid'
import type { CardEntry, VariantOption } from '@/components/catalogue/CardTile'
import SetToolbar from '@/components/catalogue/SetToolbar'
import SetVisual from '@/components/catalogue/SetVisual'
import { PaginationUrl } from '@/components/ui/Pagination'
import { chargerVariantes, estVendable, type LigneVariante } from '@/lib/catalogue/variantes'
import { rattachesDe } from '@/lib/catalogue/rattachements'
import { createClient } from '@/lib/supabase/server'
import { decouper, lirePage } from '@/lib/pagination'
import { resoudreParPage } from '@/lib/pagination.server'
import { UNIVERSES } from '@/lib/universe-theme'

const TABLES = {
  pokemon: { sets: 'pokemon_sets', cards: 'pokemon_cards', listings: 'pokemon_listings', variants: 'pokemon_variant_types' },
  onepiece: { sets: 'onepiece_sets', cards: 'onepiece_cards', listings: 'onepiece_listings', variants: 'onepiece_variant_types' },
} as const

const SORTS = [
  { value: 'num', label: 'N° croissant' },
  { value: 'num-desc', label: 'N° décroissant' },
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
 * Le visuel du hero est désormais le LOGO du set (`SetVisual`), avec repli sur
 * le symbole puis sur le cadre rayé. La substitution précédente — un éventail
 * des cartes les plus chères en vente — avait été actée quand `*_sets.image_url`
 * était NULL sur la totalité des sets. Ce n'est plus vrai : 121 des 185 sets
 * Pokémon portent un logo et 147 un symbole. One Piece n'en a aucun (0 sur 30)
 * et retombe donc sur le cadre.
 *
 * SETS RATTACHÉS (migration 0057). Un set rattaché n'a pas de page : son URL
 * redirige vers celle de son parent. La page du parent montre les cartes de
 * tout le groupe, celles de chaque rattaché en fin de liste, sous un
 * intertitre, quel que soit le tri choisi. La fiche technique compte le groupe
 * entier (30ᵉ Anniversaire : 161 + 30 = 191 cartes).
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

  // `symbol_url` n'existe QUE sur `pokemon_sets` : le demander à `onepiece_sets`
  // ferait échouer la requête entière. One Piece n'a de toute façon aucun visuel
  // de set en base (0 sur 30), il retombera sur le cadre.
  const colonnesSet =
    'id, code, name_fr, card_count, release_date, serie_name, image_url, display_parent_id' +
    (universe === 'pokemon' ? ', symbol_url' : '')

  const { data: setData } = await supabase
    .from(t.sets)
    .select(colonnesSet)
    .eq('id', setId)
    .single<{
      id: string
      code: string
      name_fr: string
      card_count: number | null
      release_date: string | null
      serie_name: string | null
      image_url: string | null
      symbol_url?: string | null
      display_parent_id: string | null
    }>()

  if (!setData) notFound()

  // Ancienne URL d'un set rattaché : on renvoie vers le parent, filtres compris.
  if (setData.display_parent_id) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(searchParams)) {
      if (typeof v === 'string') qs.set(k, v)
    }
    const suite = qs.toString()
    permanentRedirect(`/catalogue/${universe}/${setData.display_parent_id}${suite ? `?${suite}` : ''}`)
  }

  // Le groupe affiché : le set, puis ses rattachés. Son ordre est celui des
  // blocs de la grille.
  const rattaches = await rattachesDe(supabase, universe, setId)
  const idsGroupe = [setId, ...rattaches.map(r => r.id)]
  const rangDuSet = new Map(idsGroupe.map((id, i) => [id, i]))

  // Nombre de pièces réellement achetables dans ce set.
  // Depuis ARCHI-01, l'exemplaire Pokémon n'a plus de `card_id` : il rejoint la
  // carte par sa VARIANTE. One Piece garde le chemin direct.
  const comptePieces =
    universe === 'pokemon'
      ? supabase
          .from('pokemon_listings')
          .select('id, pokemon_card_variants!inner(pokemon_cards!inner(set_id))', {
            count: 'exact',
            head: true,
          })
          .eq('is_active', true)
          .gt('quantity', 0)
          .gt('price', 0)
          .in('pokemon_card_variants.pokemon_cards.set_id', idsGroupe)
      : supabase
          .from(t.listings)
          .select(`id, ${t.cards}!inner(set_id)`, { count: 'exact', head: true })
          .eq('is_active', true)
          .gt('quantity', 0)
          .gt('price', 0)
          .in(`${t.cards}.set_id`, idsGroupe)

  const [{ data: rarities }, { data: variants }, dispo] = await Promise.all([
    supabase.from(t.cards).select('rarity').in('set_id', idsGroupe).not('rarity', 'is', null),
    supabase.from(t.variants).select('code, label').or(`set_id.in.(${idsGroupe.join(',')}),set_id.is.null`),
    comptePieces,
  ])

  // ── La grille part des CARTES, jamais des listings ────────────────────────
  // `*_cards` contient TOUJOURS l'intégralité du set (import TCGdex / Poneglyphe).
  // Partir des listings ferait dépendre l'affichage du stock : on ne verrait
  // plus le set, on verrait l'inventaire. Le catalogue doit montrer le set
  // entier, les pièces qu'on ne vend pas comprises.
  let cardsQuery = supabase
    .from(t.cards)
    .select('id, set_id, number, name_fr, rarity, image_url')
    .in('set_id', idsGroupe)

  if (sp('rarity')) cardsQuery = cardsQuery.eq('rarity', sp('rarity')!)
  if (sp('q')) cardsQuery = cardsQuery.ilike('name_fr', `%${sp('q')}%`)

  const tri = sp('sort') ?? 'num'

  // ── Ordre naturel des numéros ─────────────────────────────────────────────
  // `pokemon_cards.number` est du TEXTE : trier dessus donne 1, 10, 100, 11…
  // et 1 854 numéros ne sont pas convertibles en entier (SV#, TG#, 103a…).
  // Les colonnes générées `sort_prefix` / `sort_num` (migration
  // `add_natural_sort_keys_pokemon_cards`, index dédié) portent déjà l'ordre
  // attendu : préfixe de sous-bloc — vide pour les numéros purs, donc set
  // principal d'abord — puis l'entier, puis le texte brut pour départager les
  // suffixes (103 < 103a). Le tri reste en base : le réimplémenter en JS
  // garantirait une divergence.
  // One Piece garde `number` : ses numéros sont zéro-paddés de format constant
  // (`OP01-001`) et ses tables n'ont pas ces colonnes.
  const colonnesNum = universe === 'pokemon' ? ['sort_prefix', 'sort_num', 'number'] : ['number']
  // Décroissant : les TROIS colonnes s'inversent, sinon l'ordre est incohérent.
  for (const col of colonnesNum) cardsQuery = cardsQuery.order(col, { ascending: tri !== 'num-desc' })

  // Borne large et volontaire : le plus gros set du catalogue compte 299 cartes.
  // On charge donc toujours le set entier, et les vignettes sont en `lazy`.
  // La borne s'entend par set du groupe.
  const { data: cartes } = await cardsQuery.limit(400 * idsGroupe.length)

  /** Bloc d'une carte dans la grille : 0 pour le set, 1… pour ses rattachés. */
  const blocDe = new Map((cartes ?? []).map(c => [c.id, rangDuSet.get(c.set_id) ?? 0]))

  const idsCartes = (cartes ?? []).map(c => c.id)

  // Les VARIANTES de ces cartes, avec leurs exemplaires. `chargerVariantes`
  // absorbe la différence de schéma entre les deux univers depuis ARCHI-01.
  const variantes = await chargerVariantes(supabase, universe, idsCartes)

  const parCarte = new Map<string, LigneVariante[]>()
  for (const v of variantes) {
    const groupe = parCarte.get(v.cardId)
    if (groupe) groupe.push(v)
    else parCarte.set(v.cardId, [v])
  }

  const filtreVariante = sp('variant')
  const filtreCondition = sp('condition')

  /** Le meilleur exemplaire vendable d'une variante, ou null. */
  const meilleurExemplaire = (v: LigneVariante) =>
    v.exemplaires
      .filter(estVendable)
      .filter(e => !filtreCondition || e.condition === filtreCondition)
      .sort((a, b) => a.price - b.price)[0] ?? null

  // ── Versions imprimées d'une carte ────────────────────────────────────────
  // 8 770 cartes Pokémon ont plusieurs variantes — 8 436 à deux versions,
  // 334 à trois. Le switch de la tuile les donne à voir sans dupliquer la tuile.
  //
  // PÉRIMÈTRE : Pokémon seulement. One Piece est en pause (nettoyage Poneglyphe
  // côté utilisateur) — il reçoit un tableau vide et sa tuile est inchangée.
  const gereVariantes = universe === 'pokemon'

  const versionsDe = (groupe: LigneVariante[], imageCarte: string | null): VariantOption[] => {
    if (!gereVariantes) return []

    return groupe
      .filter(v => !filtreVariante || v.code === filtreVariante)
      .slice()
      // Ordre du set : Normale avant Reverse avant les Ball, jamais l'ordre
      // d'arrivée des lignes en base.
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(v => {
        const retenue = meilleurExemplaire(v)
        return {
          code: v.code,
          label: v.label,
          // Le visuel appartient désormais à la VARIANTE ; le scan d'un
          // exemplaire précis prime quand il existe.
          imageUrl: retenue?.frontPhotoUrl ?? v.imageUrl ?? imageCarte,
          // L'URL de fiche produit porte la VARIANTE, pas l'exemplaire : elle
          // existe pour les 29 210 lignes et survit aux mouvements de stock.
          listingId: v.id,
          available: retenue !== null,
          price: retenue?.price ?? null,
          condition: retenue?.condition ?? null,
          quantity: retenue?.quantity ?? 0,
          hasRealScan: !!retenue?.frontPhotoUrl,
          // Ni scan d'exemplaire ni visuel propre à la variante : ce qui
          // s'affiche est l'illustration de la carte de base. 3 702 variantes
          // sur 29 210 sont dans ce cas — un affichage sur huit.
          imageEstRepli: !retenue?.frontPhotoUrl && !v.imageUrl && !!imageCarte,
        } satisfies VariantOption
      })
  }

  const entrees: CardEntry[] = (cartes ?? []).map(c => {
    const groupe = (parCarte.get(c.id) ?? [])
      .filter(v => !filtreVariante || v.code === filtreVariante)

    // La variante retenue pour l'état par défaut de la tuile : celle qui porte
    // l'exemplaire vendable le moins cher, sinon la première du set.
    const candidates = groupe
      .map(v => ({ v, e: meilleurExemplaire(v) }))
      .filter(x => x.e !== null)
      .sort((a, b) => a.e!.price - b.e!.price)

    const retenue = candidates[0]?.e ?? null
    const varianteRetenue = candidates[0]?.v ?? null
    const repli = [...groupe].sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null
    const source = varianteRetenue ?? repli

    return {
      cardId: c.id,
      number: c.number,
      name: c.name_fr,
      rarity: c.rarity,
      imageUrl: retenue?.frontPhotoUrl ?? source?.imageUrl ?? c.image_url ?? null,
      listingId: source?.id ?? null,
      available: retenue !== null,
      price: retenue?.price ?? null,
      condition: retenue?.condition ?? null,
      variantLabel: varianteRetenue?.label ?? null,
      quantity: retenue?.quantity ?? 0,
      hasRealScan: !!retenue?.frontPhotoUrl,
      variants: versionsDe(groupe, c.image_url),
    }
  })

  const disponiblesSeulement = sp('stock') === '1'
  const visibles = disponiblesSeulement ? entrees.filter(e => e.available) : entrees

  if (tri === 'name') {
    visibles.sort((a, b) => a.name.localeCompare(b.name))
  } else if (tri === 'price-desc' || tri === 'price-asc') {
    // Les indisponibles n'ont pas de prix : elles ferment la marche, quel que
    // soit le sens du tri.
    const signe = tri === 'price-asc' ? 1 : -1
    visibles.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1
      // `sort` est stable : renvoyer 0 conserve l'ordre naturel déjà établi par
      // la base. `localeCompare(number)` rejouait ici le tri lexicographique.
      if (!a.available) return 0
      return ((a.price ?? 0) - (b.price ?? 0)) * signe
    })
  }

  // Les rattachés ferment la marche, quel que soit le tri : `sort` est stable,
  // l'ordre choisi est donc conservé à l'intérieur de chaque bloc.
  if (rattaches.length > 0) {
    visibles.sort((a, b) => (blocDe.get(a.cardId) ?? 0) - (blocDe.get(b.cardId) ?? 0))
  }

  const nbDisponibles = entrees.filter(e => e.available).length

  // ── Pagination, en DERNIER ────────────────────────────────────────────────
  // `visibles` est déjà filtré (rareté, version, état, stock, recherche) et déjà
  // trié. On ne découpe qu'ici : découper avant filtrerait une tranche de 30
  // dont il ne resterait qu'une poignée d'éléments. 145 des 185 sets Pokémon
  // dépassent 30 cartes, 125 dépassent 50 — le plus gros en compte 299.
  const parPage = await resoudreParPage(searchParams)
  const tranche = decouper(visibles, lirePage(searchParams), parPage)

  const uniqueRarities = [...new Set((rarities ?? []).map(r => r.rarity).filter(Boolean))] as string[]

  // La page courante, découpée en blocs consécutifs du même set : chaque bloc
  // de rattaché reçoit son intertitre, y compris quand il ouvre une page.
  const blocs: { rang: number; cartes: CardEntry[] }[] = []
  for (const e of tranche.elements) {
    const rang = blocDe.get(e.cardId) ?? 0
    const dernier = blocs[blocs.length - 1]
    if (dernier && dernier.rang === rang) dernier.cartes.push(e)
    else blocs.push({ rang, cartes: [e] })
  }

  // Nombre de cartes du GROUPE : inconnu dès qu'un des sets ne l'annonce pas.
  const cartesAuSet = [setData.card_count, ...rattaches.map(r => r.card_count)]
    .reduce<number | null>((n, c) => (n === null || c === null ? null : n + c), 0)


  const sortie = setData.release_date
    ? new Date(setData.release_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const FICHE = [
    sortie ? { k: 'Sortie', v: sortie } : null,
    cartesAuSet ? { k: 'Cartes au set', v: String(cartesAuSet) } : null,
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

          {/* Logo du set → symbole → cadre rayé. L'éventail de cartes en vente
              qui occupait cette place datait d'une époque où AUCUN set n'avait
              de visuel en base ; 121 en ont un aujourd'hui. */}
          <SetVisual
            logoUrl={setData.image_url ?? null}
            symbolUrl={setData.symbol_url ?? null}
            setName={setData.name_fr}
          />
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

        <p className="data mb-4 text-[9px]">
          {/* Le compte annonce ce que la GRILLE montre, pas le résultat entier :
              dire « 299 cartes affichées » au-dessus de 30 vignettes serait faux. */}
          {tranche.total > tranche.elements.length
            ? `${tranche.premier}–${tranche.dernier} sur ${tranche.total} cartes`
            : `${visibles.length} carte${visibles.length > 1 ? 's' : ''} affichée${visibles.length > 1 ? 's' : ''}`}
          {' · '}
          {nbDisponibles} disponible{nbDisponibles > 1 ? 's' : ''}{' '}à l&apos;achat
        </p>

        {blocs.length === 0 ? (
          <CardGrid
            cards={[]}
            emptyLabel={
              disponiblesSeulement
                ? "Aucune carte de ce set n'est disponible à l'achat pour le moment."
                : 'Ce set ne contient aucune carte importée.'
            }
          />
        ) : (
          blocs.map(b => {
            const r = b.rang > 0 ? rattaches[b.rang - 1] : null
            return (
              <div key={b.rang} className={r ? 'hair mt-10 pt-8' : undefined}>
                {r && (
                  <h2 className="display-sub m-0 mb-5">
                    {r.name_fr}
                    <span className="data ml-2.5 text-[9px] text-ink-55">
                      {r.code}
                      {r.card_count ? ` · ${r.card_count} cartes` : ''}
                    </span>
                  </h2>
                )}
                <CardGrid cards={b.cartes} emptyLabel="" />
              </div>
            )
          })
        )}

        <Suspense fallback={<div className="mt-8 h-[52px]" />}>
          <PaginationUrl
            page={tranche.page}
            pages={tranche.pages}
            total={tranche.total}
            parPage={parPage}
            premier={tranche.premier}
            dernier={tranche.dernier}
            unite="carte"
            ancre="#cartes"
          />
        </Suspense>
      </PageContainer>
    </main>
  )
}
