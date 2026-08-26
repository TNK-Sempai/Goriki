import { createClient } from '@/lib/supabase/server'
import VerificationRow from '@/components/admin/VerificationRow'

export const metadata = { title: 'Vérifications' }

export default async function AdminVerificationsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, email, identity_status, identity_document_path, identity_submitted_at, identity_reviewed_at, identity_rejection_reason')
    .in('identity_status', ['pending', 'rejected', 'verified'])
    .order('identity_submitted_at', { ascending: false })
    .limit(200)

  const rows = data ?? []
  const pending = rows.filter(p => p.identity_status === 'pending')
  const treated = rows.filter(p => p.identity_status !== 'pending')

  const table = (list: typeof rows) => (
    <div className="gk-panneau" style={{ padding: '0 18px' }}>
      <div className="gk-heads" style={{ display: 'grid', gridTemplateColumns: '1fr 110px 130px 1fr', gap: '12px', padding: '14px 0' }}>
        <span className="gk-label">Client</span>
        <span className="gk-label">Date</span>
        <span className="gk-label">Statut</span>
        <span className="gk-label" style={{ textAlign: 'right' }}>Actions</span>
      </div>
      {list.map(p => (
        <VerificationRow
          key={p.id}
          userId={p.id}
          email={p.email}
          status={p.identity_status}
          documentPath={p.identity_document_path}
          submittedAt={p.identity_submitted_at}
          reviewedAt={p.identity_reviewed_at}
          reason={p.identity_rejection_reason}
        />
      ))}
    </div>
  )

  return (
    <div className="gk-corps">
      <div className="gk-entete-ecran">
        <div>
          <div className="gk-titre">Vérifications d&apos;identité</div>
          <div className="gk-eyebrow-texte">{pending.length} EN ATTENTE · {treated.length} TRAITÉE{treated.length > 1 ? 'S' : ''}</div>
        </div>
      </div>

      <div className="gk-sep">À traiter <div className="gk-sep-line" /></div>
      {pending.length === 0
        ? <div className="gk-cell muted">Aucune demande en attente.</div>
        : table(pending)}

      {treated.length > 0 && (
        <>
          <div className="gk-sep">Historique <div className="gk-sep-line" /></div>
          {table(treated)}
        </>
      )}
    </div>
  )
}
