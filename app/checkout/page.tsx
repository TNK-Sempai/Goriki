import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import CheckoutClient from '@/components/cart/CheckoutClient'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Commande' }

export default async function CheckoutPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // L'avoir est lu côté serveur : la RLS de `profiles` ne laisse voir que le sien.
  let storeCredit = 0
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('store_credit')
      .eq('id', user.id)
      .single()
    storeCredit = profile?.store_credit ?? 0
  }

  return (
    <>
      <SiteHeader />
      <CheckoutClient storeCredit={storeCredit} />
      <SiteFooter />
    </>
  )
}
