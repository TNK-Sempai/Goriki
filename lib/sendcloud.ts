/**
 * Client Sendcloud — SERVEUR UNIQUEMENT.
 *
 * ─── POURQUOI CETTE CLÉ NE PEUT PAS FUIR ──────────────────────────────────
 * La protection qui compte n'est pas ce garde-fou : c'est le NOM de la
 * variable. `SENDCLOUD_SECRET_KEY` n'a pas le préfixe `NEXT_PUBLIC_`, donc Next
 * ne l'inline JAMAIS dans le bundle — un composant client qui importerait ce
 * module recevrait `undefined`, pas la clé. La clé publique du sélecteur est
 * une variable distincte (`NEXT_PUBLIC_SENDCLOUD_PUBLIC_KEY`), et elle seule
 * part côté client.
 *
 * Le jet ci-dessous n'ajoute qu'un échec BRUYANT au lieu d'un `undefined`
 * silencieux, sans ajouter de dépendance au projet (`server-only` n'y est pas).
 *
 * ─── FORMULE GRATUITE : CHAQUE ÉTIQUETTE NON ANNULÉE EST FACTURÉE ─────────
 * D'où les garde-fous en amont (commande payée, pas d'étiquette existante) et
 * la possibilité d'annuler. Aucune création n'est déclenchée automatiquement :
 * c'est toujours un clic explicite.
 */
if (typeof window !== 'undefined') {
  throw new Error('lib/sendcloud est un module serveur : il ne doit jamais être importé côté client.')
}

const BASE = 'https://panel.sendcloud.sc/api/v2'
/**
 * v3 est OBLIGATOIRE pour créer un colis sur ce compte : la v2 répond
 * « Creating parcels via API v2 is not available for this account ». Les
 * lectures (méthodes, produits) restent en v2, qui les sert très bien.
 */
const BASE_V3 = 'https://panel.sendcloud.sc/api/v3'

function auth(): string {
  const pub = process.env.SENDCLOUD_PUBLIC_KEY
  const sec = process.env.SENDCLOUD_SECRET_KEY
  if (!pub || !sec) throw new Error('Clés Sendcloud absentes de la configuration du serveur.')
  return 'Basic ' + Buffer.from(`${pub}:${sec}`).toString('base64')
}

/** Une erreur Sendcloud lisible : leurs messages sont imbriqués et verbeux. */
export class ErreurSendcloud extends Error {
  constructor(public statut: number, message: string) {
    super(message)
    this.name = 'ErreurSendcloud'
  }
}

