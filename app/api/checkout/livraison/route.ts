import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { devisLivraisonPourPanier, type ArticlePanier } from '@/lib/livraison/devis'
import { PAYS_LIVRES } from '@/lib/livraison/calcul'

/**
 * Options de livraison pour le panier et le pays courants.
 *
 * Route de LECTURE : elle n'écrit rien et ne réserve rien. Elle existe parce que
 * le pays est choisi à l'écran, donc après le rendu du serveur — impossible de
 * calculer les options au chargement de la page.
 *
 * Les prix utilisés viennent de la base, jamais du corps de la requête : le
 * client n'envoie que des identifiants et des quantités. Le même devis est
 * recalculé à l'identique au moment de payer, et c'est CELUI-LÀ qui fait foi —
 * cette route ne sert qu'à montrer les options.
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const pays: string = typeof body.pays === 'string' ? body.pays : ''
  const items = Array.isArray(body.items) ? (body.items as ArticlePanier[]) : []

  if (!PAYS_LIVRES.includes(pays as (typeof PAYS_LIVRES)[number])) {
    return NextResponse.json({ error: 'Pays de livraison non desservi.' }, { status: 400 })
  }
  if (items.length === 0) {
    return NextResponse.json({ error: 'Panier vide.' }, { status: 400 })
  }

  const devis = await devisLivraisonPourPanier(
    supabase,
    items.map(i => ({ listingId: i.listingId, tcg: i.tcg, quantity: i.quantity })),
    pays,
  )

  return NextResponse.json({ devis })
}
