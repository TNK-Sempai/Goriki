import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  creerColisAvecEtiquette,
  annulerColis,
  resoudreOption,
  telechargerEtiquette,
  listerMethodes,
  listerProduits,
  listerOptions,
  colisParReference,
  ErreurSendcloud,
} from '@/lib/sendcloud'

/**
 * Expédition d'une commande : étiquette Sendcloud, annulation, PDF.
 *
 * ─── UNE ÉTIQUETTE CRÉÉE EST FACTURÉE ─────────────────────────────────────
 * En formule gratuite, Sendcloud facture toute étiquette non annulée. Les trois
 * garde-fous ci-dessous sont donc financiers autant que fonctionnels :
 * commande PAYÉE, aucune étiquette DÉJÀ posée, point relais PRÉSENT quand la
 * méthode l'exige. Chacun est vérifié en base, pas sur la foi de l'écran.
 *
 * ─── LE PDF NE PEUT PAS ÊTRE UN LIEN DIRECT ───────────────────────────────
 * L'URL d'étiquette de Sendcloud exige l'authentification : donnée telle quelle
 * au navigateur, elle rend un 401 ; signée avec les clés dans l'URL, elle les
 * exposerait. Le PDF transite donc par cette route, qui le récupère côté
 * serveur et le renvoie au navigateur.
 */

const STATUTS_PAYES = ['paid', 'preparing', 'shipped', 'delivered']

async function admin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { refus: NextResponse.json({ error: 'Non connecté' }, { status: 401 }) }

  const { data: profil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profil?.role !== 'admin') return { refus: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) }

  return { refus: null }
}

interface Commande {
  id: string
  status: string
  shipping_label: string | null
  shipping_country: string | null
  shipping_weight_g: number | null
  shipping_address: Record<string, string> | null
  service_point: { id?: string; nom?: string; adresse?: string; transporteur?: string } | null
  sendcloud_parcel_id: string | null
  label_url: string | null
  tracking_number: string | null
  shipping_rate_id: string | null
  profiles: { email: string } | { email: string }[] | null
  shipping_rates: { kind: string; sendcloud_method_code: string | null; needs_service_point: boolean }
    | { kind: string; sendcloud_method_code: string | null; needs_service_point: boolean }[] | null
}

const seul = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

const CHAMPS = `
  id, status, shipping_label, shipping_country, shipping_weight_g, shipping_address,
  service_point, sendcloud_parcel_id, label_url, tracking_number, shipping_rate_id,
  profiles(email),
  shipping_rates(kind, sendcloud_method_code, needs_service_point)
`

/**
 * Deux lectures :
 *   · `?id=…` rend le PDF de l'étiquette, récupéré côté serveur puis relayé ;
 *   · `?methodes=1&pays=BE` liste les méthodes actives du compte Sendcloud.
 *
 * La seconde n'est pas un reliquat de mise au point. Quand `resoudreMethode`
 * échoue, son message invite à vérifier que le transporteur est activé dans le
 * compte : sans cette liste, cette vérification demanderait d'ouvrir le panneau
 * Sendcloud et de deviner la correspondance avec nos codes de grille.
 */
