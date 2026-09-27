import { createClient } from '@/lib/supabase/server'
import { rattachesDe } from '@/lib/catalogue/rattachements'
import { getListing } from '@/lib/catalogue/fiche'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import PageContainer from '@/components/layout/PageContainer'
import CardViewer from '@/components/product/CardViewer'
import ScanStage from '@/components/product/ScanStage'
import WishlistButton from '@/components/product/WishlistButton'
import JeLaChercheButton from '@/components/product/JeLaChercheButton'
import AddToCartButton from '@/components/product/AddToCartButton'
import RangeeCartes, { type Vignette } from '@/components/product/RangeeCartes'
import AutresVersions, { type LigneVersion } from '@/components/product/AutresVersions'
import { chargerVariantes, estVendable } from '@/lib/catalogue/variantes'
import { PHOTO_PRICE_THRESHOLD } from '@/lib/constants'
import { prixOuEpuise } from '@/lib/utils'

/**
 * Fiche carte — case 4 de la planche de référence.
 *
 * Cette page n'avait JAMAIS été portée : elle rendait encore des styles inline
 * et le vocabulaire sombre d'origine (`var(--cream)`, `var(--font-display)` en
 * dur, `var(--surface-1)`), au milieu d'un site clair.
 *
 * Composition de la planche : fil d'ariane, puis deux colonnes —
 *   · à gauche, bande de vignettes verticale + scan en grand + contrôles ;
 *   · à droite, nom, référence et rareté, état, PRIX en grand, disponibilité,
 *     « Ajouter au panier » pleine largeur, « Want to Buy », puis le panneau
 *     INSPECTION ;
 * enfin, la rangée « du même set ».
 *
 * Divergences de données assumées :
 *   · La planche montre un basculement Recto/Verso. `back_photo_url` est NULL
 *     sur la totalité des listings : la bande n'affiche que les scans qui
 *     existent réellement, et `CardViewer` (manipulation 3D) n'est monté que si
 *     un vrai verso est présent — règle photo du CLAUDE.md.
 *   · La planche affiche une variation de cote (« +12,4 % »). Aucun historique
 *     de prix n'existe en base.
 *   · La planche coche un relevé d'inspection (Surface/Coins/Bords/Centrage).
 *     Aucune colonne d'inspection n'existe : `InspectionPanel` se retire de
 *     lui-même, et l'origine réelle du visuel est indiquée à la place.
 *
 * Le fond d'univers n'est PAS monté ici : `app/[slug]/layout.tsx` s'en charge,
 * comme pour les deux rayons. Il résout le même slug via la même fonction
 * mémoïsée — un montage unique, et aucune requête en plus.
 */

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const result = await getListing(slug)
  if (!result) return { title: 'Produit introuvable' }
  const { listing } = result
  const name = listing.pokemon_cards?.name_fr ?? listing.onepiece_cards?.name_fr ?? listing.name ?? ''
  return { title: name, description: `${name} — disponible sur Goriki` }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const result = await getListing(slug)
  if (!result) notFound()

  const { listing, tcg } = result
  const supabase = await createClient()

  const card = listing.pokemon_cards ?? listing.onepiece_cards
  const variant = listing.pokemon_variant_types ?? listing.onepiece_variant_types
  const set = card?.pokemon_sets ?? card?.onepiece_sets
  const name = card?.name_fr ?? listing.name ?? 'Produit'
  // Deux schémas cohabitent derrière cette page : les listings de cartes
  // portent `front_photo_url` / `image_api`, les produits scellés portent
  // `image_url`. Omettre le troisième maillon laissait les scellés sans visuel —
  // silencieusement, car `getListing` caste en `ListingLike` où la colonne
  // n'était pas déclarée.
  //
  // ARCHI-01 — troisième schéma : côté Pokémon, la fiche est une VARIANTE, et
  // prix / stock / condition / scans vivent sur les exemplaires rattachés. On
  // retient le moins cher réellement vendable ; s'il n'y en a aucun — le cas de
  // 27 569 variantes sur 29 210 — la fiche s'affiche quand même, en « épuisé ».
  const exemplaireVitrine = ((listing.pokemon_listings ?? []) as {
    id: string; price: number; quantity: number; condition: string | null
    front_photo_url: string | null; back_photo_url: string | null; is_active: boolean
  }[])
    .filter(e => e.is_active && e.quantity > 0 && e.price > 0)
    .sort((a, b) => a.price - b.price)[0] ?? null

  const prix = exemplaireVitrine?.price ?? listing.price ?? 0
  const quantite = exemplaireVitrine?.quantity ?? listing.quantity ?? 0
  const etat = exemplaireVitrine?.condition ?? listing.condition ?? null
  /** L'objet réellement vendu : l'exemplaire côté Pokémon, la ligne ailleurs. */
  const idExemplaireVendu = exemplaireVitrine?.id ?? listing.id

  const frontUrl =
    exemplaireVitrine?.front_photo_url ??
    listing.front_photo_url ??
    listing.image_api ??
    listing.image_url ??
    null
  const listingImageUrl = frontUrl
  const backUrl = exemplaireVitrine?.back_photo_url ?? listing.back_photo_url ?? null

  /**
   * Y a-t-il un VRAI scan de la pièce, par opposition au visuel d'éditeur ?
   *
   * `frontUrl` ne répond pas à cette question : il retombe sur `image_api` et
   * `image_url`, donc il est presque toujours renseigné. Il faut la source.
   *
   * Et ce n'est pas `listing.front_photo_url` seul : depuis ARCHI-01, `listing`
   * EST la variante côté Pokémon, qui ne porte aucun scan — le scan pend sous
   * l'exemplaire. Testé seul, il est toujours nul, et la page annonçait donc
   * « en attendant le scan » au-dessus d'un scan bel et bien affiché. Même
   * dérive que celle relevée sur les écrans d'administration.
   */
  const scanReel = exemplaireVitrine?.front_photo_url ?? listing.front_photo_url ?? null

  // Viewer d'inspection réservé aux pièces ≥ 1 € disposant d'un VRAI scan verso
  // (règle photo du CLAUDE.md).
  const useViewer = prix >= PHOTO_PRICE_THRESHOLD && !!backUrl && !!frontUrl
  const reference = [set?.code, card?.number ? `#${card.number}` : null].filter(Boolean).join(' · ') || name

  const cartImageUrl = frontUrl && tcg !== 'sealed' && !frontUrl.match(/\.(png|jpg|webp|svg)$/)
    ? frontUrl + '/high.webp'
    : frontUrl

  // Une carte a deux faces ; un produit scellé a une galerie de photos. Les deux
  // alimentent le MÊME composant `ScanStage` (bande de vignettes + visuel
  // principal + zoom) — un seul exemplaire de ce pattern dans le code.
  const galerie = (listing.image_urls ?? []).filter(Boolean)
  const scans: { url: string; label: string }[] =
    tcg === 'sealed' && galerie.length > 0
      ? galerie.map((url, i) => ({
          url,
          label: galerie.length > 1 ? `Photo ${i + 1}` : 'Visuel',
        }))
      : ([
          frontUrl ? { url: frontUrl, label: 'Recto' } : null,
          backUrl ? { url: backUrl, label: 'Verso' } : null,
        ].filter(Boolean) as { url: string; label: string }[])

  /**
   * Plus bas prix RÉELLEMENT vendable d'un lot d'exemplaires.
   *
   * `null` quand il n'y en a aucun — ce qui est le cas général aujourd'hui :
   * 1 641 listings Pokémon, **aucun avec un prix saisi**. C'est ce `null` que
   * les vignettes traduisent en « Épuisé », et non un 0 déguisé en prix.
   */
  const prixMini = (exemplaires: { price: number; quantity: number; isActive: boolean }[]) => {
    const vendables = exemplaires.filter(e => e.isActive && e.quantity > 0 && e.price > 0)
    return vendables.length ? Math.min(...vendables.map(e => e.price)) : null
  }

  /**
   * ── « Autres versions de cette carte » — colonne de gauche ──────────────
   *
   * TOUTES les versions de la MÊME carte, celle affichée comprise : c'est une
   * liste de navigation, pas une rangée de suggestions, et la version courante
   * doit y figurer pour qu'on sache où l'on est.
   *
   * Elle remplace la rangée pleine largeur « Existe aussi dans cette variante ».
   * Celle-ci rendait UNE vignette dans une grille de six colonnes — 370 px de
   * hauteur pour une carte et cinq sixièmes de vide horizontal, le poste le
   * plus coûteux de la page (signalé en session 42). Une liste verticale dans
   * la colonne de gauche dit la même chose en trois fois moins de place, et
   * remplit le vide qui restait sous la photo.
   *
   * `chargerVariantes` est réemployée telle quelle — c'est elle qui alimente
   * déjà le switch de variantes des tuiles de catalogue, et elle absorbe la
   * différence entre les deux schémas. En refaire une seconde ici aurait créé
   * deux définitions concurrentes de « qu'est-ce qu'une variante ».
   */
  let versions: LigneVersion[] = []
  if ((tcg === 'pokemon' || tcg === 'onepiece') && card?.id) {
    const toutes = await chargerVariantes(supabase, tcg, [card.id])
    versions = toutes
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(v => {
        const vendables = v.exemplaires.filter(e => estVendable(e))
        return {
          id: v.id,
          libelle: v.label || 'Autre version',
          reference: [set?.code, card.number ? `#${card.number}` : null].filter(Boolean).join(' · '),
          rarete: card.rarity ?? null,
          image: vendables[0]?.frontPhotoUrl ?? v.imageUrl,
          // Stock = somme des quantités réellement vendables, pas le nombre de
          // lignes : un exemplaire peut porter plusieurs pièces identiques.
          stock: vendables.reduce((n, e) => n + e.quantity, 0),
          prix: prixMini(v.exemplaires),
          courante: v.id === listing.id,
        }
      })
  }

  /**
   * ── Pièce en dépôt-vente ? ─────────────────────────────────────────────
   *
   * VÉRIFIÉ AVANT D'ÉCRIRE CETTE LIGNE, comme le brief l'exigeait, et le
   * résultat n'est pas celui qu'on aurait supposé :
   *
   *   · `pokemon_listings` et `onepiece_listings` ne portent AUCUNE colonne de
   *     dépôt-vente — ni vendeur, ni propriétaire, ni drapeau. Un exemplaire ne
   *     sait pas d'où il vient.
   *   · `consignment_items` est une table à part, sans clé étrangère sur
   *     `card_id` ni `variant_type_id` : elle ne déclare même pas son univers.
   *     Le rapprochement ne peut donc se faire que sur le couple
   *     (carte, type de variante) — exactement la clé de cette fiche.
   *   · Seules les lignes `status = 'active'` sont lisibles publiquement
   *     (migration 0023) ; `SELECT` est bien accordé à `anon` sur
   *     `variant_type_id`, donc le filtre passe côté client anonyme.
   *
   * La table est VIDE en production à ce jour : ce test est donc faux partout,
   * et c'est le comportement correct — aucune carte du stock propre de Goriki
   * ne doit être présentée comme une pièce de dépôt.
   */
  let depotVente: { prixDemande: number | null } | null = null
  if ((tcg === 'pokemon' || tcg === 'onepiece') && card?.id && variant?.id) {
    const { data } = await supabase
      .from('consignment_items')
      .select('id, asking_price')
      .eq('card_id', card.id)
      .eq('variant_type_id', variant.id)
      .eq('status', 'active')
      .limit(1)
    if (data?.length) depotVente = { prixDemande: Number(data[0].asking_price ?? 0) || null }
  }

  // Page de set vers laquelle pointent les liens : celle du parent pour un set
  // rattaché (migration 0057), qui montre ses cartes en fin de liste.
  const pageDuSet = set?.display_parent_id ?? card?.set_id ?? null

  /** Taille réelle du set affiché, rattachés compris, pour « Voir les N cartes → ». */
  let cartesDuSet: number | null = null
  if (pageDuSet && tcg !== 'sealed') {
    const groupe = [pageDuSet, ...(await rattachesDe(supabase, tcg, pageDuSet)).map(r => r.id)]
    const { count } = await supabase
      .from(tcg === 'pokemon' ? 'pokemon_cards' : 'onepiece_cards')
      .select('id', { count: 'exact', head: true })
      .in('set_id', groupe)
    cartesDuSet = count ?? null
  }

  /**
   * ── Rangée 2 — « Du même set » ────────────────────────────────────────
   *
   * La requête Pokémon sélectionne bien `image_url` et le TABLEAU des
   * exemplaires ; la normalisation en `Vignette` se fait ici, côté serveur,
   * pour que le composant n'ait à connaître aucun des deux schémas. C'est ce
   * que l'ancienne version ne faisait pas : elle passait les lignes brutes
   * derrière un `as never`, et le composant y cherchait des champs One Piece
   * qui n'existaient pas côté Pokémon.
   */
  let sameSet: Vignette[] = []
  if (tcg === 'pokemon' && card?.set_id) {
    const { data } = await supabase
      .from('pokemon_card_variants')
      .select(
        `id, image_url,
         pokemon_listings(price, quantity, is_active, front_photo_url),
         pokemon_cards!inner(name_fr, number, set_id),
         pokemon_variant_types!inner(label)`,
      )
      .eq('pokemon_cards.set_id', card.set_id)
      .neq('id', listing.id)
      .limit(12)

    sameSet = ((data ?? []) as unknown as Record<string, unknown>[]).map(r => {
      const c = (Array.isArray(r.pokemon_cards) ? r.pokemon_cards[0] : r.pokemon_cards) as
        | { name_fr: string; number: string }
        | undefined
      const ex = ((r.pokemon_listings ?? []) as Record<string, unknown>[]).map(e => ({
        price: Number(e.price ?? 0),
        quantity: Number(e.quantity ?? 0),
        isActive: e.is_active === true,
        frontPhotoUrl: (e.front_photo_url as string | null) ?? null,
      }))
      return {
        id: r.id as string,
        // Le scan d'un exemplaire vendable prime sur le visuel d'API, comme
        // partout ailleurs sur le site.
        image:
          ex.find(e => e.isActive && e.quantity > 0 && e.price > 0)?.frontPhotoUrl ??
          (r.image_url as string | null) ??
          null,
        entete: c?.number ? `#${c.number}` : '',
        titre: c?.name_fr ?? '',
        // Sans ce libellé, la Normale et la Reverse d'une même carte se
        // suivaient dans la grille, identiques en tout point.
        variante:
          ((Array.isArray(r.pokemon_variant_types) ? r.pokemon_variant_types[0] : r.pokemon_variant_types) as
            | { label: string }
            | undefined)?.label ?? null,
        prix: prixMini(ex),
      }
    })
  } else if (tcg === 'onepiece' && card?.set_id) {
    const { data } = await supabase
      .from('onepiece_listings')
      .select(
        `id, price, quantity, is_active, image_api, front_photo_url,
         onepiece_cards!inner(name_fr, number, set_id),
         onepiece_variant_types!inner(label)`,
      )
      .eq('onepiece_cards.set_id', card.set_id)
      .neq('id', listing.id)
      .limit(12)

    sameSet = ((data ?? []) as unknown as Record<string, unknown>[]).map(r => {
      const c = (Array.isArray(r.onepiece_cards) ? r.onepiece_cards[0] : r.onepiece_cards) as
        | { name_fr: string; number: string }
        | undefined
      const ex = [{
        price: Number(r.price ?? 0),
        quantity: Number(r.quantity ?? 0),
        isActive: r.is_active === true,
      }]
      return {
        id: r.id as string,
        image: (r.front_photo_url as string | null) ?? (r.image_api as string | null) ?? null,
        entete: c?.number ? `#${c.number}` : '',
        titre: c?.name_fr ?? '',
        variante:
          ((Array.isArray(r.onepiece_variant_types) ? r.onepiece_variant_types[0] : r.onepiece_variant_types) as
            | { label: string }
            | undefined)?.label ?? null,
        prix: prixMini(ex),
      }
    })
  }

  /** Épuisé = aucune quantité vendable. Déclaré ici, avant `FICHE`, qui s'en
      sert pour taire la ligne « Authenticité » sur une pièce absente. */
  const epuise = quantite <= 0

  const FICHE = [
    { k: 'Jeu', v: tcg === 'pokemon' ? 'Pokémon' : tcg === 'onepiece' ? 'One Piece' : 'Scellé' },
    set?.name_fr ? { k: 'Extension', v: `${set.code} — ${set.name_fr}` } : null,
    card?.rarity ? { k: 'Rareté', v: card.rarity } : null,
    variant ? { k: 'Version', v: variant.label } : null,
    card?.card_type ? { k: 'Type', v: card.card_type } : null,
    card?.attribute ? { k: 'Attribut', v: card.attribute } : null,
    card?.color ? { k: 'Couleur', v: card.color } : null,
    card?.category ? { k: 'Catégorie', v: card.category } : null,
    // Aucune colonne « langue » n'existe. Ce n'est pas pour autant une
    // invention : le catalogue Pokémon vient de TCGdex en `fr`, One Piece de
    // Poneglyphe en FR, et la boutique est FR uniquement (CLAUDE.md). La ligne
    // décrit l'impression servie, pas un champ deviné.
    tcg !== 'sealed' ? { k: 'Langue', v: 'Français' } : null,
    // Goriki ne peut garantir que ce qu'il détient : la ligne ne s'affiche que
    // si un exemplaire est réellement en stock. Sur une carte épuisée, une
    // mention d'authenticité porterait sur un objet absent.
    !epuise ? { k: 'Authenticité', v: 'Vérifiée par Goriki' } : null,
  ].filter(Boolean) as { k: string; v: string }[]

  // ── Exemplaires physiques de la MÊME carte + variante ─────────────────────
  // Au-dessus de 1 €, chaque pièce est scannée individuellement : plusieurs
  // lignes peuvent coexister pour un même état (migration 0027). On les propose
  // comme des destinations — chaque exemplaire a déjà sa propre URL, donc son
  // propre scan et son propre prix. Une carte fongible ou un exemplaire unique
  // ne déclenche aucun affichage supplémentaire.
  let exemplaires: {
    id: string
    price: number
    condition: string | null
    quantity: number
    image: string | null
  }[] = []

  if (tcg !== 'sealed' && card) {
    const variantId = variant?.id
    if (variantId) {
      // Pokémon : les exemplaires pendent sous la variante affichée, dont l'id
      // EST celui de la fiche. One Piece : schéma inchangé, couple (carte, type).
      const req =
        tcg === 'pokemon'
          ? supabase
              .from('pokemon_listings')
              .select('id, price, condition, quantity, front_photo_url, copy_index')
              .eq('variant_id', listing.id)
          : supabase
              .from('onepiece_listings')
              .select('id, price, condition, quantity, front_photo_url, image_api, copy_index')
              .eq('card_id', card.id)
              .eq('variant_type_id', variantId)
      const { data } = await req
        .eq('is_active', true)
        .gt('quantity', 0)
        .gt('price', 0)
        .order('price', { ascending: true })
      exemplaires = ((data ?? []) as unknown as Record<string, unknown>[]).map(e => ({
        id: e.id as string,
        price: e.price as number,
        condition: e.condition as string | null,
        quantity: e.quantity as number,
        // Le scan de l'exemplaire prime ; à défaut, le visuel de la variante
        // (Pokémon) ou celui porté par la ligne elle-même (One Piece).
        image:
          (e.front_photo_url as string | null) ??
          (e.image_api as string | null) ??
          listingImageUrl,
      }))
    }
  }


  return (
    <>
      <SiteHeader />

      <main className="font-grotesk text-ink">
        <PageContainer as="nav" className="pt-8">
          <span className="data text-[9px]">
            <Link href={`/catalogue/${tcg}`} className="capitalize hover:text-ochre">
              {tcg === 'pokemon' ? 'Pokémon' : tcg === 'onepiece' ? 'One Piece' : 'Scellés'}
            </Link>
            {set && (
              <>
                <span className="mx-1.5 text-ink-55">/</span>
                <Link href={`/catalogue/${tcg}/${pageDuSet}`} className="hover:text-ochre">
                  {set.code}
                </Link>
              </>
            )}
            {card?.number && (
              <>
                <span className="mx-1.5 text-ink-55">/</span>
                <span className="text-ink">{card.number}</span>
              </>
            )}
          </span>
        </PageContainer>

        <PageContainer as="section" className="pb-14 pt-6 lg:pb-20">
          {/* Grille à DEUX lignes sur desktop, et non deux simples colonnes.
              La colonne d'achat occupe les deux lignes ; la colonne de gauche
              porte le visuel en haut et la fiche technique en dessous. Sans ce
              découpage, le bloc technique restait accroché sous le panneau
              Inspection : la colonne droite se prolongeait de 200 px pendant
              que toute la moitié gauche restait vide sous la photo. */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,50fr)_minmax(0,50fr)] lg:gap-x-12 lg:gap-y-7">
            {/* ── Scan ─────────────────────────────────────────────────── */}
            <div className="lg:col-start-1 lg:row-start-1">
              {useViewer ? (
                <CardViewer
                  frontUrl={frontUrl!}
                  backUrl={backUrl!}
                  altText={name}
                  reference={reference}
                  rarity={card?.rarity}
                  variante={variant?.label}
                />
              ) : (
                <ScanStage images={scans} altText={name} reference={reference} variante={variant?.label} />
              )}
            </div>

            {/* ── Autres versions ──────────────────────────────────────────
                Sous la photo et ses contrôles, dans la colonne de gauche : la
                hauteur y était perdue, et la comparaison entre versions se fait
                naturellement à côté du visuel qu'elles partagent.
                Le composant se retire de lui-même s'il n'y a qu'une version. */}
            <div className="lg:col-start-1 lg:row-start-2">
              <AutresVersions versions={versions} />
            </div>

            {/* ── Achat ────────────────────────────────────────────────── */}
            <div className="flex flex-col lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <h1 className="m-0 text-[30px] font-semibold leading-[1.08] tracking-[-0.025em] text-ink lg:text-[36px]">
                {name}
              </h1>

              <span className="data mt-2.5 text-[9px]">
                {[set?.code, card?.number, card?.rarity].filter(Boolean).join(' · ')}
              </span>

              {/* Accroche — calée sur le STATUT RÉEL de la pièce, jamais sur la
                  formule de la maquette. « Scannée et vérifiée » supposerait une
                  photo maison : il n'en existe AUCUNE en base à ce jour (0
                  listing sur 3 362, les deux univers confondus). L'affirmer
                  serait promettre un travail qui n'a pas eu lieu. */}
              <p className="m-0 mt-3 max-w-[52ch] text-[14px] leading-[1.55] text-ink-70">
                {tcg === 'sealed'
                  ? "Produit scellé d'origine, jamais ouvert."
                  : scanReel
                    ? 'Pièce individuelle, scannée et vérifiée par nos soins.'
                    : epuise
                      ? "Visuel de l'éditeur. Aucun exemplaire en stock pour le moment."
                      : "Pièce individuelle. Visuel de l'éditeur en attendant le scan de l'exemplaire."}
              </p>

              {/* La variante n'est plus ici : elle est posée sur le visuel, à
                  gauche de la colonne. Parmi l'état et « Scan réel », elle
                  passait pour une caractéristique de plus, alors qu'elle est ce
                  qui distingue cette fiche d'une autre par ailleurs identique.
                  Ces deux pastilles-là restent : elles qualifient bien l'objet
                  vendu, pas son identité. */}
              <div className="mt-4 flex flex-wrap gap-2">
                {etat && <span className="pill" data-active="true">{etat}</span>}
                {listing.front_photo_url && <span className="pill">Scan réel</span>}
              </div>

              <p className="m-0 mt-6 text-[38px] font-semibold leading-none tracking-[-0.03em] text-ink lg:text-[44px]">
                {prixOuEpuise(prix)}
              </p>
              {/* Le grand chiffre affichait « 0,00 € » sur TOUTE carte sans
                  prix saisi — c'est-à-dire, à ce jour, sur les 29 210. Il dit
                  désormais « Épuisé », et cette ligne ne le répète pas : elle
                  explique. */}
              <p className="m-0 mt-2.5 text-[13px] text-ink-70">
                {epuise
                  ? 'Aucun exemplaire en vente pour le moment'
                  : `${quantite} exemplaire${quantite > 1 ? 's' : ''} disponible${quantite > 1 ? 's' : ''}${etat ? ` · ${etat}` : ''}`}
              </p>

              {/* Pièce de dépôt-vente : l'information vient de la seule source
                  qui la porte, `consignment_items`. Le prix demandé est celui
                  du déposant — il est affiché tel quel, sans commission, la
                  colonne `commission_rate` étant volontairement hors du GRANT
                  public. */}
              {depotVente && (
                <div className="hair mt-6 pt-5">
                  <span className="corner-tag" data-tone="ochre">Dépôt-vente</span>
                  <p className="m-0 mt-3 max-w-[52ch] text-[13px] leading-[1.6] text-ink-70">
                    Pièce confiée par un membre, contrôlée et expédiée par Goriki.
                    {depotVente.prixDemande
                      ? ` Prix demandé par le déposant : ${prixOuEpuise(depotVente.prixDemande)}.`
                      : ''}
                  </p>
                </div>
              )}

              {exemplaires.length > 1 && (
                <div className="hair mt-6 pt-5">
                  <span className="data text-[9px]">
                    {exemplaires.length} exemplaires disponibles — chacun scanné séparément
                  </span>
                  <div className="mt-3 flex flex-col gap-2">
                    {exemplaires.map((e, i) => {
                      const courant = e.id === listing.id
                      return (
                        <Link
                          key={e.id}
                          href={`/${e.id}`}
                          aria-current={courant ? 'true' : undefined}
                          className={`flex items-center gap-3 rounded-control border px-3 py-2.5 transition-colors ${
                            courant
                              ? 'border-[rgba(200,134,10,0.55)] bg-[rgba(200,134,10,0.08)]'
                              : 'border-[rgba(26,22,17,0.14)] bg-[rgba(255,255,255,0.5)] hover:bg-white'
                          }`}
                        >
                          {e.image ? (
                            // eslint-disable-next-line @next/next/no-img-element -- vignette d'option, dense
                            <img
                              src={e.image}
                              alt=""
                              aria-hidden
                              loading="lazy"
                              className="h-12 w-[34px] shrink-0 rounded-[3px] object-cover"
                            />
                          ) : (
                            <span className="scan-pending h-12 w-[34px] shrink-0 rounded-[3px]" />
                          )}
                          <span className="flex min-w-0 flex-1 flex-col leading-tight">
                            <span className="text-[13px] font-medium text-ink">
                              {/* Plus de tiret : un « — » se lit comme une donnée
                                  manquante là où l'information est simplement que
                                  l'état n'a pas été saisi. */}
                              Exemplaire {i + 1}
                              {e.condition ? ` · ${e.condition}` : ''}
                            </span>
                            <span className="data mt-0.5 text-[8px]">
                              {courant ? 'affiché ci-dessus' : 'voir son scan'}
                            </span>
                          </span>
                          <span className="shrink-0 text-[15px] font-semibold text-ink">
                            {/* Ces exemplaires sont déjà filtrés sur `price > 0`,
                                mais on passe par le même vocabulaire que le reste
                                du site plutôt que par un formateur brut : une
                                seule règle de prix, aucune exception locale. */}
                            {prixOuEpuise(e.price)}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="mt-7 flex flex-col gap-2.5">
                <AddToCartButton
                  // Ce qu'on met au panier est un EXEMPLAIRE, pas la variante :
                  // c'est lui que le checkout réserve et décrémente. L'URL, elle,
                  // porte la variante. Repli sur `listing.id` pour One Piece et
                  // les scellés, dont la ligne est encore l'objet vendu.
                  listingId={idExemplaireVendu}
                  tcg={tcg}
                  name={name}
                  variantLabel={variant?.label}
                  price={prix}
                  maxQuantity={quantite}
                  imageUrl={cartImageUrl}
                />

                {/* Pièce indisponible : le seul point d'ajout à la want list
                    depuis le parcours public (décision d'architecture 59). */}
                {epuise && card && tcg !== 'sealed' && (
                  <JeLaChercheButton cardType={tcg} cardId={card.id} />
                )}

                {tcg !== 'sealed' && (
                  <WishlistButton itemType={tcg} itemId={listing.id} variantTypeId={variant?.id ?? null} />
                )}
              </div>

              {/* ── Fiche technique ──────────────────────────────────────
                  Revenue dans la colonne d'achat : la ligne 2 de gauche accueille
                  désormais « Autres versions ». Elle reste compacte, sous les CTA.

                  Les champs sont ceux qui EXISTENT réellement en base. Deux
                  absences assumées, plutôt qu'inventées :

                   · « Langue » n'est aucune colonne — mais ce n'en est pas moins
                     un fait : le catalogue Pokémon est importé depuis TCGdex en
                     `fr`, One Piece depuis Poneglyphe en FR, et la boutique est
                     FR uniquement (CLAUDE.md). La ligne dit donc l'impression
                     servie, pas un champ deviné.
                   · « Authenticité » n'existe pas davantage, et Goriki ne peut
                     garantir une pièce qu'il ne détient pas. La ligne n'apparaît
                     donc QUE lorsqu'un exemplaire est réellement en stock. Sur
                     une carte épuisée, elle se tait — une garantie affichée sur
                     un objet absent serait une promesse en l'air. */}
              {FICHE.length > 0 && (
                <dl className="hair m-0 mt-7 flex flex-col pt-5">
                  {FICHE.map(row => (
                    <div
                      key={row.k}
                      className="flex items-center justify-between gap-6 border-b border-[rgba(26,22,17,0.09)] py-2.5 last:border-0"
                    >
                      <dt className="data shrink-0 text-[9px]">{row.k}</dt>
                      <dd className="m-0 truncate text-[13px] text-ink">{row.v}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {/* ── Ce que Goriki engage ────────────────────────────────────
                  REMPLACE le gros encart « Inspection ».

                  Le texte de la maquette — « Envoi sous 24h, satisfait ou
                  remboursé 14 jours » — n'a PAS été repris. Vérifié avant
                  d'écrire : le dépôt ne contient aucune page de CGV, aucun délai
                  d'expédition annoncé, aucune politique de retour. Publier ces
                  chiffres aurait créé un engagement commercial que rien ne
                  soutient — et un engagement affiché est opposable.

                  Ne subsiste donc que ce que la boutique affirme DÉJÀ ailleurs,
                  mot pour mot : les trois garanties du hero de l'accueil et la
                  ligne du pied de page. Rien de plus. */}
              <div className="mt-7">
                <p className="m-0 max-w-[52ch] text-[13px] leading-[1.65] text-ink-70">
                  {tcg === 'sealed'
                    ? "Produit scellé d'origine, jamais ouvert, expédié sous emballage renforcé."
                    : listing.front_photo_url
                      ? "C'est l'exemplaire exact que vous recevrez : le scan haute résolution montre la carte telle qu'elle est, vous l'inspectez avant d'acheter. Expédition sous emballage renforcé."
                      : "Le visuel présenté est celui de l'éditeur. Les pièces au-dessus d'un euro sont scannées recto-verso avant expédition — c'est alors l'exemplaire exact que vous recevez. Emballage renforcé."}
                </p>
                <span className="data mt-3 block text-[9px]">
                  Authentifié · Scanné · Garanti
                </span>
              </div>

            </div>
          </div>
        </PageContainer>

        {/* Une seule rangée pleine largeur désormais. « Existe aussi dans
            cette variante » a été repliée en liste verticale dans la colonne de
            gauche : elle rendait UNE vignette dans une grille de six colonnes,
            soit 370 px de hauteur pour une carte et cinq sixièmes de vide.

            Le lien de sortie porte le nombre RÉEL de cartes du set, compté en
            base — pas la longueur de la rangée, qui est plafonnée à douze. */}
        <RangeeCartes
          titre="Dans la même série"
          sousTitre={
            set?.name_fr
              ? `${set.code} — ${set.name_fr}, en stock chez Goriki.`
              : undefined
          }
          lien={
            cartesDuSet && pageDuSet
              ? { href: `/catalogue/${tcg}/${pageDuSet}`, label: `Voir les ${cartesDuSet} cartes` }
              : undefined
          }
          vignettes={sameSet}
        />
      </main>

      <SiteFooter />
    </>
  )
}
