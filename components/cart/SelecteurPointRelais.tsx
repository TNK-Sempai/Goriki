'use client'

import { useCallback, useState } from 'react'

/**
 * Sélecteur de points relais Sendcloud.
 *
 * ─── POURQUOI CE COMPOSANT EXISTE ─────────────────────────────────────────
 * Stripe Checkout sait collecter une adresse, pas un point relais. C'est la
 * raison d'être de toute la mission 2 : le choix du relais se fait chez nous,
 * et Stripe ne sert plus qu'à encaisser.
 *
 * ─── LA CLÉ PUBLIQUE, ET ELLE SEULE ───────────────────────────────────────
 * `NEXT_PUBLIC_SENDCLOUD_PUBLIC_KEY` part dans le bundle : c'est voulu, la clé
 * publique Sendcloud est prévue pour ça. La clé SECRÈTE n'a rien à faire ici —
 * elle reste côté serveur, pour la mission 3 (étiquettes).
 *
 * ─── LE CONTRAT RÉEL, LU DANS LE SCRIPT ───────────────────────────────────
 * Quatre points vérifiés en téléchargeant `api.min.js` plutôt qu'en les
 * supposant, après un premier jet qui se trompait sur les quatre :
 *
 *   1. l'URL est `…/spp/1.0.0/api.min.js`. Sans `.min`, c'est un 404 — et un
 *      404 sur une balise `<script>` ne se voit nulle part si on ne le cherche
 *      pas : `onerror` se déclenche, rien n'est journalisé ;
 *   2. `open(config, onSuccess, onFailure)` rappelle `onSuccess` avec UN POINT,
 *      pas un tableau : `successCallback(data.point, data.postNumber)` ;
 *   3. fermer la fenêtre appelle `onFailure(['Closed'])`. Une fermeture
 *      volontaire n'est pas une panne, et ne doit pas afficher d'erreur ;
 *   4. la config exige `apiKey`, `country` non vide et une `language` de la
 *      liste close du script (`fr-fr` en fait partie).
 */

export interface PointRelais {
  id: string
  nom: string
  adresse: string
  transporteur: string
  /** `general_shop_type` de Sendcloud. Seul « servicepoint » est accepté. */
  type: string | null
}

/**
 * Le seul type de point que notre grille tarifie.
 *
 * ⚠️ LE FILTRE DE LA CARTE N'EST PAS RÉGLABLE. Le script expose bien un
 * `shopType`, recopié en `shop-type` dans l'URL de l'iframe — mais AUCUNE
 * valeur ne fonctionne : mesuré sur `servicepoint`, `SERVICEPOINT`,
 * `parcelshop`, `pickup`, `shop`, `store`, la carte se vide (« No service point
 * in this area »), alors que sans le paramètre elle rend 131 points. Le filtre
 * « Point relais » de leur propre interface agit côté client, sur un appel
 * interne que l'embarqué n'expose pas.
 *
 * La carte montre donc encore lockers et bureaux de poste. Le refus se fait
 * ici, à la sélection, ET sur le serveur — qui seul fait foi.
 */
const TYPE_ACCEPTE = 'servicepoint'

const CLE = process.env.NEXT_PUBLIC_SENDCLOUD_PUBLIC_KEY
const SCRIPT = 'https://embed.sendcloud.sc/spp/1.0.0/api.min.js'

interface SendcloudPoint {
  id: number | string
  name?: string
  street?: string
  house_number?: string
  postal_code?: string
  city?: string
  carrier?: string
  /** Type normalisé, tous transporteurs confondus : « servicepoint », etc. */
  general_shop_type?: string
  /** Code propre au transporteur (« 1 », « C »…) : inexploitable tel quel. */
  shop_type?: string
}

interface SendcloudGlobal {
  servicePoints: {
    open: (
      config: Record<string, unknown>,
      succes: (point: SendcloudPoint, postNumber?: string) => void,
      echec: (erreurs: unknown[]) => void,
    ) => void
  }
}

/**
 * Charge le script une seule fois.
 *
 * ⚠️ La promesse n'est mémorisée QUE si elle aboutit. Une promesse rejetée et
 * gardée rendrait tous les clics suivants instantanément perdants, sans la
 * moindre requête réseau — un échec devenu définitif et invisible.
 */
let chargement: Promise<SendcloudGlobal> | null = null
function chargerSendcloud(): Promise<SendcloudGlobal> {
  if (chargement) return chargement
  const promesse = new Promise<SendcloudGlobal>((resolve, reject) => {
    const deja = (window as unknown as { sendcloud?: SendcloudGlobal }).sendcloud
    if (deja) { resolve(deja); return }

    const el = document.createElement('script')
    el.src = SCRIPT
    el.async = true
    el.onload = () => {
      const g = (window as unknown as { sendcloud?: SendcloudGlobal }).sendcloud
      if (g) resolve(g)
      else reject(new Error('Script chargé mais API Sendcloud absente'))
    }
    el.onerror = () => reject(new Error('Chargement du sélecteur impossible'))
    document.head.appendChild(el)
  })
  chargement = promesse
  promesse.catch(() => { chargement = null })
  return promesse
}

