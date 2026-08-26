import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatPrice } from '@/lib/utils'
import ProfilForm from '@/components/compte/ProfilForm'

export const metadata = { title: 'Mon compte' }

/**
 * Profil — case 10 de la planche de référence.
 *
 * Composition de la planche : grand titre « MON COMPTE », colonne de
 * navigation à gauche (fournie par le layout), panneau « INFORMATIONS
 * PERSONNELLES » à droite avec avatar et bouton « Enregistrer », puis les
 * indicateurs du compte en pied.
 */

const STATUS_LABEL: Record<string, string> = {
  none: 'Non soumise',
  pending: 'En cours de vérification',
  verified: 'Vérifiée',
  rejected: 'Refusée',
}

export default async function ComptePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, orders, wishlist, { data: depots }, { data: lastAddress }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, username, email, store_credit, created_at, identity_status')
      .eq('id', user!.id)
      .single(),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
    supabase.from('wishlist_items').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
    supabase.rpc('mes_depots'),
    // Aucune table d'adresses : la dernière adresse de livraison connue vient
    // de la commande la plus récente.
    supabase
      .from('orders')
      .select('shipping_address')
      .eq('user_id', user!.id)
      .not('shipping_address', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const address = (lastAddress?.shipping_address ?? null) as Record<string, string> | null
  const identity = profile?.identity_status ?? 'none'

  const CHIFFRES = [
    { k: 'Avoir boutique', v: formatPrice(profile?.store_credit ?? 0) },
    { k: 'Commandes', v: String(orders.count ?? 0) },
    { k: 'Wishlist', v: String(wishlist.count ?? 0) },
    { k: 'Dépôts', v: String((depots as unknown[] | null)?.length ?? 0) },
  ]

  return (
    <>
      <h1 className="display-section m-0 mb-7 lg:mb-9">Mon compte</h1>

      <div className="flex flex-col gap-4">
        <ProfilForm
          initialName={profile?.full_name ?? ''}
          initialUsername={profile?.username ?? ''}
          email={profile?.email ?? ''}
          identityLabel={STATUS_LABEL[identity]}
          identityVerified={identity === 'verified'}
        />

        {/* Indicateurs du compte — rangée fine, pas quatre gros panneaux. */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {CHIFFRES.map(c => (
            <div key={c.k} className="glass-light flex flex-col rounded-panel px-4 py-4">
              <span className="data text-[9px]">{c.k}</span>
              <span className="mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em] text-ink">
                {c.v}
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="glass flex flex-col rounded-panel-lg p-5 lg:p-6">
            <h2 className="display-sub m-0">Adresse de livraison</h2>
            {address ? (
              <div className="mt-4 flex flex-col gap-0.5 text-[14px] leading-[1.6] text-ink">
                <span>{address.line1}</span>
                {address.line2 && <span>{address.line2}</span>}
                <span>{address.postal_code} {address.city}</span>
                <span>{address.country}</span>
              </div>
            ) : (
              <p className="m-0 mt-4 text-[14px] leading-[1.6] text-ink-70">
                Aucune adresse enregistrée. Elle sera reprise de votre prochaine commande.
              </p>
            )}
            <span className="data mt-auto pt-5 text-[9px]">Reprise de la dernière commande</span>
          </section>

          <section className="glass flex flex-col rounded-panel-lg p-5 lg:p-6">
            <h2 className="display-sub m-0">Vérification d&apos;identité</h2>
            <p className="m-0 mt-4 max-w-[44ch] text-[14px] leading-[1.6] text-ink-70">
              Obligatoire avant tout rachat ou dépôt-vente. Votre document reste privé et
              n&apos;est lisible que par vous et l&apos;équipe Goriki.
            </p>
            <span className="mt-4 text-[14px] text-ink">{STATUS_LABEL[identity]}</span>
            <Link href="/compte/verification" className="data mt-auto pt-5 text-[9px] hover:text-ochre">
              {identity === 'verified' ? 'Voir ma vérification →' : 'Vérifier mon identité →'}
            </Link>
          </section>
        </div>
      </div>
    </>
  )
}
