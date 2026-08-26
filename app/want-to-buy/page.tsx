import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import PageContainer from '@/components/layout/PageContainer'
import CardCursor from '@/components/motion/CardCursor'
import Reveal from '@/components/motion/Reveal'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Want to Buy — le radar' }
export const dynamic = 'force-dynamic'

/**
 * Want to Buy — RADAR PUBLIC.
 *
 * Page d'atterrissage du lien de nav « Want to Buy ». Elle montre ce que la
 * communauté recherche, sans connexion et sans formulaire : c'est un signal
 * collectif, pas un outil personnel.
 *
 * Séparation des rôles (décision d'architecture 59) :
 *   · `/want-to-buy`        → agrégat public, lecture seule. AUCUN formulaire.
 *   · `/compte/want-to-buy` → gestion de SES propres recherches, depuis l'espace
 *                             compte uniquement.
 *   · Fiche carte           → bouton « ♡ Je la cherche » sur une pièce
 *                             indisponible : c'est le point d'ajout naturel.
 *
 * Les données viennent de `want_to_buy_radar()` (migration 0025), une fonction
 * `SECURITY DEFINER` qui ne rend QUE des agrégats : la table reste en lecture
 * propriétaire, et ni `user_id`, ni `max_price`, ni `free_text` ne sortent.
 */

interface RadarRow {
  card_type: string
  card_id: string
  demandes: number
  derniere: string
}

interface Ligne {
  key: string
  universe: 'onepiece' | 'pokemon'
  name: string
  ref: string
  imageUrl: string | null
  demandes: number
  /** listing réellement en vente, s'il y en a un */
  listingId: string | null
}

