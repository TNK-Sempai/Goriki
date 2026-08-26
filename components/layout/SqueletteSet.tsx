import PageContainer from '@/components/layout/PageContainer'
import SiteHeader from '@/components/layout/SiteHeader'
import { Bloc } from '@/components/layout/Squelette'

/**
 * Attente de la fiche de set — bande héro puis grille de cartes.
 *
 * POURQUOI CE FICHIER EXISTE ALORS QUE `app/catalogue/loading.tsx` EXISTE
 * DÉJÀ. Une frontière de chargement ne se déclenche que sur le segment qui
 * CHANGE. En passant de `/catalogue/pokemon` à `/catalogue/pokemon/{set}`, le
 * segment `/catalogue` ne bouge pas : sa frontière n'est jamais rejouée. C'est
 * exactement ce que la mesure a montré — les deux autres navigations
 * répondaient en 11 et 20 ms pendant que celle-ci restait muette 613 ms.
 * La frontière devait donc descendre au niveau de `[set]`.
 *
 * Partagé par les deux univers : Pokémon et One Piece rendent le même
 * `SetDetail`, donc la même composition. Deux fichiers `loading.tsx` de trois
 * lignes le réexportent, un par segment `[set]`.
 */
export default function SqueletteSet() {
  return (
    <>
      <SiteHeader />
      <main className="font-grotesk text-ink" role="status" aria-busy="true" aria-label="Chargement du set">
        <PageContainer as="nav" className="pt-8">
          <Bloc className="h-[11px] w-[210px]" />
        </PageContainer>

        {/* Bande héro — proportions reprises de `SetDetail` (52fr / 48fr) */}
        <PageContainer as="section" className="pb-8 pt-6 lg:pb-10">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,52fr)_minmax(0,48fr)]">
            <div className="flex flex-col">
              <Bloc className="h-[9px] w-[54px]" />
              <Bloc className="mt-3 h-[40px] w-[80%] rounded-[6px]" />
              <Bloc className="mt-2 h-[40px] w-[54%] rounded-[6px]" />
              <div className="mt-6 flex flex-col gap-3 lg:mt-7">
                {['w-[62%]', 'w-[48%]', 'w-[70%]', 'w-[40%]'].map(l => (
                  <Bloc key={l} className={`h-[13px] ${l}`} />
                ))}
              </div>
              <Bloc className="mt-7 h-[48px] w-[248px] rounded-control lg:mt-9" />
            </div>
            <Bloc className="aspect-[4/3] w-full rounded-panel-lg" />
          </div>
        </PageContainer>

        {/* Grille de cartes */}
        <PageContainer as="section" className="pb-16 lg:pb-20">
          <div className="mb-7 flex flex-wrap gap-2">
            {['w-[68px]', 'w-[92px]', 'w-[76px]', 'w-[104px]'].map(l => (
              <Bloc key={l} className={`h-[32px] rounded-control ${l}`} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 15 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Bloc className="aspect-[63/88] w-full rounded-panel" />
                <Bloc className="h-[11px] w-[70%]" />
                <Bloc className="h-[9px] w-[44%]" />
              </div>
            ))}
          </div>
        </PageContainer>
      </main>
    </>
  )
}
