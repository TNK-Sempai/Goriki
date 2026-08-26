import PageContainer from '@/components/layout/PageContainer'
import SiteHeader from '@/components/layout/SiteHeader'

/**
 * Squelettes d'attente du parcours public.
 *
 * POURQUOI CES FICHIERS EXISTENT. Sans `loading.tsx`, Next attend d'avoir
 * TOUT le rendu serveur avant de remplacer l'écran : l'utilisateur reste sur
 * la page précédente, rien ne bouge, puis tout apparaît d'un coup. Mesuré sur
 * ce site avant correction — 788 ms sur `accueil → catalogue`, 1092 ms sur
 * `catalogue → fiche de set` — pendant lesquelles il ne se passait
 * rigoureusement rien à l'écran. C'est ça, le « lent puis brutal » : les deux
 * symptômes rapportés n'étaient qu'une seule et même absence.
 *
 * Ces squelettes ne rendent pas la navigation plus rapide. Ils rendent la
 * réponse IMMÉDIATE, ce qui n'est pas la même chose et compte davantage.
 *
 * Ils portent aussi un second effet, moins visible : un `loading.tsx` crée une
 * frontière que le préchargement de Next sait remplir et garder en cache
 * (`staleTimes.static`), là où le préchargement d'une route entièrement
 * dynamique était jusqu'ici jeté à l'arrivée.
 *
 * `<SiteHeader />` est repris tel quel : c'est un composant client qui ne
 * bloque aucun rendu serveur, et l'omettre ferait clignoter la barre de
 * navigation à chaque changement de page — on aurait remplacé une brutalité
 * par une autre.
 *
 * L'animation vient de `.skeleton` (`styles/components.css`), déjà au dépôt.
 * Elle s'éteint sous `prefers-reduced-motion` par la règle globale de
 * `globals.css`, qui ramène toute animation à 0,01 ms : les blocs restent
 * alors visibles et fixes.
 */

/** Un bloc gris animé. `className` porte la taille, jamais l'apparence. */
export function Bloc({ className }: { className: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />
}

/**
 * Coquille commune : en-tête réel + zone de contenu, annoncée aux lecteurs
 * d'écran comme occupée. `aria-busy` sur un `role="status"` est ce qui évite
 * qu'un utilisateur non-voyant reste sans nouvelle pendant l'attente — le
 * pendant exact du squelette pour les autres.
 */
export function Coquille({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="font-grotesk text-ink" role="status" aria-busy="true" aria-label="Chargement en cours">
        <PageContainer as="section" className="pb-16 pt-10 lg:pb-20 lg:pt-14">
          {children}
        </PageContainer>
      </main>
    </>
  )
}
