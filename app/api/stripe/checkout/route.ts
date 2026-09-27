import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/service'
import { finalizeOrder } from '@/lib/orders/finalize'
import { chargerBaremeLivraison } from '@/lib/livraison/devis'
import {
  calculerOptionsLivraison,
  optionEligible,
  LIBELLE_FORFAIT,
  PAYS_LIVRES,
  type LignePanier,
} from '@/lib/livraison/calcul'
import { CHECKOUT_TTL_MINUTES, SITE_URL } from '@/lib/constants'
import { estChiffre, REFUS_NON_CHIFFREE } from '@/lib/annonces'

interface CartItemInput {
  listingId: string
  tcg: 'pokemon' | 'onepiece' | 'sealed'
  name: string
  variantLabel?: string
  price: number
  quantity: number
  imageUrl?: string | null
}

interface AdresseInput {
  nom?: string
  rue?: string
  code_postal?: string
  ville?: string
  pays?: string
  telephone?: string
}

interface PointRelaisInput {
  id?: string
  nom?: string
  adresse?: string
  transporteur?: string
  /** `general_shop_type` de Sendcloud, transmis par le sélecteur. */
  type?: string | null
}

/**
 * Seul type de point que la grille tarifie.
 *
 * Le refus est posé ICI et pas seulement à l'écran : le filtre de la carte
 * Sendcloud n'est pas réglable (voir `SelecteurPointRelais`), donc casiers et
 * bureaux de poste restent visibles. Une livraison en casier est une méthode
 * Sendcloud distincte, facturée autrement — l'accepter au tarif « point
 * relais » reviendrait à vendre à perte sans le savoir.
 *
 * Liste BLANCHE : un type absent passe (compatibilité), un type INCONNU est
 * refusé. L'inverse laisserait entrer le prochain type que Sendcloud ajoutera.
 */
const TYPE_POINT_ACCEPTE = 'servicepoint'

interface ReserveResult {
  ok: boolean
  failures: { label: string; reason: string; available?: number }[]
}

const TABLE_BY_TCG: Record<CartItemInput['tcg'], string> = {
  pokemon: 'pokemon_listings',
  onepiece: 'onepiece_listings',
  sealed: 'sealed_products',
}

// La réservation doit survivre à l'expiration de la session Stripe, jamais l'inverse.
const ORDER_TTL_MINUTES = CHECKOUT_TTL_MINUTES + 5

