'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCart } from '@/hooks/useCart'
import { formatPrice } from '@/lib/utils'
import SelecteurPointRelais, { type PointRelais } from './SelecteurPointRelais'

/**
 * Checkout — adresse, livraison, point relais, puis Stripe.
 *
 * ─── CE QUI A CHANGÉ, ET POURQUOI ─────────────────────────────────────────
 * L'adresse et le mode de livraison étaient collectés PAR Stripe. Stripe sait
 * faire les deux, mais il ne sait pas faire choisir un point relais — or c'est
 * le mode le moins cher sur la plupart des paniers. Tout remonte donc ici, et
 * Stripe ne sert plus qu'à encaisser.
 *
 * ─── AUCUN PRIX N'EST DÉCIDÉ SUR CET ÉCRAN ────────────────────────────────
 * Les options et leurs montants viennent de `/api/checkout/livraison`, qui les
 * calcule en base. Au paiement, le serveur REFAIT le même calcul et ne lit du
 * client que le CODE de l'option. Ce qui s'affiche ici est donc un reflet, pas
 * une source : une valeur trafiquée dans le navigateur ne change rien.
 */

const PAYS = [
  { code: 'BE', nom: 'Belgique' },
  { code: 'FR', nom: 'France' },
  { code: 'LU', nom: 'Luxembourg' },
  { code: 'NL', nom: 'Pays-Bas' },
  { code: 'DE', nom: 'Allemagne' },
] as const

interface OptionLivraison {
  tarifId: string
  code: string
  label: string
  carrier: string
  kind: string
  needsServicePoint: boolean
  tracked: boolean
  prixPort: number
  forfait: number
  totalLivraison: number
}

interface Devis {
  ok: boolean
  poidsTotalG: number
  valeurArticles: number
  forfait: number
  minimumCommande: number
  minimumAtteint: boolean
  options: OptionLivraison[]
  message?: string
}

/** Montant à la française, sans dépendre d'un formateur pour un seul usage. */
const euros = (n: number) => n.toFixed(2).replace('.', ',') + ' €'

const champ =
  'w-full rounded-control border border-[rgba(26,22,17,0.15)] bg-[rgba(255,255,255,0.55)] px-4 py-3 text-[14px] text-ink placeholder:text-ink-55'