async function appeler(chemin: string, init?: RequestInit, base = BASE): Promise<unknown> {
  const r = await fetch(`${base}${chemin}`, {
    ...init,
    headers: { Authorization: auth(), 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  })

  const brut = await r.text()
  let corps: unknown = null
  try { corps = brut ? JSON.parse(brut) : null } catch { corps = brut }

  if (!r.ok) {
    // Sendcloud loge le détail dans `error.message`, parfois dans `error.details`.
    const o = corps as {
      error?: { message?: string; details?: string }
      errors?: { field?: string; message?: string; detail?: string; source?: { pointer?: string } }[]
      message?: string
    } | null
    // v2 loge dans `error.message` ; v3 rend un tableau `errors` par champ.
    // Le POINTEUR est l'information utile : « Field required » seul ne dit pas
    // quel champ manque, et la v3 en aligne huit d'un coup.
    const v3 = (o?.errors ?? [])
      .map(x => [x.source?.pointer ?? x.field, x.message ?? x.detail].filter(Boolean).join(' : '))
      .filter(Boolean).join(' · ')
    const detail = v3
      || [o?.error?.message, o?.error?.details].filter(Boolean).join(' · ')
      || o?.message
      || (typeof corps === 'string' ? corps.slice(0, 300) : '')
      || `HTTP ${r.status}`
    throw new ErreurSendcloud(r.status, detail)
  }
  return corps
}

// ─── Méthodes d'expédition ───────────────────────────────────────────────────

export interface MethodeSendcloud {
  id: number
  name: string
  carrier: string
  /** Le code lisible que porte `shipping_rates.sendcloud_method_code`. */
  code?: string
  service_point_input?: string
}

/**
 * Liste des méthodes du compte.
 *
 * L'API des colis attend un `shipment.id` NUMÉRIQUE, alors que notre grille
 * stocke un code lisible (`bpost:atbpost-bpack/kg=0-10`). C'est cette liste qui
 * fait le pont ; la résoudre à chaque envoi évite de figer en base un
 * identifiant que Sendcloud peut renuméroter.
 */
export async function listerMethodes(pays?: string): Promise<MethodeSendcloud[]> {
  const q = pays ? `?to_country=${encodeURIComponent(pays)}` : ''
  const c = await appeler(`/shipping_methods${q}`) as { shipping_methods?: MethodeSendcloud[] }
  return c.shipping_methods ?? []
}

/**
 * Normalise un code d'expédition pour comparer les nôtres à ceux de la v3.
 *
 * ⚠️ NOS CODES PORTENT UN SEGMENT QUE LA v3 N'UTILISE PLUS. La grille stocke
 * `mondial_relay:service_point,dualapi/size=l,kg=0-0.25,c2c`, la v3 annonce
 * `mondial_relay:service_point,dualapi/size=l,c2c` : la tranche de poids a
 * quitté le code pour passer dans le corps de la requête. Comparer les chaînes
 * telles quelles ne trouverait jamais rien.
 */
export function normaliserCode(code: string): string {
  const [produit, fonctions] = code.split('/')
  const gardees = (fonctions ?? '')
    .split(',')
    .map(x => x.trim())
    .filter(x => x && !x.startsWith('kg='))
  return gardees.length > 0 ? `${produit}/${gardees.join(',')}` : produit
}

/**
 * Traduit un code de notre grille en code d'expédition v3 réellement proposé.
 *
 * On ne se contente pas de nettoyer le code : on VÉRIFIE qu'il figure dans les
 * options que Sendcloud propose pour ce pays et ce poids. Un code qui a cessé
 * d'exister doit échouer ici, avec la liste de ce qui existe, plutôt que de
 * partir à la création et de rendre une erreur illisible.
 */
export async function resoudreOption(
  code: string,
  pays: string,
  poidsG: number,
): Promise<string> {
  const vise = normaliserCode(code)
  const options = await listerOptions('BE', pays, poidsG)
  const trouve = options.find(o => normaliserCode(o.code) === vise)
  if (trouve) return trouve.code

  throw new ErreurSendcloud(
    404,
    `Option « ${vise} » non proposée par Sendcloud pour ${pays} à ${poidsG} g. `
    + `Vérifiez que le transporteur est activé dans le compte. `
    + `Proposées : ${options.map(o => o.code).join(', ') || 'aucune'}.`,
  )
}

/**
 * Produits d'expédition — c'est ICI que vivent nos codes de grille.
 *
 * ⚠️ `/shipping_methods` ne rend PAS de champ `code` (vérifié : 33 méthodes, 33
 * `code: null`). Nos codes du type `bpost:atbpost-bpack/kg=0-10` viennent de
 * `/shipping-products`, où ils se décomposent en `code` du produit + une
 * fonctionnalité de poids. La résolution passe donc par les produits.
 */
export interface ProduitSendcloud {
  code: string
  name: string
  carrier: string
  service_points_carrier?: string | null
  methods?: {
    id: number
    name: string
    properties?: { min_weight?: string | number; max_weight?: string | number }
  }[]
}

export async function listerProduits(pays: string): Promise<ProduitSendcloud[]> {
  // `from_country` est OBLIGATOIRE ici, contrairement à /shipping_methods.
  // L adresse d expedition est en Belgique : c est le point de depart reel.
  const c = await appeler(
    `/shipping-products?from_country=BE&to_country=${encodeURIComponent(pays)}`)
  return (Array.isArray(c) ? c : []) as ProduitSendcloud[]
}

/**
 * Options d'expédition v3 — la nomenclature que l'API des colis attend.
 *
 * `shipping_option_code` est exactement la forme stockée dans
 * `shipping_rates.sendcloud_method_code` : `produit/fonctionnalités`. C'est donc
 * la v3 qui comprend nos codes nativement, sans table de correspondance.
 */
export interface OptionSendcloud {
  code: string
  carrier?: { code?: string; name?: string }
  product?: { code?: string; name?: string }
  functionalities?: Record<string, unknown>
}

export async function listerOptions(
  de: string,
  vers: string,
  poidsG = 100,
): Promise<OptionSendcloud[]> {
  // POST et non GET : en v3 les options dépendent de l'envoi (poids, pays), donc
  // elles se DEMANDENT avec un corps. Un GET rend « Method not allowed ».
  const c = await appeler('/fetch-shipping-options', {
    method: 'POST',
    body: JSON.stringify({
      from_country_code: de,
      to_country_code: vers,
      weight: { value: (Math.max(1, poidsG) / 1000).toFixed(3), unit: 'kg' },
    }),
  }, BASE_V3) as { data?: OptionSendcloud[] }
  return c.data ?? []
}

// ─── Colis ───────────────────────────────────────────────────────────────────

export interface ColisSendcloud {
  /** ⚠️ CHAÎNE et non nombre : la v3 rend un identifiant non numérique
   *  (`Number(...)` donnait `NaN`, et l'annulation appelait `/shipments/NaN`). */
  id: string
  tracking_number?: string | null
  status?: { id: number; message: string }
  label?: { normal_printer?: string[]; label_printer?: string }
  /** Réponse Sendcloud telle quelle, pour les cas où la forme surprend. */
  brut?: Record<string, unknown>
}

export interface DemandeColis {
  nom: string
  rue: string
  codePostal: string
  ville: string
  pays: string
  email: string
  telephone?: string | null
  /** Référence lisible côté transporteur : le début de l'id de commande. */
  reference: string
  /** Poids en GRAMMES ; converti en kg ici, unité attendue par Sendcloud. */
  poidsG: number
  /** Code d'expédition v3, obtenu par `resoudreOption`. */
  codeOption: string
  /** Identifiant du point relais, uniquement si l'option l'exige. */
  pointRelaisId?: string | null
}

/**
 * Adresse d'expéditeur du compte.
 *
 * ⚠️ La v3 n'accepte PAS une adresse inline : `from_address` veut un
 * `sender_address_id` et un `country_code`, et rejette tout le reste
 * (« Extra inputs are not permitted » sur name, address_line_1, postal_code,
 * city, email, phone_number). C'est cohérent avec la consigne : l'adresse
 * d'expédition se configure dans le panneau Sendcloud, pas ici.
 */
interface ExpediteurSendcloud {
  id: number
  country: string
  city?: string
  company_name?: string
}

let expediteurEnCache: ExpediteurSendcloud | null = null

export async function expediteurParDefaut(): Promise<ExpediteurSendcloud> {
  if (expediteurEnCache) return expediteurEnCache
  const c = await appeler('/user/addresses/sender') as {
    sender_addresses?: { id: number; country: string; city?: string; company_name?: string }[]
  }
  const liste = c.sender_addresses ?? []
  if (liste.length === 0) {
    throw new ErreurSendcloud(
      502,
      "Aucune adresse d'expédition dans le compte Sendcloud : renseignez-la dans le panneau avant de créer une étiquette.",
    )
  }
  expediteurEnCache = liste[0]
  return liste[0]
}

/**
 * Crée l'envoi et son étiquette.
 *
 * ⚠️ `POST /api/v3/shipments`, et non `/parcels` : sur ce compte la v2 est
 * fermée (« Creating parcels via API v2 is not available »), et la v3 n'expose
 * pas `/parcels` (404). Seul `/shipments` répond, avec quatre champs racine
 * obligatoires : `from_address`, `to_address`, `ship_with`, `parcels`.
 */
export async function creerColisAvecEtiquette(d: DemandeColis): Promise<ColisSendcloud> {
  // Sendcloud refuse un colis sans poids : plancher à 1 g.
  const poidsKg = (Math.max(1, Math.round(d.poidsG)) / 1000).toFixed(3)
  const exp = await expediteurParDefaut()

  const to: Record<string, unknown> = {
    name: d.nom,
    address_line_1: d.rue,
    postal_code: d.codePostal,
    city: d.ville,
    country_code: d.pays,
    email: d.email,
  }
  if (d.telephone) to.phone_number = d.telephone

  const corps: Record<string, unknown> = {
    // UN seul champ : « Provide either sender_address_id or address fields,
    // not both » — et `country_code` compte comme un champ d adresse.
    from_address: { sender_address_id: exp.id },
    to_address: to,
    ship_with: {
      type: 'shipping_option_code',
      properties: { shipping_option_code: d.codeOption },
    },
    parcels: [{ weight: { value: poidsKg, unit: 'kg' } }],
    order_number: d.reference,
  }
  if (d.pointRelaisId) {
    (corps.ship_with as { properties: Record<string, unknown> })
      .properties.service_point_id = Number(d.pointRelaisId)
  }

  const rep = await appeler('/shipments', {
    method: 'POST',
    body: JSON.stringify(corps),
  }, BASE_V3) as { data?: Record<string, unknown> }

  const envoi = rep.data
  if (!envoi?.id) throw new ErreurSendcloud(502, "Sendcloud a répondu sans identifiant d'envoi.")

  /**
   * ⚠️ DEUX IDENTIFIANTS, ET C'EST LE COLIS QU'IL FAUT RETENIR.
   * L'envoi porte un UUID ; le COLIS, lui, a un identifiant numérique — et
   * c'est celui-là que l'annulation et l'étiquette attendent. Garder l'UUID
   * donnait « Not Found » à l'annulation.
   *
   * L'étiquette n'est pas un champ : c'est un DOCUMENT du colis, dans
   * `documents[]`, repéré par `type: 'label'`.
   */
  let premier = (envoi.parcels as Record<string, unknown>[] | undefined)?.[0]
  if (!premier?.id) throw new ErreurSendcloud(502, 'Sendcloud a créé un envoi sans colis.')

  /**
   * ⚠️ LE SUIVI ET L'ÉTIQUETTE N'EXISTENT PAS ENCORE DANS LA RÉPONSE DE CRÉATION.
   * Mesuré : la création rend `tracking_number` vide et aucun `documents`, alors
   * qu'une relecture de l'envoi quelques instants plus tard les montre tous
   * deux. Sendcloud les produit après avoir annoncé le colis au transporteur.
   * Sans cette relecture, la commande gardait une étiquette introuvable et un
   * numéro de suivi vide — c'est-à-dire une expédition inutilisable.
   */
  const lien = (p: Record<string, unknown> | undefined) =>
    ((p?.documents as { type?: string; link?: string }[] | undefined) ?? [])
      .find(d => d.type === 'label')?.link ?? null

  for (let essai = 0; essai < 4 && (!lien(premier) || !premier.tracking_number); essai++) {
    await new Promise(r => setTimeout(r, 900))
    const relu = await appeler(`/shipments/${envoi.id}`, undefined, BASE_V3) as
      { data?: Record<string, unknown> }
    const p0 = (relu.data?.parcels as Record<string, unknown>[] | undefined)?.[0]
    if (p0) premier = p0
  }

  return {
    id: String(premier.id),
    tracking_number: (premier.tracking_number as string | undefined) || null,
    label: lien(premier) ? { normal_printer: [lien(premier) as string] } : undefined,
    brut: envoi,
  }
}

/**
 * Colis portant une référence de commande donnée.
 *
 * Le filet de rattrapage des étiquettes orphelines : créées chez Sendcloud,
 * jamais enregistrées chez nous, donc facturées en silence.
 */
export async function colisParReference(
  reference: string,
): Promise<{ id: number; statut: string; suivi: string | null; annulable: boolean }[]> {
  const c = await appeler(`/parcels?order_number=${encodeURIComponent(reference)}`) as {
    parcels?: { id: number; status?: { id: number; message: string }; tracking_number?: string | null }[]
  }
  return (c.parcels ?? []).map(p => ({
    id: p.id,
    statut: p.status?.message ?? 'inconnu',
    suivi: p.tracking_number || null,
    // 2000 = « Cancelled » chez Sendcloud ; au-delà, le transporteur a la main.
    annulable: (p.status?.id ?? 0) !== 2000,
  }))
}

export async function lireColis(id: string): Promise<ColisSendcloud> {
  const c = await appeler(`/parcels/${id}`, undefined, BASE_V3) as { data?: ColisSendcloud }
  if (!c.data) throw new ErreurSendcloud(404, `Colis ${id} introuvable chez Sendcloud.`)
  return c.data
}

/**
 * Annule un colis.
 *
 * Sendcloud refuse l'annulation dès que le transporteur a pris le colis en
 * charge ; le message est renvoyé tel quel, c'est lui qui renseigne l'admin.
 */
export async function annulerColis(id: string): Promise<string> {
  // Les parenthèses ne sont pas cosmétiques : un `as` en début de ligne suivante
  // est coupé par l'insertion automatique de point-virgule.
  // v3 d'abord ; si elle ne connaît pas ce chemin, la v2 l'annule très bien
  // (seule la CRÉATION y est fermée sur ce compte).
  try {
    const c = (await appeler(`/parcels/${id}/cancel`, { method: 'POST' }, BASE_V3)) as
      { data?: { status?: string }; status?: string; message?: string } | null
    return c?.message ?? c?.data?.status ?? c?.status ?? 'Étiquette annulée chez Sendcloud.'
  } catch (e) {
    if (!(e instanceof ErreurSendcloud) || e.statut !== 404) throw e
    const c = (await appeler(`/parcels/${id}/cancel`, { method: 'POST' })) as
      { status?: string; message?: string } | null
    return c?.message ?? c?.status ?? 'Étiquette annulée chez Sendcloud.'
  }
}

/**
 * Télécharge le PDF de l'étiquette.
 *
 * Le lien renvoyé par Sendcloud EXIGE l'authentification : le donner tel quel
 * au navigateur rendrait un 401, et y coller les clés les exposerait. Le PDF
 * transite donc par le serveur.
 */
export async function telechargerEtiquette(url: string): Promise<ArrayBuffer> {
  if (!url.startsWith('https://panel.sendcloud.sc/')) {
    throw new ErreurSendcloud(400, "Lien d'étiquette inattendu.")
  }
  const r = await fetch(url, { headers: { Authorization: auth() }, cache: 'no-store' })
  if (!r.ok) throw new ErreurSendcloud(r.status, `Téléchargement de l'étiquette refusé (HTTP ${r.status}).`)
  return r.arrayBuffer()
}