export default function SelecteurPointRelais({
  transporteur,
  pays,
  codePostal,
  choisi,
  onChoisir,
}: {
  /** `bpost` ou `mondial_relay` — filtre la carte sur le transporteur de l'option. */
  transporteur: string
  pays: string
  codePostal: string
  choisi: PointRelais | null
  onChoisir: (point: PointRelais | null) => void
}) {
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  const ouvrir = useCallback(async () => {
    setErreur(null)
    if (!CLE) {
      setErreur("Le sélecteur de points relais n'est pas configuré. Choisissez une livraison à domicile, ou contactez-nous.")
      return
    }
    setEnCours(true)
    try {
      const sendcloud = await chargerSendcloud()
      sendcloud.servicePoints.open(
        {
          apiKey: CLE,
          country: pays.toUpperCase(),
          postalCode: codePostal,
          carriers: transporteur,
          language: 'fr-fr',
        },
        (point) => {
          setEnCours(false)
          if (!point) return

          // Liste BLANCHE : un type inconnu est refusé comme un locker. Une
          // liste noire laisserait passer le prochain type que Sendcloud
          // ajoutera, et notre grille ne le tarifie pas.
          const type = point.general_shop_type ?? null
          if (type !== null && type !== TYPE_ACCEPTE) {
            setErreur("Ce point n'est pas un point relais classique (casier, bureau de poste ou dépôt). Ce tarif ne les couvre pas : choisissez un point relais, ou une livraison à domicile.")
            return
          }

          const rue = [point.street, point.house_number].filter(Boolean).join(' ')
          const ville = [point.postal_code, point.city].filter(Boolean).join(' ')
          onChoisir({
            id: String(point.id),
            nom: point.name ?? 'Point relais',
            adresse: [rue, ville].filter(Boolean).join(', '),
            transporteur: point.carrier ?? transporteur,
            type,
          })
        },
        (erreurs) => {
          setEnCours(false)
          // Fermer la carte sans choisir est un geste normal, pas une panne.
          if (Array.isArray(erreurs) && erreurs.includes('Closed')) return
          const detail = Array.isArray(erreurs) && erreurs.length > 0 ? ` (${erreurs.join(', ')})` : ''
          setErreur(`Le sélecteur n'a pas pu s'ouvrir${detail}. Réessayez, ou choisissez une livraison à domicile.`)
        },
      )
    } catch {
      setEnCours(false)
      setErreur("Le sélecteur de points relais est indisponible. Réessayez, ou choisissez une livraison à domicile.")
    }
  }, [pays, codePostal, transporteur, onChoisir])

  return (
    <div className="glass-light flex flex-col gap-3 rounded-control p-4">
      {choisi ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <span className="flex min-w-0 flex-col">
            <span className="text-[14px] font-medium text-ink">{choisi.nom}</span>
            <span className="mt-0.5 text-[13px] text-ink-70">{choisi.adresse}</span>
          </span>
          <button
            type="button"
            onClick={ouvrir}
            disabled={enCours}
            className="shrink-0 rounded-control border border-[rgba(26,22,17,0.16)] bg-[rgba(255,255,255,0.6)] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-white disabled:opacity-50"
          >
            {enCours ? 'Ouverture…' : 'Changer'}
          </button>
        </div>
      ) : (
        <>
          <span className="text-[13px] leading-[1.6] text-ink-70">
            Ce mode de livraison exige un point relais. Choisissez-en un pour continuer.
            La carte affiche aussi des casiers et des bureaux de poste : ce tarif ne les
            couvre pas, ils seront refusés.
          </span>
          <button
            type="button"
            onClick={ouvrir}
            disabled={enCours || !codePostal}
            className="btn-ochre self-start px-5 py-2.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enCours ? 'Ouverture…' : 'Choisir un point relais'}
          </button>
          {!codePostal && (
            <span className="text-[12px] text-ink-55">
              Renseignez d&apos;abord votre code postal : la carte s&apos;ouvre autour de lui.
            </span>
          )}
        </>
      )}

      {erreur && (
        <p className="m-0 rounded-control border border-[rgba(138,47,29,0.35)] bg-[rgba(138,47,29,0.08)] px-4 py-3 text-[13px] text-[#8A2F1D]">
          {erreur}
        </p>
      )}
    </div>
  )
}