export default function CheckoutClient({ storeCredit }: { storeCredit: number }) {
  const { items, total } = useCart()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  const [adresse, setAdresse] = useState({
    nom: '', rue: '', code_postal: '', ville: '', pays: 'BE', telephone: '',
  })
  const [devis, setDevis] = useState<Devis | null>(null)
  const [devisEnCours, setDevisEnCours] = useState(false)
  const [codeChoisi, setCodeChoisi] = useState<string | null>(null)
  const [pointRelais, setPointRelais] = useState<PointRelais | null>(null)
  const [cgv, setCgv] = useState(false)

  useEffect(() => { setHydrated(true) }, [])

  // Redirection APRÈS hydratation seulement : le panier vit en sessionStorage,
  // il est vide au premier rendu (fix mission 02, à ne pas casser).
  useEffect(() => {
    if (hydrated && items.length === 0) router.push('/panier')
  }, [hydrated, items, router])

  // ── Devis : rejoué à chaque changement de pays ou de panier ───────────────
  // `jeton` protège des réponses qui reviennent dans le désordre : deux
  // changements rapides de pays, et la réponse du PREMIER pourrait arriver en
  // dernier et écraser la bonne.
  const jeton = useRef(0)
  const demanderDevis = useCallback(async (pays: string) => {
    if (items.length === 0) return
    const mien = ++jeton.current
    setDevisEnCours(true)
    try {
      const res = await fetch('/api/checkout/livraison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pays,
          items: items.map(i => ({ listingId: i.listingId, tcg: i.tcg, quantity: i.quantity })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (mien !== jeton.current) return
      if (!res.ok) { setDevis(null); setError(data.error ?? 'Livraison indisponible.'); return }
      setError(null)
      setDevis(data.devis as Devis)
    } catch {
      if (mien === jeton.current) setError('Impossible de calculer la livraison.')
    } finally {
      if (mien === jeton.current) setDevisEnCours(false)
    }
  }, [items])

  // Synchronisation avec un système externe (notre API) quand le pays ou le
  // panier changent : c'est exactement ce à quoi sert un effet. La règle
  // `set-state-in-effect` voit le `setDevisEnCours` de `demanderDevis` et
  // s'en alarme ; ici l'état ne fait que refléter une requête en vol, il
  // n'alimente aucun rendu en cascade.
  useEffect(() => {
    if (!hydrated || items.length === 0) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cf. ci-dessus
    demanderDevis(adresse.pays)
  }, [hydrated, adresse.pays, demanderDevis, items.length])

  if (!hydrated || items.length === 0) return null

  const option = devis?.options.find(o => o.code === codeChoisi) ?? null
  const adresseComplete = Boolean(adresse.nom && adresse.rue && adresse.code_postal && adresse.ville)
  const relaisManquant = Boolean(option?.needsServicePoint && !pointRelais)

  const portTotal = option ? option.prixPort + option.forfait : 0
  const aPayerAvantAvoir = Math.round((total + portTotal) * 100) / 100
  const creditApplique = Math.min(storeCredit, aPayerAvantAvoir)
  const aPayer = Math.round((aPayerAvantAvoir - creditApplique) * 100) / 100

  /**
   * Minimum de commande. Le serveur le refait de son côté : ce blocage-ci
   * n'existe que pour l'expliquer avant le clic, pas pour le garantir.
   */
  const minimum = devis?.minimumCommande ?? 0
  const sousMinimum = Boolean(devis) && devis!.minimumAtteint === false
  const manque = Math.round((minimum - total) * 100) / 100

  const pretAPayer =
    adresseComplete && Boolean(option) && !relaisManquant && cgv && !sousMinimum && !loading

  async function payer() {
    setLoading(true)
    setError(null)

    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        adresse,
        optionCode: codeChoisi,
        pointRelais,
        cgvAcceptees: cgv,
      }),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data.error ?? 'Erreur lors du paiement')
      setLoading(false)
      // Le mode a pu devenir inéligible entre l'affichage et le clic.
      demanderDevis(adresse.pays)
      return
    }

    window.location.href = data.url
  }

  const saisie = (cle: keyof typeof adresse, label: string, extra?: { optionnel?: boolean }) => (
    <label className="flex flex-col gap-1.5">
      <span className="data text-[9px]">{label}{extra?.optionnel && ' (optionnel)'}</span>
      <input
        value={adresse[cle]}
        onChange={e => setAdresse({ ...adresse, [cle]: e.target.value })}
        className={champ}
        autoComplete={
          cle === 'nom' ? 'name'
            : cle === 'rue' ? 'street-address'
            : cle === 'code_postal' ? 'postal-code'
            : cle === 'ville' ? 'address-level2'
            : cle === 'telephone' ? 'tel' : undefined
        }
      />
    </label>
  )

  return (
    <main className="page-shell pb-16 pt-8 font-grotesk text-ink">
      <nav className="mb-6 font-mono text-[10px] tracking-[0.14em] text-ink-55">
        <Link href="/panier" className="text-[rgba(26,22,17,0.55)]">PANIER</Link>
        {' / '}
        <span className="text-ink">LIVRAISON</span>
        {' / '}
        <span>PAIEMENT (STRIPE)</span>
      </nav>

      <h1 className="m-0 mb-8 text-[32px] font-semibold tracking-[-0.03em] sm:text-[38px] lg:text-[44px]">
        Commande
      </h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="flex flex-col gap-5">

          {/* ── 1. Adresse ──────────────────────────────────────────────── */}
          <section className="glass flex flex-col gap-4 rounded-block p-7">
            <span className="text-[16px] font-semibold">1 · Adresse de livraison</span>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">{saisie('nom', 'Nom et prénom')}</div>
              <div className="sm:col-span-2">{saisie('rue', 'Rue et numéro')}</div>
              {saisie('code_postal', 'Code postal')}
              {saisie('ville', 'Ville')}
              <label className="flex flex-col gap-1.5">
                <span className="data text-[9px]">Pays</span>
                <select
                  value={adresse.pays}
                  // Le mode choisi est invalidé ICI, dans l'événement, et non
                  // dans un effet : changer de pays est une ACTION, pas une
                  // synchronisation. Les grilles n'ont pas les mêmes codes, et
                  // un relais belge n'a rien à faire sur une adresse française.
                  onChange={e => {
                    setAdresse({ ...adresse, pays: e.target.value })
                    setCodeChoisi(null)
                    setPointRelais(null)
                  }}
                  className={champ}
                >
                  {PAYS.map(p => <option key={p.code} value={p.code}>{p.nom}</option>)}
                </select>
              </label>
              {saisie('telephone', 'Téléphone', { optionnel: true })}
            </div>
          </section>

          {/* ── 2. Livraison ────────────────────────────────────────────── */}
          <section className="glass flex flex-col gap-4 rounded-block p-7">
            <span className="text-[16px] font-semibold">2 · Mode de livraison</span>

            {devisEnCours && !devis && (
              <p className="m-0 text-[14px] text-ink-70">Calcul des options…</p>
            )}

            {devis && !devis.ok && (
              <p className="m-0 rounded-control border border-[rgba(200,134,10,0.35)] bg-[rgba(200,134,10,0.10)] px-4 py-3 text-[13px] leading-[1.5]">
                {devis.message}
              </p>
            )}

            {devis?.ok && (
              <>
                <div className="flex flex-col gap-2">
                  {devis.options.map(o => {
                    const actif = codeChoisi === o.code
                    return (
                      <label
                        key={o.code}
                        className="glass-light flex cursor-pointer flex-col gap-1 rounded-control px-4 py-3"
                        style={actif ? { borderColor: 'rgba(200,134,10,0.55)', background: 'rgba(200,134,10,0.10)' } : undefined}
                      >
                        <span className="flex items-center justify-between gap-3 text-[14px]">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <input
                              type="radio"
                              name="livraison"
                              checked={actif}
                              onChange={() => { setCodeChoisi(o.code); setPointRelais(null) }}
                            />
                            <span className="min-w-0">{o.label}</span>
                          </span>
                          <span className="shrink-0 font-medium">{formatPrice(o.prixPort)}</span>
                        </span>

                        {/* Mention imposée : ce mode n'offre aucun recours en cas de perte. */}
                        {!o.tracked && (
                          <span className="pl-[26px] text-[12px] text-[#8A2F1D]">
                            Envoi non suivi et non assuré
                          </span>
                        )}
                        {/* Un forfait nul ne s'annonce pas : « + 0,00 € de
                            préparation » est du bruit, et « soit X au total »
                            répéterait le prix déjà affiché à droite. */}
                        {o.forfait > 0 && (
                          <span className="pl-[26px] text-[12px] text-ink-55">
                            + {formatPrice(o.forfait)} de préparation, soit {formatPrice(o.totalLivraison)} au total
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>

                <span className="text-[12px] text-ink-55">
                  Poids de l&apos;envoi : {devis.poidsTotalG} g, emballage compris.
                </span>

                {option?.needsServicePoint && (
                  <SelecteurPointRelais
                    transporteur={option.carrier}
                    pays={adresse.pays}
                    codePostal={adresse.code_postal}
                    choisi={pointRelais}
                    onChoisir={setPointRelais}
                  />
                )}
              </>
            )}
          </section>

          {/* ── 3. Avoir ────────────────────────────────────────────────── */}
          <section className="glass flex flex-col gap-3 rounded-block p-7">
            <span className="text-[16px] font-semibold">3 · Avoir client</span>
            {storeCredit > 0 ? (
              <div className="flex flex-col gap-1">
                <span className="text-[14px] font-semibold">
                  Utiliser mon avoir : {formatPrice(creditApplique)}
                </span>
                <span className="text-[12px] text-ink-60">
                  Déduit automatiquement du total, dans la limite du montant à payer.
                </span>
              </div>
            ) : (
              <p className="m-0 text-[14px] leading-[1.6] text-ink-70">
                Aucun avoir disponible. Un rachat de cartes vous en crédite un.
              </p>
            )}
          </section>
        </div>

        {/* ── Récapitulatif ──────────────────────────────────────────────── */}
        <aside className="glass flex flex-col rounded-block p-7 lg:sticky lg:top-24">
          <span className="mb-5 text-[17px] font-semibold">Votre commande</span>

          <div className="flex flex-col gap-2.5">
            {items.map(item => (
              <div key={item.listingId} className="flex justify-between gap-3 text-[14px]">
                <span className="min-w-0">
                  <span className="line-clamp-2">{item.name}</span>{' '}
                  <span className="text-[rgba(26,22,17,0.5)]">× {item.quantity}</span>
                </span>
                <span className="shrink-0 font-medium">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="my-4 h-px bg-[rgba(26,22,17,0.12)]" />

          <div className="flex justify-between py-1.5 text-[14px]">
            <span className="text-[rgba(26,22,17,0.65)]">Sous-total articles</span>
            <span>{formatPrice(total)}</span>
          </div>
          <div className="flex justify-between py-1.5 text-[14px]">
            <span className="text-[rgba(26,22,17,0.65)]">
              Livraison{option ? ` : ${option.label}` : ''}
            </span>
            <span>{option ? formatPrice(option.prixPort) : 'à choisir'}</span>
          </div>
          {(option ? option.forfait > 0 : (devis?.forfait ?? 0) > 0) && (
            <div className="flex justify-between py-1.5 text-[14px]">
              <span className="text-[rgba(26,22,17,0.65)]">Frais de préparation et d&apos;emballage</span>
              <span>{option ? formatPrice(option.forfait) : formatPrice(devis?.forfait ?? 0)}</span>
            </div>
          )}
          {creditApplique > 0 && (
            <div className="flex justify-between py-1.5 text-[14px]">
              <span className="text-[rgba(26,22,17,0.65)]">Avoir client</span>
              <span>− {formatPrice(creditApplique)}</span>
            </div>
          )}
          {pointRelais && (
            <div className="flex justify-between gap-3 py-1.5 text-[13px]">
              <span className="text-[rgba(26,22,17,0.65)]">Point relais</span>
              <span className="text-right">{pointRelais.nom}</span>
            </div>
          )}

          <div className="my-3 h-px bg-[rgba(26,22,17,0.12)]" />

          <div className="mb-5 flex items-baseline justify-between">
            <span className="text-[15px] font-semibold">Total</span>
            <span className="text-[24px] font-semibold lg:text-[26px]">{formatPrice(aPayer)}</span>
          </div>

          {/* ── CGV : obligatoire, et le serveur le revérifie ─────────────── */}
          <label className="mb-4 flex cursor-pointer items-start gap-2.5 text-[13px] leading-[1.5]">
            <input
              type="checkbox"
              checked={cgv}
              onChange={e => setCgv(e.target.checked)}
              className="mt-0.5 shrink-0"
            />
            <span>
              J&apos;accepte les{' '}
              <Link href="/cgv" className="underline underline-offset-2">
                conditions générales de vente
              </Link>
              .
            </span>
          </label>

          {sousMinimum && (
            <p className="mb-3 rounded-control border border-[rgba(200,134,10,0.35)] bg-[rgba(200,134,10,0.10)] px-4 py-3 text-[13px] leading-[1.5]">
              {`Minimum de commande : ${euros(minimum)} d'articles. Il manque ${euros(manque)}.`}
            </p>
          )}

          {error && (
            <p className="mb-3 rounded-control border border-[rgba(185,28,28,0.35)] bg-[rgba(185,28,28,0.08)] px-4 py-3 text-[13px] leading-[1.5] text-[#8c1d1d]">
              {error}
            </p>
          )}

          <button
            onClick={payer}
            disabled={!pretAPayer}
            className="btn-ochre py-4 text-[15px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Redirection vers Stripe…' : 'Payer'}
          </button>

          {/* Dire CE QUI manque, plutôt que de laisser un bouton gris muet. */}
          {!pretAPayer && !loading && (
            <span className="mt-3 text-center text-[12px] text-ink-55">
              {sousMinimum ? `Ajoutez ${euros(manque)} d'articles pour atteindre le minimum.`
                : !adresseComplete ? 'Complétez votre adresse de livraison.'
                : !option ? 'Choisissez un mode de livraison.'
                : relaisManquant ? 'Choisissez un point relais.'
                : !cgv ? 'Acceptez les conditions générales de vente.'
                : ''}
            </span>
          )}

          <span className="mt-3 text-center font-mono text-[9px] tracking-[0.12em] text-[rgba(26,22,17,0.5)]">
            PAIEMENT SÉCURISÉ · REDIRECTION VERS STRIPE
          </span>
        </aside>
      </div>
    </main>
  )
}
