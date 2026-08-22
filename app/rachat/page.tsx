import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import PageContainer from '@/components/layout/PageContainer'
import SelecteurSingles from '@/components/rachat/SelecteurSingles'
import DeclarationBulk from '@/components/rachat/DeclarationBulk'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Rachat de cartes' }
export const dynamic = 'force-dynamic'

/**
 * Rachat — deux parcours distincts, aucun prix affiché.
 *
 * RÈGLE MÉTIER : le prix n'existe qu'après inspection physique. L'écran
 * précédent affichait une « estimation totale » recalculée à chaque frappe —
 * elle contredisait la phrase imprimée juste en dessous d'elle. L'estimateur a
 * été supprimé, pas ajusté.
 *
 *   · Singles → cascade univers / extension / carte / version, liste latérale
 *     cumulative, CTA « Soumettre pour inspection ».
 *   · Bulk    → catégories grossières et volume déclaré ; au-delà du seuil,
 *     plus de formulaire, contact direct.
 *
 * La page est PUBLIQUE : on construit son lot sans compte. L'état de session
 * est lu ici pour que le CTA dise la vérité (« Se connecter pour soumettre »
 * plutôt qu'un envoi qui échoue en 401), et le lot survit à l'aller-retour de
 * connexion via `sessionStorage`.
 */
export default async function RachatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const mode = sp.mode === 'bulk' ? 'bulk' : 'singles'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let verified = false
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('identity_verified')
      .eq('id', user.id)
      .single()
    verified = data?.identity_verified === true
  }

  const MODES = [
    { v: 'singles', label: 'Carte par carte', href: '/rachat' },
    { v: 'bulk', label: 'Lot en vrac', href: '/rachat?mode=bulk' },
  ]

  return (
    <>
      <SiteHeader />

      <main className="font-grotesk text-ink">
        <PageContainer as="section" className="pb-16 pt-10 lg:pb-20 lg:pt-14">
          <h1 className="display-section m-0">Rachat de cartes</h1>
          <p className="m-0 mt-4 max-w-[58ch] text-[14px] leading-[1.6] text-ink-70">
            Constituez votre lot, envoyez-le, nous l&apos;inspectons pièce par pièce.
            L&apos;offre ferme est chiffrée après réception — nous n&apos;annonçons jamais un
            prix sur des cartes que nous n&apos;avons pas eues en main.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {MODES.map(m => (
              <Link key={m.v} href={m.href} className="pill" data-active={mode === m.v}>
                {m.label}
              </Link>
            ))}
          </div>

          <div className="mt-2">
            {mode === 'bulk' ? (
              <DeclarationBulk connected={!!user} verified={verified} />
            ) : (
              <SelecteurSingles connected={!!user} verified={verified} />
            )}
          </div>
        </PageContainer>
      </main>

      <SiteFooter />
    </>
  )
}
