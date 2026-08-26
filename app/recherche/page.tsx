import Link from 'next/link'
import { Suspense } from 'react'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import PageContainer from '@/components/layout/PageContainer'
import CardCursor from '@/components/motion/CardCursor'
import GroupeResultats, {
  GROUPES,
  lienGroupe,
  type Resultat,
} from '@/components/recherche/ResultatsRecherche'
import { PaginationUrl } from '@/components/ui/Pagination'
import { decouper, lirePage } from '@/lib/pagination'
import { resoudreParPage } from '@/lib/pagination.server'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Recherche' }
export const dynamic = 'force-dynamic'

/**
 * Résultats de recherche — la destination du champ du header.
 *
 * Ce champ existait sur TOUTES les pages et postait vers `/catalogue`, une page
 * d'accueil de rayons qui ne lit pas `q` : la recherche du site ne renvoyait
 * donc rien. Cette route est la fonctionnalité qui manquait derrière l'UI.
 *
 * DEUX VUES, une seule route :
 *   · sans `type` — résultats GROUPÉS par nature, chaque groupe plafonné, avec
 *     un « voir tout » qui mène à la seconde vue ;
 *   · avec `type` — la liste complète de ce type, PAGINÉE avec le composant
 *     de pagination du site, pas un second.
 *
 * Tout le classement est fait en base par `search_catalogue` (migrations 0034 et
 * 0035) : insensible aux accents, rangs de pertinence, stock en premier à rang
 * égal. Le rejouer ici garantirait une divergence.
 */

/** En dessous, on ne lance aucune requête : deux lettres balaieraient tout. */
const LONGUEUR_MINIMALE = 2
/** Plafond par groupe dans la vue groupée. */
const PAR_GROUPE = 6
/** Plafond global remonté de la base — au-delà, la vue par type prend le relais. */
const PLAFOND = 200

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function RecherchePage({ searchParams }: Props) {
  const sp = await searchParams
  const q = (typeof sp.q === 'string' ? sp.q : '').trim()
  const typeDemande = typeof sp.type === 'string' ? sp.type : ''

  const tropCourt = q.length < LONGUEUR_MINIMALE

  // `q` vide ou trop court : on n'interroge pas la base du tout.
  const { data } = tropCourt
    ? { data: [] as Resultat[] }
    : await createClient().then(s => s.rpc('search_catalogue', { terme: q, limite: PLAFOND }))

  const resultats = (data ?? []) as Resultat[]
  const groupe = GROUPES.find(g => g.type === typeDemande) ?? null

  // Vue par type : liste complète de ce type, paginée.
  const duType = groupe ? resultats.filter(r => r.type === groupe.type) : []
  const parPage = await resoudreParPage(sp)
  const tranche = decouper(duType, lirePage(sp), parPage)

  const total = resultats.length

  return (
    <>
      <SiteHeader />
      <CardCursor />

      <main className="font-grotesk text-ink">
        <PageContainer as="section" className="pb-16 pt-10 lg:pb-20 lg:pt-14">
          <div className="mb-8 lg:mb-10">
            <span className="data text-[9px]">Recherche</span>
            <h1 className="display-section m-0 mt-3">
              {q ? `« ${q} »` : 'Rechercher'}
            </h1>
            {!tropCourt && (
              <p className="data mt-3 text-[9px]">
                {total === 0
                  ? 'aucun résultat'
                  : `${total}${total >= PLAFOND ? '+' : ''} résultat${total > 1 ? 's' : ''}`}
                {groupe ? ` · ${groupe.titre.toLowerCase()}` : ''}
              </p>
            )}
          </div>

          {/* ── Invite : rien de cherché, ou trop court ─────────────────── */}
          {tropCourt ? (
            <div className="glass rounded-block px-8 py-14 text-center">
              <p className="m-0 text-[14px] leading-[1.6] text-ink-70">
                {q
                  ? `Il faut au moins ${LONGUEUR_MINIMALE} caractères pour lancer une recherche.`
                  : 'Cherchez une carte, un set ou un produit scellé depuis la barre du haut.'}
              </p>
              <p className="m-0 mt-3 text-[13px] text-ink-55">
                Les accents sont facultatifs : « salameche » trouve « Salamèche ».
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-2">
                <Link href="/catalogue/pokemon" className="pill">Pokémon</Link>
                <Link href="/catalogue/onepiece" className="pill">One Piece</Link>
                <Link href="/catalogue/scelles" className="pill">Scellés</Link>
              </div>
            </div>
          ) : total === 0 ? (
            /* ── État vide : ce qui a été cherché, et une porte de sortie ── */
            <div className="glass rounded-block px-8 py-14 text-center">
              <p className="m-0 text-[14px] leading-[1.6] text-ink-70">
                Aucun résultat pour <span className="font-semibold text-ink">« {q} »</span>.
              </p>
              <p className="m-0 mt-3 text-[13px] text-ink-55">
                Vérifiez l&apos;orthographe, ou parcourez les rayons — le catalogue compte
                plus de 23 000 cartes.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-2">
                <Link href="/catalogue/pokemon" className="pill">Pokémon</Link>
                <Link href="/catalogue/onepiece" className="pill">One Piece</Link>
                <Link href="/catalogue/scelles" className="pill">Scellés</Link>
                <Link href="/want-to-buy" className="pill">Signaler une recherche</Link>
              </div>
            </div>
          ) : groupe ? (
            /* ── Vue par type : liste complète, paginée ──────────────────── */
            <>
              <div className="mb-6">
                <Link href={`/recherche?q=${encodeURIComponent(q)}`} className="data text-[9px] hover:text-ochre">
                  <span aria-hidden>←</span> Tous les résultats
                </Link>
              </div>

              <GroupeResultats
                titre={groupe.titre}
                unite={groupe.unite}
                resultats={tranche.elements}
                total={tranche.total}
                hrefVoirTout={lienGroupe(groupe.type, q)}
              />

              <Suspense fallback={<div className="mt-8 h-[52px]" />}>
                <PaginationUrl
                  page={tranche.page}
                  pages={tranche.pages}
                  total={tranche.total}
                  parPage={parPage}
                  premier={tranche.premier}
                  dernier={tranche.dernier}
                  unite={groupe.unite}
                />
              </Suspense>
            </>
          ) : (
            /* ── Vue groupée ─────────────────────────────────────────────── */
            /* L'ordre des groupes suit le CLASSEMENT de la base, pas l'ordre de
               déclaration : sur « SV10 », le set est en rang 0 et la carte du
               set SMA en rang 1 — afficher « Cartes » en premier ferait passer
               la carte devant le set, ce que la recherche a justement écarté.
               À meilleur rang égal, le groupe le plus fourni passe devant. */
            GROUPES.map(g => {
              const duGroupe = resultats.filter(r => r.type === g.type)
              return { g, duGroupe, meilleurRang: Math.min(...duGroupe.map(r => r.rang), 99) }
            })
            .sort((a, b) => a.meilleurRang - b.meilleurRang || b.duGroupe.length - a.duGroupe.length)
            .map(({ g, duGroupe }) => {
              return (
                <GroupeResultats
                  key={g.type}
                  titre={g.titre}
                  unite={g.unite}
                  resultats={duGroupe.slice(0, PAR_GROUPE)}
                  total={duGroupe.length}
                  hrefVoirTout={lienGroupe(g.type, q)}
                />
              )
            })
          )}
        </PageContainer>
      </main>

      <SiteFooter />
    </>
  )
}
