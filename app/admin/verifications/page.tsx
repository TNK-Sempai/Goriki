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
    <div className="admin-table" style={{ padding: '0 18px' }}>
      <div className="admin-col-heads" style={{ display: 'grid', gridTemplateColumns: '1fr 110px 130px 1fr', gap: '12px', padding: '14px 0' }}>
        <span className="admin-col-head">Client</span>
        <span className="admin-col-head">Date</span>
        <span className="admin-col-head">Statut</span>
        <span className="admin-col-head" style={{ textAlign: 'right' }}>Actions</span>
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
    <div>
      <div className="admin-header-row">
        <div>
          <div className="admin-title">Vérifications d&apos;identité</div>
          <div className="admin-sub">{pending.length} EN ATTENTE · {treated.length} TRAITÉE{treated.length > 1 ? 'S' : ''}</div>
        </div>
      </div>

      <div className="admin-sep">À traiter <div className="admin-sep-line" /></div>
      {pending.length === 0
        ? <div className="admin-cell muted">Aucune demande en attente.</div>
        : table(pending)}

      {treated.length > 0 && (
        <>
          <div className="admin-sep">Historique <div className="admin-sep-line" /></div>
          {table(treated)}
        </>
      )}
    </div>
  )
}
