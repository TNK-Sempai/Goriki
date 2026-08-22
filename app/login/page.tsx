import { Suspense } from 'react'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import PageContainer from '@/components/layout/PageContainer'
import AuthPanel from '@/components/auth/AuthPanel'

export const metadata = { title: 'Connexion' }

export default function LoginPage() {
  return (
    <>
      <SiteHeader />
      <main className="font-grotesk text-ink">
        <PageContainer className="flex items-center justify-center py-16 lg:py-24">
          <Suspense fallback={<div className="glass h-[520px] w-full max-w-[440px] rounded-hero" />}>
            <AuthPanel initialMode="login" />
          </Suspense>
        </PageContainer>
      </main>
      <SiteFooter />
    </>
  )
}
