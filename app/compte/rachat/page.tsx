import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import BuybackForm from '@/components/compte/BuybackForm'
import { formatPrice } from '@/lib/utils'

export const metadata = { title: 'Rachat de cartes' }

const ETAPES = [
  {
    t: 'Vous décrivez votre lot',
    d: "Séries, langues, états approximatifs, cartes notables. Quelques photos valent mieux qu'un long inventaire — le gros plan d'une pièce de valeur nous en dit plus que sa référence.",
  },
  {
    t: 'Nous chiffrons',
    d: "L'estimation part des cotes du marché, puis nous appliquons une décote selon l'état réel et la vitesse de rotation de la série. Vous recevez une offre détaillée, pas un montant global à prendre ou à laisser.",
  },
  {
    t: 'Vous envoyez, nous vérifions',
    d: "Une fois l'offre acceptée, vous nous expédiez le lot. Chaque carte au-dessus d'un euro est scannée recto-verso à réception. Si l'état diffère de la description, nous vous le montrons avant toute décision.",
  },
  {
    t: 'Vous êtes payé',
    d: 'Virement sous 72 heures après vérification, ou avoir boutique bonifié si vous préférez racheter chez nous.',
  },
]

const STATUS_LABEL: Record<string, string> = {
  pending: 'EN COURS D’ÉTUDE',
  accepted: 'OFFRE ENVOYÉE',
  rejected: 'DÉCLINÉE',
  completed: 'RÉGLÉE',
}

export default async function RachatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: requests }] = await Promise.all([
    supabase.from('profiles').select('identity_verified, identity_status').eq('id', user!.id).single(),
    supabase
      .from('buyback_requests')
      .select('id, status, items_json, offer_amount, created_at')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const verified = profile?.identity_verified === true
  const pending = profile?.identity_status === 'pending'

  return (
    <div className="flex flex-col gap-5">
      <section className="glass flex flex-col gap-4 rounded-block p-7 lg:p-8">
        <h2 className="m-0 text-[20px] font-semibold tracking-[-0.02em]">Rachat de cartes</h2>
        <p className="m-0 max-w-[62ch] text-[14px] leading-[1.7] text-ink-70">
          Nous rachetons les cartes Pokémon et One Piece à l&apos;unité comme au lot. Pas
          de brocante : chaque pièce est cotée, et vous voyez sur quoi le prix repose.
        </p>
      </section>

      <section className="glass flex flex-col gap-6 rounded-block p-7 lg:p-8">
        <h2 className="m-0 text-[16px] font-semibold tracking-[-0.02em]">Comment ça se passe</h2>
        <ol className="m-0 flex list-none flex-col gap-5 p-0">
          {ETAPES.map((e, i) => (
            <li key={e.t} className="flex gap-4">
              <span className="mt-0.5 font-mono text-[11px] tracking-[0.1em] text-ochre">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-[14px] font-semibold">{e.t}</span>
                <span className="max-w-[58ch] text-[13px] leading-[1.7] text-ink-70">{e.d}</span>
              </div>
            </li>
          ))}
        </ol>
        <p className="m-0 text-[12px] leading-[1.6] text-ink-55">
          Ce que nous ne rachetons pas : cartes abîmées au point d&apos;être injouables,
          contrefaçons, et lots de communes sans tri en dessous de 500 cartes.
        </p>
      </section>

      {/* ── CTA conditionnel ─────────────────────────────────────────────── */}
      <section className="glass flex flex-col gap-4 rounded-block p-7 lg:p-8">
        <h2 className="m-0 text-[16px] font-semibold tracking-[-0.02em]">Votre demande</h2>

        {verified ? (
          <BuybackForm />
        ) : (
          <>
            <p className="m-0 max-w-[62ch] text-[14px] leading-[1.7] text-ink-70">
              {pending
                ? "Votre vérification d'identité est en cours. Dès qu'elle aboutit, le formulaire s'ouvre ici — nous ne payons que des vendeurs identifiés."
                : "Le rachat donne lieu à un paiement : nous vérifions l'identité de chaque vendeur avant d'ouvrir le formulaire. C'est une pièce à fournir une seule fois."}
            </p>
            <Link href="/compte/verification" className="btn-ochre self-start px-6 py-3.5 text-[14px]">
              {pending ? 'Suivre ma vérification' : 'Vérifier mon identité'}
            </Link>
          </>
        )}
      </section>

      {/* ── Historique ───────────────────────────────────────────────────── */}
      {(requests?.length ?? 0) > 0 && (
        <section className="glass flex flex-col gap-4 rounded-block p-7 lg:p-8">
          <h2 className="m-0 text-[16px] font-semibold tracking-[-0.02em]">Mes demandes</h2>
          <div className="flex flex-col">
            {(requests ?? []).map(r => {
              const item = Array.isArray(r.items_json) ? r.items_json[0] : null
              return (
                <div
                  key={r.id}
                  className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[rgba(26,22,17,0.08)] py-4 last:border-0"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-[13px]">
                      {item?.quantity ? `${item.quantity} cartes` : 'Lot'} —{' '}
                      {new Date(r.created_at).toLocaleDateString('fr-FR')}
                    </span>
                    {item?.description && (
                      <span className="line-clamp-1 max-w-[52ch] text-[12px] text-ink-55">
                        {item.description}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-4">
                    {r.offer_amount != null && (
                      <span className="text-[14px] font-semibold">{formatPrice(r.offer_amount)}</span>
                    )}
                    <span className="font-mono text-[10px] tracking-[0.12em] text-ink-55">
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
