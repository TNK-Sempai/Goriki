'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props { className?: string }

export default function LogoutButton({ className }: Props) {
  const router   = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.refresh()
    router.push('/login')
  }

  return (
    <button onClick={handleLogout} className={className ?? 'btn btn-ghost btn-sm'}>
      Déconnexion
    </button>
  )
}
