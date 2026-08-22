import { createClient } from '@/lib/supabase/server'
import BuybackRow, { type BuybackItem } from '@/components/admin/BuybackRow'

export const metadata = { title: 'Rachat' }

export default async function AdminRachatPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('buyback_requests')
    .select('id, user_id, status, items_json, offer_amount, created_at, profiles(email)')
    .order('created_at', { ascending: false })
    .limit(100)

  const rows = (data ?? []).map(r => {
    const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
    const item = (Array.isArray(r.items_json) ? r.items_json[0] : null) as BuybackItem | null
    return { ...r, email: profile?.email ?? null, item }
  })

  const pending = rows.filter(r => r.status === 'pending')

  return (
    <div>
      <div className="admin-header-row">
        <div>
          <div className="admin-title">Rachat</div>
          <div className="admin-sub">{pending.length} DEMANDE{pending.length > 1 ? 'S' : ''} EN ÉTUDE · {rows.length} AU TOTAL</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="admin-cell muted">Aucune demande de rachat.</div>
      ) : (
        <div className="admin-table" style={{ padding: '0 18px' }}>
          <div className="admin-col-heads" style={{ display: 'grid', gridTemplateColumns: '1fr 120px 110px 90px', gap: '12px', padding: '14px 0' }}>
            <span className="admin-col-head">Client</span>
            <span className="admin-col-head">Date</span>
            <span className="admin-col-head">Lot</span>
            <span className="admin-col-head">Statut</span>
          </div>
          {rows.map(r => (
            <BuybackRow
              key={r.id}
              id={r.id}
              email={r.email}
              status={r.status}
              offer={r.offer_amount}
              createdAt={r.created_at}
              item={r.item}
            />
          ))}
        </div>
      )}
    </div>
  )
}
