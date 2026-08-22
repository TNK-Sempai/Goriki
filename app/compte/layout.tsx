import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import PageContainer from '@/components/layout/PageContainer'
import CompteNav from '@/components/compte/CompteNav'

/**
 * Coquille de l'espace client — cases 8, 9 et 10 de la planche de référence.
 *
 * La planche donne à CHAQUE écran de compte son propre grand titre
 * (« MON COMPTE », « MES COMMANDES », « MA WANT LIST ») : le titre unique
 * « Mon compte » que ce layout imposait à toutes les sous-pages est supprimé,
 * chaque page pose désormais le sien.
 *
 * La colonne de navigation reste ici : elle est commune aux trois cases et
 * inclut la déconnexion, comme sur la planche (dernière entrée de la liste).
 */
export default async function CompteLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/compte')

  // Rôle lu à la MÊME source que la garde de route `/admin` et le middleware :
  // `profiles.role`. Aucun mécanisme de permission supplémentaire n'est créé —
  // le lien ne fait que naviguer, il n'accorde rien. Un second administrateur
  // le verra donc apparaître dès que son `role` passe à `admin`, sans liste
  // blanche ni déploiement.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return (
    <>
      <SiteHeader />

      <main className="font-grotesk text-ink">
        <PageContainer as="section" className="pb-16 pt-10 lg:pb-20 lg:pt-14">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[212px_1fr] lg:items-start lg:gap-8">
            <CompteNav isAdmin={profile?.role === 'admin'} />
            <div className="min-w-0">{children}</div>
          </div>
        </PageContainer>
      </main>

      <SiteFooter />
    </>
  )
}
