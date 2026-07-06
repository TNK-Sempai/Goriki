import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// POST /api/cart — valide prix et stocks avant checkout
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cs) { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )

  const { items } = await request.json()
  const errors: string[] = []
  const validated: typeof items = []

  for (const item of items) {
    const table = item.tcg === 'sealed' ? 'sealed_products' : `${item.tcg}_listings`
    const { data } = await supabase
      .from(table)
      .select('price, quantity, is_active')
      .eq('id', item.listingId)
      .single()

    if (!data || !data.is_active) {
      errors.push(`${item.name} n'est plus disponible`)
      continue
    }
    if (data.quantity < item.quantity) {
      errors.push(`${item.name} : seulement ${data.quantity} disponible(s)`)
    }
    if (data.price !== item.price) {
      errors.push(`Le prix de ${item.name} a changé : ${data.price} €`)
    }
    validated.push({ ...item, price: data.price })
  }

  return NextResponse.json({ errors, validated, valid: errors.length === 0 })
}
