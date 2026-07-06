import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

async function adminClient() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cs) { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return supabase
}

export async function GET(request: NextRequest) {
  const supabase = await adminClient()
  if (!supabase) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (id) {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', id).single()
    const { data: orders } = await supabase.from('orders').select('id, status, total, created_at').eq('user_id', id).order('created_at', { ascending: false })
    return NextResponse.json({ profile, orders })
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, store_credit, role, created_at')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const supabase = await adminClient()
  if (!supabase) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const { id, store_credit } = await request.json()
  const { data, error } = await supabase.from('profiles').update({ store_credit }).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
