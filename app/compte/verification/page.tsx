import { createClient } from '@/lib/supabase/server'
import IdentityUpload from '@/components/compte/IdentityUpload'

export const metadata = { title: "Vérification d'identité" }

const STATES: Record<string, { label: string; tone: string; text: string }> = {
  none: {
    label: 'NON SOUMISE',
    tone: 'text-ink-55',
    text: "Le rachat de cartes engage un paiement : nous vérifions l'identité de chaque vendeur avant d'ouvrir le formulaire. Une pièce suffit, une seule fois.",
  },
  pending: {
    label: 'EN ATTENTE',
    tone: 'text-ochre',
    text: "Votre document est entre nos mains. La vérification prend en général moins de 48 heures ouvrées ; vous serez averti dès qu'elle aboutit.",
  },
  verified: {
    label: 'VÉRIFIÉE',
    tone: 'text-[oklch(0.52_0.1_150)]',
    text: 'Votre identité est vérifiée. Le formulaire de rachat vous est ouvert.',
  },
  rejected: {
    label: 'REFUSÉE',
    tone: 'text-[#8A2F1D]',
    text: "Le document n'a pas pu être validé. Vous pouvez en soumettre un autre.",
  },
}

export default async function VerificationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('identity_status, identity_submitted_at, identity_reviewed_at, identity_rejection_reason')
    .eq('id', user!.id)
    .single()

  const status = profile?.identity_status ?? 'none'
  const state = STATES[status] ?? STATES.none
  const canSubmit = status === 'none' || status === 'rejected'

  const stamp = profile?.identity_reviewed_at ?? profile?.identity_submitted_at
  const date = stamp ? new Date(stamp).toLocaleDateString('fr-FR') : null

  return (
    <div className="flex flex-col gap-5">
      <section className="glass flex flex-col gap-5 rounded-block p-7 lg:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="m-0 text-[20px] font-semibold tracking-[-0.02em]">Vérification d&apos;identité</h2>
          <span className={`font-mono text-[10px] tracking-[0.14em] ${state.tone}`}>
            {state.label}
            {date ? ` · ${date}` : ''}
          </span>
        </div>

        <p className="m-0 max-w-[62ch] text-[14px] leading-[1.7] text-ink-70">{state.text}</p>

        {status === 'rejected' && profile?.identity_rejection_reason && (
          <p className="m-0 rounded-control border border-[rgba(138,47,29,0.35)] bg-[rgba(138,47,29,0.08)] px-4 py-3 text-[13px] text-[#8A2F1D]">
            Motif : {profile.identity_rejection_reason}
          </p>
        )}

        {canSubmit ? (
          <IdentityUpload />
        ) : (
          <span className="font-mono text-[10px] tracking-[0.14em] text-ink-55">
            AUCUNE ACTION REQUISE DE VOTRE PART
          </span>
        )}
      </section>

      <section className="glass flex flex-col gap-3 rounded-block p-7 lg:p-8">
        <h2 className="m-0 text-[16px] font-semibold tracking-[-0.02em]">Ce que nous en faisons</h2>
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px] leading-[1.7] text-ink-70">
          <li>— Le document sert uniquement à confirmer que vous êtes bien la personne payée.</li>
          <li>— Il est déposé dans un espace de stockage privé, sans URL publique.</li>
          <li>— Seuls vous et un administrateur pouvez y accéder, par lien signé temporaire.</li>
          <li>— La vérification n&apos;est demandée que pour le rachat. Acheter, suivre une commande ou déposer une demande Want to Buy n&apos;en a pas besoin.</li>
        </ul>
      </section>
    </div>
  )
}
