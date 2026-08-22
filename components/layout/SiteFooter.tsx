import { SITE_NAME } from '@/lib/constants'
import PageContainer from '@/components/layout/PageContainer'

/**
 * Pied de page — traitement PLAT, comme la barre de navigation.
 *
 * La planche de référence ne pose aucune pilule de verre flottante : les
 * extrémités du document sont fermées par un filet, pas par une carte. Le
 * pied reprend donc la même grammaire que `SiteHeader`.
 */
export default function SiteFooter() {
  return (
    <footer className="hair mt-4">
      <PageContainer>
        <div className="flex flex-col gap-2 py-6 font-mono text-[10px] tracking-[0.14em] text-ink-55 sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} {SITE_NAME.toUpperCase()} TCG — TOUS DROITS RÉSERVÉS
          </span>
          <span>AUTHENTIFIÉ · SCANNÉ · GARANTI</span>
        </div>
      </PageContainer>
    </footer>
  )
}
