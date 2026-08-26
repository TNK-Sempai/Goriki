import PageContainer from '@/components/layout/PageContainer'
import SiteHeader from '@/components/layout/SiteHeader'
import { Bloc } from '@/components/layout/Squelette'

/**
 * Attente de la fiche produit — la route la plus fréquentée du site, et celle
 * qui restait le plus longtemps sans réponse : 879 ms mesurées entre le clic
 * et la moindre trace à l'écran.
 *
 * Cette page a sa coquille à elle plutôt que la `Coquille` partagée : sa
 * composition n'est pas celle du catalogue (fil d'Ariane, puis deux colonnes
 * `50fr / 50fr` — le visuel scanné à gauche, la colonne d'inspection et
 * d'achat à droite), et un squelette qui n'aurait pas ces proportions ferait
 * sauter la mise en page à l'arrivée.
 *
 * Le fond d'univers n'est PAS reproduit ici. `app/[slug]/layout.tsx` le monte
 * déjà, et un layout persiste pendant l'affichage du `loading.tsx` de son
 * segment : le fond est donc en place avant même que le squelette apparaisse.
 * Le redessiner aurait posé deux fonds l'un sur l'autre.
 */
export default function ChargementFiche() {
  return (
    <>
      <SiteHeader />
      <main className="font-grotesk text-ink" role="status" aria-busy="true" aria-label="Chargement de la fiche">
        <PageContainer as="nav" className="pt-8">
          <Bloc className="h-[11px] w-[240px]" />
        </PageContainer>

        <PageContainer as="section" className="pb-14 pt-6 lg:pb-20">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,50fr)_minmax(0,50fr)] lg:gap-12">
            {/* Colonne gauche — le visuel */}
            <div className="glass rounded-panel-lg p-5">
              <Bloc className="aspect-[63/88] w-full rounded-[10px]" />
              <div className="mt-4 flex gap-2">
                <Bloc className="h-[54px] w-[38px] rounded-[5px]" />
                <Bloc className="h-[54px] w-[38px] rounded-[5px]" />
              </div>
            </div>

            {/* Colonne droite — identité, prix, fiche technique */}
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3">
                <Bloc className="h-[10px] w-[92px]" />
                <Bloc className="h-[34px] w-[78%] rounded-[6px]" />
                <Bloc className="h-[34px] w-[52%] rounded-[6px]" />
              </div>

              <div className="glass rounded-panel-lg p-5">
                <Bloc className="h-[28px] w-[130px] rounded-[6px]" />
                <Bloc className="mt-3 h-[12px] w-[170px]" />
                <Bloc className="mt-5 h-[46px] w-full rounded-control" />
              </div>

              <section className="glass rounded-panel-lg p-5">
                <Bloc className="h-[10px] w-[110px]" />
                <div className="mt-4 flex flex-col gap-3">
                  {['w-[58%]', 'w-[72%]', 'w-[46%]', 'w-[64%]'].map(l => (
                    <div key={l} className="flex items-center justify-between gap-6">
                      <Bloc className="h-[11px] w-[84px]" />
                      <Bloc className={`h-[11px] ${l}`} />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </PageContainer>
      </main>
    </>
  )
}
