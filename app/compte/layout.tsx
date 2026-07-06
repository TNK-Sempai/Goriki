import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function CompteLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/compte')
  return <div className="min-h-screen bg-base">{children}</div>
}
