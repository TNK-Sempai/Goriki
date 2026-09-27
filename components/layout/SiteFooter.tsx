import Link from 'next/link'
import { SITE_NAME } from '@/lib/constants'
import { PAGES_LEGALES } from '@/lib/legal'
import PageContainer from '@/components/layout/PageContainer'

/**
 * Pied de page — traitement PLAT, comme la barre de navigation.
 *
 * La planche de référence ne pose aucune pilule de verre flottante : les
 * extrémités du document sont fermées par un filet, pas par une carte. Le
 * pied reprend donc la même grammaire que `SiteHeader`.
 *
 * Les liens légaux viennent du registre `PAGES_LEGALES`, comme le sitemap :
 * une liste recopiée ici survivrait à une page renommée.
 */
export default function SiteFooter() {
  return (
    <footer className="hair mt-4">
      <PageContainer>
        <div className="flex flex-col gap-4 py-6">
          <nav className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.12em]">
            {PAGES_LEGALES.map(p => (
              <Link
                key={p.slug}
                href={`/${p.slug}`}
                className="text-ink-55 transition-colors hover:text-ink"
              >
                {p.titre}
              </Link>
            ))}
          </nav>

          <div className="flex flex-col gap-2 font-mono text-[10px] tracking-[0.14em] text-ink-55 sm:flex-row sm:items-center sm:justify-between">
            <span>
              © {new Date().getFullYear()} {SITE_NAME.toUpperCase()} TCG · TOUS DROITS RÉSERVÉS
            </span>
            <span>AUTHENTIFIÉ · SCANNÉ · GARANTI</span>
          </div>
        </div>
      </PageContainer>
    </footer>
  )
}
