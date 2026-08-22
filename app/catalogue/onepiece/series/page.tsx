import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import PageContainer from '@/components/layout/PageContainer'
import SeriesIndexClient from '@/components/catalogue/SeriesIndexClient'
import { createClient } from '@/lib/supabase/server'
import { getSeriesByEra } from '@/lib/catalogue/series'
import { UNIVERSES } from '@/lib/universe-theme'

export const metadata = { title: 'Séries One Piece' }

export default async function OnePieceSeriesPage() {
  const supabase = await createClient()
  const eras = await getSeriesByEra(supabase, 'onepiece')
  const theme = UNIVERSES.onepiece

  return (
    <>
      <SiteHeader />
      <main className="font-grotesk text-ink">
        <PageContainer as="section" className="pb-10 pt-12 lg:pt-16">
          <span className="eyebrow" style={{ letterSpacing: theme.eyebrowTracking }}>
            {theme.eyebrow}
          </span>
          <h1 className="mt-4 text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] lg:text-[44px]">
            Séries One Piece
          </h1>
          <p className={`mt-4 text-ink-70 ${theme.voiceClass}`}>{theme.tagline}</p>
        </PageContainer>

        <PageContainer as="section" className="pb-16">
          <SeriesIndexClient
            eras={eras}
            basePath="/catalogue/onepiece"
            emptyLabel="Le catalogue One Piece n'est pas encore en ligne — la source de données reste à trancher."
          />
        </PageContainer>
      </main>
      <SiteFooter />
    </>
  )
}
