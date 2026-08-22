import Link from 'next/link'
import PageContainer from '@/components/layout/PageContainer'
import type { UniverseTheme } from '@/lib/universe-theme'

export interface BentoTile {
  label: string
  /** Type réel de `sealed_products` (booster, display, etb, tin, coffret, accessoire) */
  type: string
  count: number
  /** Empreinte dans la grille 12 colonnes de la maquette */
  span: string
}

/**
 * Landing d'univers — structure commune aux maquettes `Tanuki One Piece`
 * et `Tanuki Pokemon` : hero, grand bloc « Singles » cliquable, puis grille
 * bento asymétrique des catégories de scellé.
 *
 * Le bento diffère d'un univers à l'autre (4 tuiles côté One Piece, 6 côté
 * Pokémon, empreintes différentes) : il est donc passé en paramètre plutôt que
 * codé en dur ici.
 */
export default function UniverseLanding({
  theme,
  setCount,
  cardCount,
  seriesHref,
  bento,
}: {
  theme: UniverseTheme
  setCount: number
  cardCount: number
  seriesHref: string
  bento: BentoTile[]
}) {
  const nf = new Intl.NumberFormat('fr-FR')
  const hasSingles = cardCount > 0

  return (
    <main className="font-grotesk text-ink">
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <PageContainer as="section" className="pb-2 pt-12 lg:pt-16">
        <span className="eyebrow" style={{ letterSpacing: theme.eyebrowTracking }}>
          {theme.eyebrow}
        </span>
        <h1 className="mt-4 text-[38px] font-semibold leading-[1.05] tracking-[-0.03em] lg:text-[52px]">
          {theme.label}
        </h1>
        <p className={`mt-4 text-ink-70 ${theme.voiceClass}`}>{theme.tagline}</p>
      </PageContainer>

      {/* ── Singles ────────────────────────────────────────────────────── */}
      <PageContainer as="section" className="mt-8">
        <Link
          href={seriesHref}
          className="glass glass-hoverable grid grid-cols-1 items-center gap-8 rounded-hero p-8 transition-colors lg:grid-cols-[1.4fr_1fr] lg:gap-12 lg:p-14"
        >
          <div className="flex flex-col gap-4">
            <span className="eyebrow">Singles</span>
            <h2 className="m-0 text-[26px] font-semibold tracking-[-0.02em] lg:text-[32px]">
              Cartes à l&apos;unité
            </h2>
            <p className="m-0 max-w-[52ch] text-[14px] leading-[1.6] text-ink-70">
              {theme.singlesIntro}
            </p>
            <span className="mt-2 font-mono text-[11px] tracking-[0.14em] text-ink-70">
              {theme.singlesCta}
            </span>
          </div>

          <div className="flex flex-wrap gap-3 font-mono text-[10px] tracking-[0.14em] text-ink-60 lg:justify-end">
            <span className="glass-light rounded-control px-4 py-3">
              {nf.format(setCount)} EXTENSIONS
            </span>
            <span className="glass-light rounded-control px-4 py-3">
              {nf.format(cardCount)} CARTES
            </span>
            {!hasSingles && (
              <span className="glass-light rounded-control px-4 py-3">CATALOGUE À VENIR</span>
            )}
          </div>
        </Link>
      </PageContainer>

      {/* ── Scellé (bento) ─────────────────────────────────────────────── */}
      <PageContainer as="section" className="mb-16 mt-14">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em] lg:text-[26px]">Scellé</h2>
          <Link href="/catalogue/scelles" className="font-mono text-[11px] tracking-[0.14em] text-ink-60">
            TOUT VOIR →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:auto-rows-[120px] lg:grid-cols-12">
          {bento.map(tile => (
            <Link
              key={tile.type}
              href={`/catalogue/scelles?type=${tile.type}`}
              className={`glass glass-hoverable flex items-center justify-between gap-3 rounded-panel px-6 py-6 transition-colors ${tile.span}`}
            >
              <span className="text-[16px] font-semibold leading-tight lg:text-[18px]">
                {tile.label}
              </span>
              <span className="shrink-0 font-mono text-[10px] tracking-[0.1em] text-ink-55">
                {tile.count > 0 ? `${tile.count} RÉF.` : 'BIENTÔT'}
              </span>
            </Link>
          ))}
        </div>
      </PageContainer>
    </main>
  )
}
