import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import PageContainer from '@/components/layout/PageContainer'
import SeriesIndexClient from '@/components/catalogue/SeriesIndexClient'
import { createClient } from '@/lib/supabase/server'
import { getSeriesByEra } from '@/lib/catalogue/series'
import { UNIVERSES } from '@/lib/universe-theme'

export const metadata = { title: 'Séries Pokémon' }

export default async function PokemonSeriesPage() {
  const supabase = await createClient()
  const eras = await getSeriesByEra(supabase, 'pokemon')
  const theme = UNIVERSES.pokemon

  return (
    <>
      <SiteHeader />
      <main className="font-grotesk text-ink">
        <PageContainer as="section" className="pb-10 pt-12 lg:pt-16">
          <span className="eyebrow" style={{ letterSpacing: theme.eyebrowTracking }}>
            {theme.eyebrow}
          </span>
          <h1 className="mt-4 text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] lg:text-[44px]">
            Séries Pokémon
          </h1>
          <p className={`mt-4 text-ink-70 ${theme.voiceClass}`}>{theme.tagline}</p>
        </PageContainer>

        <PageContainer as="section" className="pb-16">
          <SeriesIndexClient
            eras={eras}
            basePath="/catalogue/pokemon"
            emptyLabel="Aucune extension active pour le moment."
          />
        </PageContainer>
      </main>
      <SiteFooter />
    </>
  )
}