export async function GET(request: NextRequest) {
  const { refus } = await admin()
  if (refus) return refus

  const params = new URL(request.url).searchParams

  /**
   * Colis rattachés à une référence de commande.
   *
   * Sert à rattraper une étiquette ORPHELINE : créée chez Sendcloud mais non
   * enregistrée chez nous (coupure réseau, plantage entre les deux écritures).
   * Sans cette lecture, elle resterait facturée sans que rien ne la signale.
   */
  if (params.get('orphelines')) {
    try {
      const ref = params.get('orphelines') as string
      const colis = await colisParReference(ref)
      return NextResponse.json({ reference: ref, total: colis.length, colis })
    } catch (e) {
      const msg = e instanceof ErreurSendcloud ? e.message : 'Lecture impossible.'
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  }

  if (params.get('options')) {
    try {
      const options = await listerOptions('BE', params.get('pays') ?? 'BE')
      return NextResponse.json({
        total: options.length,
        codes: options.map(o => o.code).slice(0, 60),
      })
    } catch (e) {
      const msg = e instanceof ErreurSendcloud ? e.message : 'Lecture des options impossible.'
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  }

  if (params.get('produits')) {
    try {
      const produits = await listerProduits(params.get('pays') ?? 'BE')
      return NextResponse.json({
        total: produits.length,
        produits: produits.slice(0, 40).map(p => ({
          code: p.code, nom: p.name, transporteur: p.carrier,
          methodes: (p.methods ?? []).map(m => ({
            id: m.id, nom: m.name,
            min: m.properties?.min_weight ?? null, max: m.properties?.max_weight ?? null,
          })),
        })),
      })
    } catch (e) {
      const msg = e instanceof ErreurSendcloud ? e.message : 'Lecture des produits impossible.'
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  }

  if (params.get('methodes')) {
    const pays = params.get('pays') ?? undefined
    try {
      const methodes = await listerMethodes(pays)
      return NextResponse.json({
        pays: pays ?? 'tous',
        total: methodes.length,
        methodes: methodes.map(m => ({
          id: m.id, nom: m.name, transporteur: m.carrier,
          code: m.code ?? null, point_relais: m.service_point_input ?? null,
        })),
      })
    } catch (e) {
      const msg = e instanceof ErreurSendcloud ? e.message : 'Lecture des méthodes impossible.'
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  }

  const id = params.get('id')
  if (!id) return NextResponse.json({ error: 'Commande introuvable' }, { status: 400 })

  const service = createServiceClient()
  const { data } = await service.from('orders').select('label_url, id').eq('id', id).maybeSingle()
  if (!data?.label_url) {
    return NextResponse.json({ error: "Aucune étiquette pour cette commande." }, { status: 404 })
  }

  try {
    const pdf = await telechargerEtiquette(data.label_url)
    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="etiquette-${String(data.id).slice(0, 8)}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    const msg = e instanceof ErreurSendcloud ? e.message : "Téléchargement de l'étiquette impossible."
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

export async function POST(request: NextRequest) {
  const { refus } = await admin()
  if (refus) return refus

  const corps = await request.json().catch(() => ({}))
  const id: string | null = corps.id ?? null
  const action: string = corps.action ?? ''
  if (!id) return NextResponse.json({ error: 'Commande introuvable' }, { status: 400 })
  if (action !== 'creer' && action !== 'annuler') {
    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data } = await service.from('orders').select(CHAMPS).eq('id', id).maybeSingle()
  const commande = data as unknown as Commande | null
  if (!commande) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })

  const tarif = seul(commande.shipping_rates)
  const client = seul(commande.profiles)

  // ── Annulation ────────────────────────────────────────────────────────────
  if (action === 'annuler') {
    if (!commande.sendcloud_parcel_id) {
      return NextResponse.json({ error: "Cette commande n'a pas d'étiquette à annuler." }, { status: 400 })
    }
    try {
      const message = await annulerColis(commande.sendcloud_parcel_id)
      // Les trois champs partent ENSEMBLE : un numéro de suivi survivant à son
      // étiquette annulée enverrait le client vers un suivi mort.
      const { error } = await service
        .from('orders')
        .update({ sendcloud_parcel_id: null, label_url: null, tracking_number: null })
        .eq('id', id)
      if (error) {
        return NextResponse.json(
          { error: `Étiquette annulée chez Sendcloud, mais la commande n'a pas pu être mise à jour : ${error.message}` },
          { status: 500 }
        )
      }
      return NextResponse.json({ ok: true, message })
    } catch (e) {
      const msg = e instanceof ErreurSendcloud ? e.message : "Annulation impossible."
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  }

  // ── Création ──────────────────────────────────────────────────────────────
  if (!STATUTS_PAYES.includes(commande.status)) {
    return NextResponse.json(
      { error: `Commande « ${commande.status} » : une étiquette ne se crée que sur une commande payée.` },
      { status: 400 }
    )
  }
  if (commande.sendcloud_parcel_id) {
    return NextResponse.json(
      { error: 'Une étiquette existe déjà pour cette commande. Annulez-la avant d\'en créer une autre.' },
      { status: 409 }
    )
  }
  if (!tarif?.sendcloud_method_code) {
    return NextResponse.json(
      { error: "Ce mode de livraison n'a pas de méthode Sendcloud : il s'affranchit à la main." },
      { status: 400 }
    )
  }
  if (tarif.needs_service_point && !commande.service_point?.id) {
    return NextResponse.json(
      { error: 'Ce mode exige un point relais, et la commande n\'en porte aucun.' },
      { status: 400 }
    )
  }
  const adr = commande.shipping_address
  if (!adr?.line1 || !adr.city || !adr.postal_code || !adr.country) {
    return NextResponse.json({ error: 'Adresse de livraison incomplète sur la commande.' }, { status: 400 })
  }

  try {
    const codeOption = await resoudreOption(
      tarif.sendcloud_method_code, adr.country, commande.shipping_weight_g ?? 0)
    const colis = await creerColisAvecEtiquette({
      nom: adr.name || client?.email || 'Client',
      rue: adr.line1,
      codePostal: adr.postal_code,
      ville: adr.city,
      pays: adr.country,
      email: client?.email ?? '',
      telephone: adr.phone ?? null,
      reference: String(commande.id).slice(0, 8).toUpperCase(),
      poidsG: commande.shipping_weight_g ?? 0,
      codeOption,
      pointRelaisId: tarif.needs_service_point ? (commande.service_point?.id ?? null) : null,
    })

    const labelUrl = colis.label?.normal_printer?.[0] ?? colis.label?.label_printer ?? null

    const { error } = await service
      .from('orders')
      .update({
        sendcloud_parcel_id: colis.id,
        tracking_number: colis.tracking_number ?? null,
        label_url: labelUrl,
      })
      .eq('id', id)

    if (error) {
      // L'étiquette EXISTE et sera facturée : on le dit, avec son identifiant,
      // pour qu'elle puisse être annulée depuis le panneau Sendcloud.
      return NextResponse.json(
        {
          error: `Étiquette créée chez Sendcloud (colis ${colis.id}) mais non enregistrée : ${error.message}. `
               + `Annulez-la depuis le panneau Sendcloud pour ne pas la payer.`,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      parcel_id: colis.id,
      // Diagnostic : les clés rendues par Sendcloud, sans leur contenu.
      cles: Object.keys(colis.brut ?? {}),
      tracking_number: colis.tracking_number ?? null,
      a_etiquette: Boolean(labelUrl),
      methode: codeOption,
    })
  } catch (e) {
    const msg = e instanceof ErreurSendcloud ? e.message : "Création de l'étiquette impossible."
    console.error('[expedition] création:', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
