import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { uploadCardPhoto } from '@/lib/cloudinary'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cs) { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const listingId = formData.get('listing_id') as string
  const side = formData.get('side') as 'front' | 'back'
  const tcg = formData.get('tcg') as 'pokemon' | 'onepiece'

  if (!file || !listingId || !side || !tcg) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const url = await uploadCardPhoto(buffer, { listingId, side, tcg })

  // Mettre à jour le listing
  const table = tcg === 'pokemon' ? 'pokemon_listings' : 'onepiece_listings'
  const field = side === 'front' ? 'front_photo_url' : 'back_photo_url'

  const { error } = await supabase
    .from(table)
    .update({ [field]: url, needs_photo: false })
    .eq('id', listingId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ url })
}
