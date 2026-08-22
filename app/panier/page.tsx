import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import PanierClient from '@/components/cart/PanierClient'

export const metadata = { title: 'Panier' }

export default function PanierPage() {
  return (
    <>
      <SiteHeader />
      <PanierClient />
      <SiteFooter />
    </>
  )
}
