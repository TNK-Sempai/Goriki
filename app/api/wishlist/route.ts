import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

async function getClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cs) { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )
}

export async function GET() {
  const supabase = await getClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 200 })

  const { data } = await supabase
    .from('wishlist_items')
    .select('item_id, variant_type_id')
    .eq('user_id', user.id)

  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const supabase = await getClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const { item_type, item_id, variant_type_id } = await request.json()

  const { data: existing } = await supabase
    .from('wishlist_items')
    .select('id')
    .eq('user_id', user.id)
    .eq('item_type', item_type)
    .eq('item_id', item_id)
    .maybeSingle()

  if (existing) {
    await supabase.from('wishlist_items').delete().eq('id', existing.id)
    return NextResponse.json({ action: 'removed' })
  }

  await supabase.from('wishlist_items').insert({ user_id: user.id, item_type, item_id, variant_type_id })
  return NextResponse.json({ action: 'added' })
}
