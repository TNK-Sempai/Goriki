import Link from 'next/link'
import PageContainer from '@/components/layout/PageContainer'
import { MESSAGE_BIENTOT } from '@/lib/fonctionnalites'

/**
 * Écran d'une fonctionnalité pas encore ouverte.
 *
 * Il DIT ce qui se passe plutôt que de rendre une page vide ou un 404 : le lien
 * de navigation reste visible, donc le visiteur qui clique doit comprendre qu'il
 * n'est pas tombé sur une panne. Aucun formulaire, aucun champ : rien qui laisse
 * croire qu'une demande puisse être déposée.
 */
export default function BientotDisponible({
  titre,
  accroche,
}: {
  titre: string
  /** Une phrase propre à la fonction, en plus du message commun. */
  accroche?: string
}) {
  return (
    <main className="font-grotesk text-ink">
      <PageContainer className="pb-24 pt-14 lg:pt-20">
        <div className="max-w-[58ch]">
          <span className="data text-[9px]">Bientôt disponible</span>
          <h1 className="display-section m-0 mb-5 mt-3">{titre}</h1>

          <p className="m-0 mb-4 text-[15px] leading-[1.7] text-ink-70">{MESSAGE_BIENTOT}</p>
          {accroche && (
            <p className="m-0 mb-8 text-[15px] leading-[1.7] text-ink-70">{accroche}</p>
          )}

          <div className="hair mb-8" />

          <div className="flex flex-wrap gap-3">
            <Link href="/catalogue" className="btn-ochre px-6 py-3.5 text-[14px]">
              Voir le catalogue
            </Link>
            <Link
              href="/"
              className="rounded-control border border-[rgba(26,22,17,0.16)] bg-[rgba(255,255,255,0.6)] px-6 py-3.5 text-[14px] text-ink transition-colors hover:bg-white"
            >
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </PageContainer>
    </main>
  )
}
