import Link from 'next/link'
import PageContainer from '@/components/layout/PageContainer'
import { prixDepuis } from '@/lib/utils'

/**
 * Rangée de vignettes de cartes en pied de fiche produit.
 *
 * Sert les deux rangées de la fiche — « Existe aussi dans cette variante »
 * puis « Du même set » — parce qu'elles ont la même forme et ne diffèrent que
 * par ce qu'elles répondent : *une autre version de CETTE carte* d'un côté,
 * *une autre carte du set* de l'autre.
 *
 * ── POURQUOI CE COMPOSANT REMPLACE `SameSetGrid` ─────────────────────────
 *
 * L'ancien déclarait ses props avec les champs du schéma One Piece
 * (`price`, `image_api`, `front_photo_url`), et la page lui passait, pour
 * Pokémon, des lignes de `pokemon_card_variants` — qui portent `image_url` et
 * un TABLEAU `pokemon_listings`. Aucun des champs lus n'existait donc côté
 * Pokémon : toutes les vignettes tombaient sur le placeholder rayé, et
 * `formatPrice(undefined)` rendait « NaN € ».
 *
 * TypeScript aurait attrapé les deux. Il ne l'a pas fait parce que l'appel
 * était écrit `listings={sameSet as never}` : le cast désactivait la
 * vérification de la prop. C'est la cause première — pas les champs eux-mêmes,
 * mais le cast qui a laissé passer leur divergence jusqu'en production.
 *
 * D'où la forme retenue ici : un type `Vignette` explicite, sans cast à
 * l'appel, où les DEUX univers sont normalisés par la page. Le composant ne
 * connaît plus aucun schéma de base.
 */

export interface Vignette {
  /** Identité servant d'URL de fiche : variante (Pokémon) ou listing (One Piece). */
  id: string
  image: string | null
  /** Ligne mono du haut — numéro de carte, ou code de variante. */
  entete: string
  /** Ligne principale — le nom de la carte, dans les deux rangées. */
  titre: string
  /**
   * Libellé de variante — « Normale », « Reverse », « Holo »…
   *
   * Sans lui, deux variantes de la même carte se suivaient dans la grille avec
   * le MÊME visuel, le MÊME nom et le MÊME numéro : la rangée avait l'air de
   * bégayer, et le doublon apparent se lisait comme un bug plutôt que comme
   * deux produits distincts. C'est la seule chose qui les sépare, elle doit
   * donc être visible avant le texte — d'où l'étiquette sur le visuel, à
   * l'endroit même où l'œil compare.
   */
  variante?: string | null
  /**
   * Plus bas prix vendable de cette pièce, `null` si rien n'est vendable.
   * Le calcul appartient à la page : le composant ne fait que l'afficher.
   */
  prix: number | null
}

export default function RangeeCartes({
  titre,
  sousTitre,
  lien,
  vignettes,
}: {
  titre: string
  /** Ligne de contexte sous le titre — « ME05 — Nuit Noire, en stock chez Goriki. » */
  sousTitre?: string
  /** Sortie vers le set complet. Le libellé porte le nombre RÉEL de cartes. */
  lien?: { href: string; label: string }
  vignettes: Vignette[]
}) {
  // Rangée vide = pas de rangée. Un titre suivi de rien est pire que rien.
  if (vignettes.length === 0) return null

  return (
    <PageContainer as="section" className="hair pb-16 pt-10 lg:pb-20">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="display-sub m-0">{titre}</h2>
          {sousTitre && <span className="data text-[9px]">{sousTitre}</span>}
        </div>
        {lien && (
          <Link href={lien.href} className="shrink-0 text-[13px] font-medium text-ink hover:text-ochre">
            {lien.label} <span aria-hidden>→</span>
          </Link>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3.5 sm:grid-cols-4 lg:grid-cols-6">
        {vignettes.slice(0, 12).map(v => (
          <Link key={v.id} href={`/${v.id}`} data-card-hover className="group flex flex-col">
            <div className="relative mb-2 aspect-[2.5/3.5] overflow-hidden rounded-[8px] shadow-[0_12px_24px_-14px_rgba(26,22,17,0.5)]">
              {v.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- vignette dense de rangée
                <img
                  src={v.image}
                  alt={v.titre}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:-translate-y-1"
                />
              ) : (
                <div className="scan-pending h-full w-full" />
              )}
              {/* Même classe et même coin que l'étiquette de la fiche produit
                  (`ScanStage`) : un seul geste visuel pour une seule notion,
                  d'un écran à l'autre. */}
              {v.variante && (
                <span className="corner-tag pointer-events-none absolute bottom-1.5 left-1.5">
                  {v.variante}
                </span>
              )}
            </div>
            <span className="data text-[8px]">{v.entete}</span>
            <span className="line-clamp-1 text-[12px] font-medium leading-tight text-ink">{v.titre}</span>
            {/* `prixDepuis` porte la règle : 0 ou absent → « Épuisé », jamais
                « 0,00 € » ni « NaN € ». Un prix réel est annoncé « à partir
                de », une carte pouvant avoir plusieurs exemplaires. */}
            <span
              className={
                v.prix != null && v.prix > 0
                  ? 'mt-1 text-[13px] font-semibold text-ink'
                  : 'mt-1 text-[11px] text-ink-55'
              }
            >
              {prixDepuis(v.prix)}
            </span>
          </Link>
        ))}
      </div>
    </PageContainer>
  )
}
