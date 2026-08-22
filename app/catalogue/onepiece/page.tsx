import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import PageContainer from '@/components/layout/PageContainer'
import SetsIndex from '@/components/catalogue/SetsIndex'
import CardCursor from '@/components/motion/CardCursor'
import { createClient } from '@/lib/supabase/server'
import { getSeriesByEra } from '@/lib/catalogue/series'

export const metadata = { title: 'One Piece' }
export const dynamic = 'force-dynamic'

/**
 * One Piece — case 2 de la planche : LISTE DES SETS.
 *
 * La landing « bento » précédente (hero + bloc Singles + grille asymétrique de
 * catégories de scellé) ne figure nulle part dans la planche : la racine d'un
 * univers y est directement l'index des sets. `/catalogue/onepiece/series`
 * reste en place pour la vue groupée par ère.
 */
export default async function OnePieceSetsPage() {
  const supabase = await createClient()
  const eras = await getSeriesByEra(supabase, 'onepiece')

  return (
    <>
      <SiteHeader />
      <CardCursor />
      <main className="font-grotesk text-ink">
        <PageContainer as="section" className="pb-16 pt-10 lg:pb-20 lg:pt-14">
          <SetsIndex
            title="One Piece"
            eras={eras}
            basePath="/catalogue/onepiece"
            emptyLabel="Le catalogue One Piece n'est pas encore en ligne."
          />
        </PageContainer>
      </main>
      <SiteFooter />
    </>
  )
}