export default async function WantToBuyRadarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const filtre = typeof sp.u === 'string' ? sp.u : ''

  const supabase = await createClient()
  const { data } = await supabase.rpc('want_to_buy_radar')
  const rows = (data ?? []) as RadarRow[]

  const opIds = rows.filter(r => r.card_type === 'onepiece').map(r => r.card_id)
  const pkmIds = rows.filter(r => r.card_type === 'pokemon').map(r => r.card_id)

  const [op, pkm, opLive, pkmLive] = await Promise.all([
    opIds.length
      ? supabase.from('onepiece_cards').select('id, name_fr, number, image_url').in('id', opIds)
      : Promise.resolve({ data: [] }),
    pkmIds.length
      ? supabase.from('pokemon_cards').select('id, name_fr, number, image_url').in('id', pkmIds)
      : Promise.resolve({ data: [] }),
    opIds.length
      ? supabase.from('onepiece_listings').select('id, card_id').in('card_id', opIds)
          .eq('is_active', true).gt('quantity', 0).gt('price', 0)
      : Promise.resolve({ data: [] }),
    pkmIds.length
      ? supabase.from('pokemon_card_variants').select('id, card_id, pokemon_listings!inner(id)').in('card_id', pkmIds)
          .eq('pokemon_listings.is_active', true).gt('pokemon_listings.quantity', 0).gt('pokemon_listings.price', 0)
      : Promise.resolve({ data: [] }),
  ])

  const cartes = new Map<string, { name_fr: string; number: string; image_url: string | null }>()
  for (const c of [...(op.data ?? []), ...(pkm.data ?? [])]) cartes.set(c.id, c)

  const listings = new Map<string, string>()
  for (const l of [...(opLive.data ?? []), ...(pkmLive.data ?? [])]) {
    if (l.card_id && !listings.has(l.card_id)) listings.set(l.card_id, l.id)
  }

  const lignes: Ligne[] = rows
    .map(r => {
      const c = cartes.get(r.card_id)
      if (!c) return null
      return {
        key: `${r.card_type}-${r.card_id}`,
        universe: r.card_type as 'onepiece' | 'pokemon',
        name: c.name_fr,
        ref: c.number,
        imageUrl: c.image_url,
        demandes: Number(r.demandes),
        listingId: listings.get(r.card_id) ?? null,
      }
    })
    .filter((l): l is Ligne => l !== null)

  const visibles = filtre ? lignes.filter(l => l.universe === filtre) : lignes
  const total = lignes.reduce((n, l) => n + l.demandes, 0)
  const dispo = lignes.filter(l => l.listingId).length

  const FILTRES = [
    { v: '', label: 'Tous' },
    { v: 'onepiece', label: 'One Piece' },
    { v: 'pokemon', label: 'Pokémon' },
  ]
  const href = (v: string) => (v ? `/want-to-buy?u=${v}` : '/want-to-buy')
  const pad = (v: number) => String(v).padStart(3, '0')

  return (
    <>
      <SiteHeader />
      <CardCursor />

      <main className="font-grotesk text-ink">
        <PageContainer as="section" className="pb-16 pt-10 lg:pb-20 lg:pt-14">
          <div className="mb-8 flex flex-col gap-8 lg:mb-10 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[48ch]">
              <h1 className="display-section m-0">Want to Buy</h1>
              <p className="m-0 mt-4 text-[14px] leading-[1.6] text-ink-70">
                Le radar des recherches en cours. Ce que la communauté cherche en ce moment —
                si une pièce y figure et que vous l&apos;avez, nous la reprenons en priorité.
              </p>
              <Link href="/compte/want-to-buy" className="data mt-5 inline-block text-[9px] hover:text-ochre">
                Gérer mes propres recherches →
              </Link>
            </div>

            <div className="flex gap-10 lg:gap-14">
              <div className="flex flex-col">
                <span className="text-[40px] font-semibold leading-none tracking-[-0.03em] text-ink lg:text-[46px]">
                  {pad(lignes.length)}
                </span>
                <span className="data mt-2 text-[9px]">cartes recherchées</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[40px] font-semibold leading-none tracking-[-0.03em] text-ink lg:text-[46px]">
                  {pad(total)}
                </span>
                <span className="data mt-2 text-[9px]">demandes au total</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[40px] font-semibold leading-none tracking-[-0.03em] text-ochre lg:text-[46px]">
                  {pad(dispo)}
                </span>
                <span className="data mt-2 text-[9px]">déjà en stock</span>
              </div>
            </div>
          </div>

          {lignes.length > 0 && (
            <div className="mb-7 flex flex-wrap gap-2 lg:mb-9">
              {FILTRES.map(f => (
                <Link key={f.v || 'all'} href={href(f.v)} className="pill" data-active={filtre === f.v}>
                  {f.label}
                </Link>
              ))}
            </div>
          )}

          {visibles.length === 0 ? (
            <div className="glass rounded-block px-8 py-16 text-center">
              <p className="m-0 mb-2 text-[14px] text-ink-70">
                {lignes.length === 0
                  ? 'Aucune recherche en cours pour le moment.'
                  : 'Aucune recherche dans cet univers.'}
              </p>
              <p className="m-0 text-[13px] text-ink-55">
                Le radar se remplit depuis les fiches carte : le bouton « Je la cherche »
                apparaît sur toute pièce indisponible.
              </p>
            </div>
          ) : (
            <Reveal
              className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5"
              stagger={0.05}
              y={14}
            >
              {visibles.map(l => (
                <div key={l.key} data-card-hover className="glass group flex flex-col overflow-hidden rounded-panel">
                  <div className="relative aspect-[2.5/3.5] overflow-hidden">
                    {l.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- vignette dense de grille
                      <img
                        src={l.imageUrl}
                        alt={l.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="scan-pending h-full w-full" />
                    )}
                    <span className="corner-tag absolute left-2 top-2">
                      {l.demandes} recherche{l.demandes > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col px-3 py-2.5">
                    <span className="data text-[8px]">{l.ref}</span>
                    <span className="line-clamp-1 text-[12px] font-medium leading-tight text-ink">{l.name}</span>
                    <div className="mt-2">
                      {l.listingId ? (
                        <Link
                          href={`/${l.listingId}`}
                          className="status inline-block hover:opacity-80"
                          data-tone="done"
                        >
                          En stock →
                        </Link>
                      ) : (
                        <span className="status" data-tone="wait">Recherchée</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </Reveal>
          )}
        </PageContainer>
      </main>

      <SiteFooter />
    </>
  )
}
