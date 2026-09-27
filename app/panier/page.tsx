import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import PanierClient from '@/components/cart/PanierClient'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Panier' }

/**
 * Le minimum de commande est lu ICI, côté serveur.
 *
 * Le panier vit en `sessionStorage` et ne sait rien de la base. Annoncer le
 * minimum dès le panier évite la découverte au dernier écran, une fois
 * l'adresse saisie — c'est le genre de refus tardif qui fait abandonner.
 * La valeur vient de `shipping_settings`, lisible publiquement.
 */
export default async function PanierPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shipping_settings')
    .select('min_order_value')
    .eq('id', 1)
    .maybeSingle()

  return (
    <>
      <SiteHeader />
      <PanierClient minimumCommande={Number(data?.min_order_value ?? 0)} />
      <SiteFooter />
    </>
  )
}
