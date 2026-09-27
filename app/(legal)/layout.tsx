import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import PageContainer from '@/components/layout/PageContainer'

/**
 * Coquille commune aux quatre documents légaux.
 *
 * ─── LARGEUR DE LECTURE ───────────────────────────────────────────────────
 * `max-w-[68ch]` et non la gouttière pleine : au-delà d'environ 70 caractères
 * par ligne, l'œil perd le début de la ligne suivante. Sur un texte de contrat
 * que personne ne lit par plaisir, c'est ce qui décide qu'il soit lu ou non.
 * Le conteneur reste `<PageContainer>` : la structure de page est verrouillée
 * par le projet, la largeur de lecture se pose À L'INTÉRIEUR.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="font-grotesk text-ink">
        <PageContainer className="pb-20 pt-10 lg:pt-14">
          <article className="max-w-[68ch]">{children}</article>
        </PageContainer>
      </main>
      <SiteFooter />
    </>
  )
}
