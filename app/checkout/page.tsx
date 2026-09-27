import { redirect } from 'next/navigation'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import CheckoutClient from '@/components/cart/CheckoutClient'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Commande' }

export default async function CheckoutPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  /**
   * SESSION EXIGÉE, comme sur toutes les pages /compte.
   *
   * La page tolérait un visiteur anonyme et n'échouait qu'au clic sur Payer,
   * par un « Non connecté ». Depuis que le devis de livraison part dès
   * l'affichage, cet anonymat produit surtout un `401` sur
   * `/api/checkout/livraison` et un écran sans aucune option — symptôme
   * observé en navigation privée. La route a raison de refuser : c'est la page
   * qui n'aurait jamais dû laisser entrer sans session.
   */
  if (!user) redirect('/login?redirect=/checkout')

  // L'avoir est lu côté serveur : la RLS de `profiles` ne laisse voir que le sien.
  const { data: profile } = await supabase
    .from('profiles')
    .select('store_credit')
    .eq('id', user.id)
    .single()
  const storeCredit = profile?.store_credit ?? 0

  return (
    <>
      <SiteHeader />
      <CheckoutClient storeCredit={storeCredit} />
      <SiteFooter />
    </>
  )
}
