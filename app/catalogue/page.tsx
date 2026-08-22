import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import { UNIVERSE_LIST } from '@/lib/universe-theme'

export const metadata = { title: 'Catalogue' }

export default async function CataloguePage() {
  const supabase = await createClient()

  // Compteurs réels : aucun chiffre en dur dans les blocs d'entrée.
  const [pkmSets, opSets, pkmCards, opCards, sealed] = await Promise.all([
    supabase.from('pokemon_sets').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('onepiece_sets').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('pokemon_cards').select('id', { count: 'exact', head: true }),
    supabase.from('onepiece_cards').select('id', { count: 'exact', head: true }),
    supabase.from('sealed_products').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ])

  const stats: Record<string, { sets: number; cards: number }> = {
    pokemon: { sets: pkmSets.count ?? 0, cards: pkmCards.count ?? 0 },
    onepiece: { sets: opSets.count ?? 0, cards: opCards.count ?? 0 },
  }

  const nf = new Intl.NumberFormat('fr-FR')

  return (
    <>
      <SiteHeader />

      <main className="font-grotesk text-ink">
        <section className="page-shell pb-10 pt-12 lg:pt-16">
          <span className="eyebrow">Archives — deux univers</span>
          <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-[-0.03em] lg:text-[40px]">
            Catalogue
          </h1>
          <p className="mt-4 max-w-[52ch] text-[16px] leading-[1.6] text-ink-70">
            Singles authentifiés, scellés et coffrets. Chaque pièce au-dessus d&apos;un euro
            est scannée recto-verso avant sa mise en vente.
          </p>
        </section>

        {/* ── Les deux univers ─────────────────────────────────────────── */}
        <section className="page-shell">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {UNIVERSE_LIST.map(u => (
              <div key={u.id} className="glass flex flex-col gap-5 rounded-hero p-8 lg:p-10">
                <span className="eyebrow" style={{ letterSpacing: u.eyebrowTracking }}>
                  {u.eyebrow}
                </span>
                <h2 className="m-0 text-[28px] font-semibold tracking-[-0.02em] lg:text-[32px]">
                  {u.label}
                </h2>
                <p className={`m-0 text-ink-70 ${u.voiceClass}`}>{u.tagline}</p>
                <p className="m-0 max-w-[46ch] text-[14px] leading-[1.6] text-ink-70">
                  {u.singlesIntro}
                </p>

                <div className="flex flex-wrap gap-3 font-mono text-[10px] tracking-[0.14em] text-ink-60">
                  <span className="glass-light rounded-control px-3 py-2">
                    {nf.format(stats[u.id].sets)} EXTENSIONS
                  </span>
                  <span className="glass-light rounded-control px-3 py-2">
                    {nf.format(stats[u.id].cards)} CARTES
                  </span>
                </div>

                <Link
                  href={`/catalogue/${u.slug}`}
                  className="btn-ochre mt-1 self-start px-6 py-3.5 font-mono text-[11px] tracking-[0.14em]"
                >
                  {u.singlesCta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* ── Scellés ──────────────────────────────────────────────────── */}
        <section className="page-shell pb-16 pt-6">
          <Link
            href="/catalogue/scelles"
            className="glass glass-hoverable flex flex-col gap-3 rounded-hero p-8 transition-colors lg:flex-row lg:items-center lg:justify-between lg:p-10"
          >
            <div className="flex flex-col gap-2">
              <h2 className="m-0 text-[24px] font-semibold tracking-[-0.02em] lg:text-[26px]">
                Scellés &amp; coffrets
              </h2>
              <p className="m-0 max-w-[52ch] text-[14px] leading-[1.6] text-ink-70">
                Displays, boosters, ETB et coffrets — stock vérifié pièce par pièce.
              </p>
            </div>
            <span className="font-mono text-[11px] tracking-[0.14em] text-ink-60">
              {sealed.count ? `${nf.format(sealed.count)} RÉFÉRENCES →` : 'BIENTÔT EN LIGNE →'}
            </span>
          </Link>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
