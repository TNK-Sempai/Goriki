import LogoutButton from '@/components/auth/LogoutButton'

interface AdminHeaderProps { email: string }

export default function AdminHeader({ email }: AdminHeaderProps) {
  return (
    <header style={{
      height: '44px',
      borderBottom: '1px solid rgba(212,144,12,0.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      flexShrink: 0,
      background: 'var(--surface-1)',
    }}>
      <div />
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{email}</span>
        <LogoutButton className="btn btn-ghost btn-sm" />
      </div>
    </header>
  )
}
