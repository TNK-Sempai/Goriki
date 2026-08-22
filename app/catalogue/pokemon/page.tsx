import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import PageContainer from '@/components/layout/PageContainer'
import SetsIndex from '@/components/catalogue/SetsIndex'
import CardCursor from '@/components/motion/CardCursor'
import { createClient } from '@/lib/supabase/server'
import { getSeriesByEra } from '@/lib/catalogue/series'

export const metadata = { title: 'Pokémon' }
export const dynamic = 'force-dynamic'

/**
 * Pokémon — même composition que la case 2 de la planche (liste des sets).
 *
 * La planche ne dessine que la version One Piece de cet écran ; l'univers
 * Pokémon reprend la MÊME structure, comme le veut la règle de responsive et
 * de cohérence : c'est un seul système de composition, pas deux gabarits.
 */
export default async function PokemonSetsPage() {
  const supabase = await createClient()
  const eras = await getSeriesByEra(supabase, 'pokemon')

  return (
    <>
      <SiteHeader />
      <CardCursor />
      <main className="font-grotesk text-ink">
        <PageContainer as="section" className="pb-16 pt-10 lg:pb-20 lg:pt-14">
          <SetsIndex
            title="Pokémon"
            eras={eras}
            basePath="/catalogue/pokemon"
            emptyLabel="Le catalogue Pokémon n'est pas encore en ligne."
          />
        </PageContainer>
      </main>
      <SiteFooter />
    </>
  )
}
