import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { estChiffre, REFUS_NON_CHIFFREE } from '@/lib/annonces'

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
    /**
     * Garde-fou : une annonce non chiffrée n'entre pas au panier.
     *
     * Un prix à zéro veut dire « pas encore chiffré », jamais « gratuit ». La
     * RLS écarte déjà les annonces masquées pour un visiteur, mais elle ne dit
     * rien du prix : une annonce restée EN LIGNE sans prix passait ici sans
     * obstacle, et `data.price !== item.price` la validait très bien avec 0 des
     * deux côtés. Mesuré : 108 annonces Pokémon étaient dans ce cas.
     *
     * Le refus est posé AVANT le contrôle de stock : sans prix, la quantité
     * disponible n'a aucun intérêt, et un message sur le stock détournerait
     * l'attention de la vraie raison.
     */
    if (!estChiffre(data.price)) {
      errors.push(REFUS_NON_CHIFFREE(item.name))
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