const cts = (euros: number) => Math.round(euros * 100)

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cs) { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const corps = (await request.json()) as {
    items?: CartItemInput[]
    adresse?: AdresseInput
    optionCode?: string
    pointRelais?: PointRelaisInput | null
    cgvAcceptees?: boolean
  }

  const items = corps.items
  if (!items?.length) return NextResponse.json({ error: 'Panier vide' }, { status: 400 })

  // ── Adresse ───────────────────────────────────────────────────────────────
  // Elle n'est plus collectée par Stripe : c'est nous qui la validons, et elle
  // doit être complète AVANT de réserver du stock.
  const a = corps.adresse ?? {}
  const adresse = {
    nom: (a.nom ?? '').trim(),
    rue: (a.rue ?? '').trim(),
    code_postal: (a.code_postal ?? '').trim(),
    ville: (a.ville ?? '').trim(),
    pays: (a.pays ?? '').trim().toUpperCase(),
    telephone: (a.telephone ?? '').trim(),
  }
  const manquants = (['nom', 'rue', 'code_postal', 'ville'] as const).filter(c => !adresse[c])
  if (manquants.length > 0) {
    return NextResponse.json({ error: 'Adresse de livraison incomplète.' }, { status: 400 })
  }
  if (!PAYS_LIVRES.includes(adresse.pays as (typeof PAYS_LIVRES)[number])) {
    return NextResponse.json({ error: 'Nous ne livrons pas dans ce pays.' }, { status: 400 })
  }
  if (!corps.cgvAcceptees) {
    return NextResponse.json({ error: 'Les conditions générales de vente doivent être acceptées.' }, { status: 400 })
  }

  const service = createServiceClient()

  // Filet de sécurité : libère le stock des checkouts abandonnés dont le webhook
  // `checkout.session.expired` ne serait jamais arrivé.
  const { error: sweepError } = await service.rpc('release_expired_checkouts', { p_grace_minutes: 5 })
  if (sweepError) console.error('[checkout] balayage des checkouts expirés:', sweepError.message)

  // ── Lecture UNIQUE des articles ───────────────────────────────────────────
  // Les mêmes lignes servent au contrôle de stock, aux lignes Stripe ET au
  // calcul du port. Relire pour le devis ouvrirait une fenêtre où le prix
  // facturé et le prix pesé ne viendraient pas de la même lecture.
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
  const orderItems: {
    item_type: string
    item_id: string
    quantity: number
    price_at_purchase: number
    item_snapshot: { name: string; variantLabel?: string }
  }[] = []
  const lignesPesees: LignePanier[] = []

  for (const item of items) {
    const table = TABLE_BY_TCG[item.tcg]
    if (!table) {
      return NextResponse.json({ error: `Type d'article inconnu : ${item.tcg}` }, { status: 400 })
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      return NextResponse.json({ error: 'Quantité invalide dans le panier.' }, { status: 400 })
    }

    // `weight_g` n'existe que sur les scellés ; les cartes prennent le poids des
    // réglages, appliqué par le calculateur.
    const colonnes = item.tcg === 'sealed'
      ? 'price, quantity, is_active, name, weight_g'
      : 'price, quantity, is_active'

    const { data } = await supabase.from(table).select(colonnes).eq('id', item.listingId).single()
    const ligne = data as unknown as {
      price: number; quantity: number; is_active: boolean
      name?: string; weight_g?: number | null
    } | null

    if (!ligne || !ligne.is_active || ligne.quantity < item.quantity) {
      return NextResponse.json(
        { error: `${item.name} n'est plus disponible en quantité suffisante` },
        { status: 400 }
      )
    }

    /**
     * Garde-fou : jamais de ligne non chiffrée au paiement.
     *
     * Le prix envoyé à Stripe est relu en base, jamais repris du panier : un
     * client ne peut donc pas fixer son prix. Mais rien ne vérifiait que ce
     * prix EXISTE. Une annonce restée en ligne à 0 € produisait une ligne
     * Stripe à 0 €, et le minimum de commande ne l'attrapait pas dès qu'un
     * autre article portait le panier au-dessus du seuil.
     *
     * Le refus est explicite plutôt que silencieux : la ligne n'est pas retirée
     * du panier sans le dire, le client est renvoyé au panier avec la raison.
     */
    if (!estChiffre(ligne.price)) {
      return NextResponse.json({ error: REFUS_NON_CHIFFREE(item.name) }, { status: 400 })
    }

    lineItems.push({
      price_data: {
        currency: 'eur',
        product_data: {
          name: item.name,
          description: item.variantLabel ?? undefined,
          images: item.imageUrl ? [item.imageUrl] : [],
          metadata: { listing_id: item.listingId, tcg: item.tcg },
        },
        unit_amount: cts(ligne.price),
      },
      quantity: item.quantity,
    })

    orderItems.push({
      item_type: item.tcg,
      item_id: item.listingId,
      quantity: item.quantity,
      price_at_purchase: ligne.price,
      item_snapshot: { name: item.name, variantLabel: item.variantLabel },
    })

    lignesPesees.push({
      libelle: item.tcg === 'sealed' ? (ligne.name ?? item.name) : item.name,
      quantite: item.quantity,
      prixUnitaire: ligne.price,
      nature: item.tcg === 'sealed' ? 'scelle' : 'carte',
      poidsUnitaireG: item.tcg === 'sealed'
        ? (ligne.weight_g === null || ligne.weight_g === undefined ? null : Number(ligne.weight_g))
        : undefined,
    })
  }

  const subtotal = orderItems.reduce((sum, i) => sum + i.price_at_purchase * i.quantity, 0)

  // ── Devis de livraison, recalculé ICI ─────────────────────────────────────
  // Le client a vu des options ; il n'en renvoie que le CODE. Tout le reste —
  // poids, prix, éligibilité — est refait à partir de la base. C'est ce qui
  // rend inopérante une requête forgée qui réclamerait la lettre à 30 €.
  const bareme = await chargerBaremeLivraison(supabase, adresse.pays)
  if (!bareme) {
    return NextResponse.json({ error: 'Les réglages de livraison sont indisponibles.' }, { status: 503 })
  }

  const devis = calculerOptionsLivraison(lignesPesees, adresse.pays, bareme.reglages, bareme.tarifs)
  if (!devis.ok) {
    return NextResponse.json({ error: devis.message ?? 'Livraison impossible.' }, { status: 400 })
  }

  /**
   * Minimum de commande, refusé ICI et pas seulement à l'écran.
   *
   * Il porte sur la VALEUR DES ARTICLES : un panier de 0,90 € accompagné de
   * 1,63 € de port ne le franchit pas. C'est la taille de la commande qui est
   * visée, pas le montant encaissé.
   */
  if (!devis.minimumAtteint) {
    const manque = Math.round((devis.minimumCommande - devis.valeurArticles) * 100) / 100
    return NextResponse.json(
      {
        error: `Minimum de commande : ${devis.minimumCommande.toFixed(2).replace('.', ',')} €`
             + ` d'articles. Il manque ${manque.toFixed(2).replace('.', ',')} €.`,
      },
      { status: 400 }
    )
  }

  const option = optionEligible(devis, corps.optionCode ?? '')
  if (!option) {
    return NextResponse.json(
      { error: "Ce mode de livraison n'est pas disponible pour ce panier. Choisissez-en un autre." },
      { status: 400 }
    )
  }

  // ── Point relais ──────────────────────────────────────────────────────────
  const pr = corps.pointRelais ?? null
  const pointRelais = option.needsServicePoint
    ? {
        id: (pr?.id ?? '').toString().trim(),
        nom: (pr?.nom ?? '').toString().trim(),
        adresse: (pr?.adresse ?? '').toString().trim(),
        transporteur: option.carrier,
        type: (pr?.type ?? null) as string | null,
      }
    : null

  if (option.needsServicePoint && (!pointRelais?.id || !pointRelais.nom)) {
    return NextResponse.json(
      { error: 'Ce mode exige un point relais : choisissez-en un.' },
      { status: 400 }
    )
  }

  const typePoint = (pr?.type ?? null) as string | null
  if (option.needsServicePoint && typePoint !== null && typePoint !== TYPE_POINT_ACCEPTE) {
    return NextResponse.json(
      { error: "Ce point n'est pas un point relais classique : ce tarif ne couvre ni les casiers ni les bureaux de poste." },
      { status: 400 }
    )
  }

  const totalCommande = (cts(subtotal) + cts(option.prixPort) + cts(option.forfait)) / 100

  // ── Avoir client ──────────────────────────────────────────────────────────
  // Plafonné DEUX fois : au solde réel lu en base, et au total de la commande.
  // Le client n'envoie aucun montant — il ne pourrait de toute façon pas s'en
  // créditer, `profiles.store_credit` lui étant interdit en écriture (0021).
  const { data: profile } = await supabase
    .from('profiles')
    .select('store_credit')
    .eq('id', user.id)
    .single()

  const creditToApply = Math.min(Math.max(0, profile?.store_credit ?? 0), totalCommande)
  const resteAPayer = (cts(totalCommande) - cts(creditToApply)) / 100

  // ── Commande `pending` AVANT Stripe ───────────────────────────────────────
  // Le panier vit en base : seule la référence de commande transite par
  // metadata, plafonnée à 500 caractères côté Stripe.
  const checkoutExpiresAt = new Date(Date.now() + ORDER_TTL_MINUTES * 60_000)

  const { data: order, error: orderError } = await service
    .from('orders')
    .insert({
      user_id: user.id,
      status: 'pending',
      total: resteAPayer,
      // Prix du PORT SEUL. Le forfait a sa propre colonne : les mêler rendrait
      // la facture incapable de les montrer séparément.
      shipping_cost: option.prixPort,
      handling_fee: option.forfait,
      store_credit_used: 0,
      shipping_rate_id: option.tarifId,
      // Libellé FIGÉ : le tarif peut changer ou disparaître, pas la facture.
      shipping_label: option.label,
      shipping_country: adresse.pays,
      shipping_weight_g: devis.poidsTotalG,
      service_point: pointRelais,
      shipping_address: {
        name: adresse.nom,
        line1: adresse.rue,
        postal_code: adresse.code_postal,
        city: adresse.ville,
        country: adresse.pays,
        phone: adresse.telephone || null,
      },
      checkout_expires_at: checkoutExpiresAt.toISOString(),
    })
    .select('id')
    .single()

  if (orderError || !order) {
    console.error('[checkout] création de la commande pending:', orderError?.message)
    return NextResponse.json({ error: 'Erreur lors de la création de la commande' }, { status: 500 })
  }

  const { error: itemsError } = await service
    .from('order_items')
    .insert(orderItems.map(i => ({ ...i, order_id: order.id })))

  if (itemsError) {
    console.error('[checkout] insertion des order_items:', itemsError.message)
    await service.from('orders').delete().eq('id', order.id)
    return NextResponse.json({ error: 'Erreur lors de la création de la commande' }, { status: 500 })
  }

  // ── Réservation de stock ──────────────────────────────────────────────────
  const { data: reserveData, error: reserveError } = await service.rpc('reserve_order_stock', {
    p_order_id: order.id,
  })

  if (reserveError) {
    console.error('[checkout] RPC reserve_order_stock:', reserveError.message)
    await service.from('orders').delete().eq('id', order.id)
    return NextResponse.json({ error: 'Erreur lors de la réservation du stock' }, { status: 500 })
  }

  const reserve = reserveData as ReserveResult
  if (!reserve.ok) {
    await service.from('orders').delete().eq('id', order.id)
    const detail = reserve.failures
      .map(f => (f.available !== undefined ? `${f.label} : ${f.reason} (${f.available} restant)` : `${f.label} : ${f.reason}`))
      .join(' · ')
    return NextResponse.json({ error: `Stock insuffisant : ${detail}` }, { status: 409 })
  }

  // ── Total nul : l'avoir couvre tout, port et forfait compris ──────────────
  // Stripe refuse une Checkout Session à 0 € en mode `payment`. On court-circuite
  // Stripe et on finalise par le MÊME chemin que le webhook. Plus besoin d'aller
  // chercher une adresse ailleurs : elle est saisie sur notre page.
  if (cts(resteAPayer) === 0) {
    const result = await finalizeOrder(service, {
      orderId: order.id,
      paymentId: null,
      sessionId: null,
      total: 0,
      shippingCost: option.prixPort,
      shippingAddress: {
        name: adresse.nom,
        line1: adresse.rue,
        postal_code: adresse.code_postal,
        city: adresse.ville,
        country: adresse.pays,
        phone: adresse.telephone || null,
      },
      storeCreditUsed: creditToApply,
    })

    if (!result.ok) {
      await service.rpc('release_order_checkout', { p_order_id: order.id })
      return NextResponse.json({ error: 'Erreur lors de la création de la commande' }, { status: 500 })
    }

    return NextResponse.json({ url: `${SITE_URL}/checkout/success?order_id=${order.id}`, free: true })
  }

  // ── Session Stripe ────────────────────────────────────────────────────────
  // Livraison et forfait deviennent des LIGNES, plus des `shipping_options` :
  // le mode est déjà choisi chez nous, et le point relais ne peut pas voyager
  // dans une shipping rate Stripe. `shipping_address_collection` disparaît pour
  // la même raison — l'adresse est saisie sur notre page.
  if (cts(option.prixPort) > 0) {
    lineItems.push({
      price_data: {
        currency: 'eur',
        product_data: { name: `Livraison : ${option.label}` },
        unit_amount: cts(option.prixPort),
      },
      quantity: 1,
    })
  }
  // Stripe REFUSE une ligne à 0 €, et une ligne « 0,00 € » sur le récapitulatif
  // de paiement n'apprendrait rien au client. Quand le forfait est nul, il
  // n'existe simplement pas.
  if (cts(option.forfait) > 0) {
    lineItems.push({
      price_data: {
        currency: 'eur',
        product_data: { name: LIBELLE_FORFAIT },
        unit_amount: cts(option.forfait),
      },
      quantity: 1,
    })
  }

  try {
    // Le crédit boutique passe par un coupon à usage unique : Stripe REFUSE un
    // line item à `unit_amount` négatif.
    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined
    if (creditToApply > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: cts(creditToApply),
        currency: 'eur',
        duration: 'once',
        name: `Crédit boutique Goriki : ${creditToApply.toFixed(2)} €`,
        max_redemptions: 1,
        redeem_by: Math.floor((Date.now() + ORDER_TTL_MINUTES * 60_000) / 1000),
        metadata: { order_id: order.id },
      })
      discounts = [{ coupon: coupon.id }]
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      ...(discounts ? { discounts } : {}),
      customer_email: user.email,
      metadata: {
        order_id: order.id,
        user_id: user.id,
        store_credit_used: creditToApply.toString(),
      },
      // Recopiée sur le PaymentIntent : sans elle, `payment_intent.payment_failed`
      // arrive sans aucun moyen de remonter à la commande.
      payment_intent_data: { metadata: { order_id: order.id } },
      // +60 s de marge : Stripe exige au moins 30 minutes dans le futur.
      expires_at: Math.floor((Date.now() + CHECKOUT_TTL_MINUTES * 60_000 + 60_000) / 1000),
      success_url: `${SITE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/panier`,
      locale: 'fr',
    })

    const { error: linkError } = await service
      .from('orders')
      .update({ stripe_session_id: session.id })
      .eq('id', order.id)

    if (linkError) {
      console.error('[checkout] liaison stripe_session_id:', linkError.message)
      await stripe.checkout.sessions.expire(session.id).catch(() => {})
      await service.rpc('release_order_checkout', { p_order_id: order.id })
      return NextResponse.json({ error: 'Erreur lors de la création de la commande' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (stripeError) {
    console.error('[checkout] création de la session Stripe:', stripeError)
    await service.rpc('release_order_checkout', { p_order_id: order.id })
    return NextResponse.json({ error: 'Le paiement est momentanément indisponible' }, { status: 502 })
  }
}
