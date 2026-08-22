import { createClient } from '@/lib/supabase/server'
import WantToBuyForm from '@/components/compte/WantToBuyForm'
import WantList, { type WantRow } from '@/components/compte/WantList'

export const metadata = { title: 'Ma want list' }

/**
 * Want to Buy — case 8 de la planche de référence.
 *
 * La requête ne filtre PLUS sur `status = 'active'` : la planche compte
 * explicitement les demandes trouvées à côté des demandes en attente, ce qui
 * suppose de charger tous les statuts.
 *
 * Pour chaque demande rattachée au catalogue, on cherche en plus un listing
 * réellement en vente : c'est lui qui alimente le bouton « Voir » de la ligne.
 */
export default async function WantToBuyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from('want_to_buy_requests')
    .select('id, card_type, card_id, free_text, max_price, status, created_at')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  const demandes = data ?? []
  const pkmIds = demandes.filter(r => r.card_type === 'pokemon' && r.card_id).map(r => r.card_id!)
  const opIds = demandes.filter(r => r.card_type === 'onepiece' && r.card_id).map(r => r.card_id!)

  const [pkm, op, pkmLive, opLive] = await Promise.all([
    pkmIds.length
      ? supabase.from('pokemon_cards').select('id, name_fr, number, image_url').in('id', pkmIds)
      : Promise.resolve({ data: [] }),
    opIds.length
      ? supabase.from('onepiece_cards').select('id, name_fr, number, image_url').in('id', opIds)
      : Promise.resolve({ data: [] }),
    pkmIds.length
      ? supabase.from('pokemon_listings').select('id, card_id').in('card_id', pkmIds).eq('is_active', true).gt('quantity', 0).gt('price', 0)
      : Promise.resolve({ data: [] }),
    opIds.length
      ? supabase.from('onepiece_listings').select('id, card_id').in('card_id', opIds).eq('is_active', true).gt('quantity', 0).gt('price', 0)
      : Promise.resolve({ data: [] }),
  ])

  const cartes = new Map<string, { name_fr: string; number: string; image_url: string | null }>()
  for (const c of [...(pkm.data ?? []), ...(op.data ?? [])]) cartes.set(c.id, c)

  const listings = new Map<string, string>()
  for (const l of [...(pkmLive.data ?? []), ...(opLive.data ?? [])]) {
    if (l.card_id && !listings.has(l.card_id)) listings.set(l.card_id, l.id)
  }

  const rows: WantRow[] = demandes.map(r => {
    const c = r.card_id ? cartes.get(r.card_id) : undefined
    return {
      id: r.id,
      label: c?.name_fr ?? r.free_text ?? 'Carte',
      ref: c?.number ?? null,
      imageUrl: c?.image_url ?? null,
      maxPrice: r.max_price,
      status: r.status,
      listingId: r.card_id ? (listings.get(r.card_id) ?? null) : null,
      createdAt: r.created_at,
    }
  })

  return (
    <>
      <h1 className="display-section m-0">Ma want list</h1>
      <p className="m-0 mb-7 mt-4 max-w-[56ch] text-[14px] leading-[1.6] text-ink-70 lg:mb-9">
        Suivez vos recherches et soyez notifié dès qu&apos;une pièce entre en stock.
        Aucune vérification d&apos;identité n&apos;est requise : il suffit d&apos;être connecté.
      </p>

      <WantList rows={rows} />

      <section className="glass mt-4 flex flex-col gap-4 rounded-panel-lg p-5 lg:p-6">
        <h2 className="display-sub m-0">Ajouter une recherche</h2>
        <p className="m-0 max-w-[62ch] text-[13px] leading-[1.6] text-ink-70">
          Si la carte est au catalogue, choisissez-la ; sinon, décrivez-la.
        </p>
        <WantToBuyForm />
      </section>
    </>
  )
}
