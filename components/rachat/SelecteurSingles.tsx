'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Rachat — sélection carte par carte.
 *
 * Parcours imposé : univers → extension → carte → version → la ligne tombe dans
 * la LISTE LATÉRALE de droite, cumulative. On recommence autant de fois que
 * nécessaire, puis on soumet.
 *
 * ⚠️ AUCUN PRIX n'apparaît nulle part dans cet écran : ni par ligne, ni en
 * total, ni en fourchette. L'offre est chiffrée par Goriki après réception et
 * inspection physique du lot. L'estimateur instantané précédent affichait un
 * total en direct — il contredisait frontalement la promesse écrite juste
 * en dessous de lui.
 *
 * Les tables de catalogue sont publiquement lisibles (c'est ce qui fait marcher
 * le catalogue) : la cascade interroge Supabase avec la clé anon, sans route
 * d'API supplémentaire.
 */

const CLE_BROUILLON = 'goriki:rachat:singles'

type Univers = 'onepiece' | 'pokemon'

interface SetRow { id: string; code: string; name_fr: string }
interface CardRow { id: string; set_id: string; name_fr: string; number: string; rarity: string | null; image_url: string | null }
interface VariantRow { code: string; label: string }

export interface LigneLot {
  universe: Univers
  set_code: string
  card_id: string
  card_name: string
  card_number: string
  variant_code: string | null
  variant_label: string | null
  image_url: string | null
  quantity: number
}

const TABLES: Record<Univers, { sets: string; cards: string; variants: string; label: string }> = {
  onepiece: { sets: 'onepiece_sets', cards: 'onepiece_cards', variants: 'onepiece_variant_types', label: 'One Piece' },
  pokemon: { sets: 'pokemon_sets', cards: 'pokemon_cards', variants: 'pokemon_variant_types', label: 'Pokémon' },
}

export default function SelecteurSingles({
  connected,
  verified,
}: {
  connected: boolean
  verified: boolean
}) {
  const router = useRouter()

  const [univers, setUnivers] = useState<Univers | null>(null)
  const [sets, setSets] = useState<SetRow[]>([])
  const [setChoisi, setSetChoisi] = useState<SetRow | null>(null)
  const [cartes, setCartes] = useState<CardRow[]>([])
  /** Code RÉEL de chaque set du groupe choisi : une carte de 30TH-C reste 30TH-C dans le lot. */
  const [codesDuGroupe, setCodesDuGroupe] = useState<Map<string, string>>(new Map())
  const [recherche, setRecherche] = useState('')
  const [carteChoisie, setCarteChoisie] = useState<CardRow | null>(null)
  const [versions, setVersions] = useState<VariantRow[]>([])
  const [chargement, setChargement] = useState(false)

  const [lot, setLot] = useState<LigneLot[]>([])
  const [envoi, setEnvoi] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [envoye, setEnvoye] = useState(false)
  const restaure = useRef(false)

  // Le lot survit à l'aller-retour de connexion : sans ça, un visiteur qui
  // construit son lot puis se connecte perdrait tout au retour.
  useEffect(() => {
    if (restaure.current) return
    restaure.current = true
    try {
      const brut = sessionStorage.getItem(CLE_BROUILLON)
      // Lecture d'un système EXTERNE (sessionStorage) au montage : ce ne peut
      // pas être un état initial paresseux, sinon le rendu serveur et le rendu
      // client divergeraient. Un seul `setState`, une seule fois, jamais en
      // cascade.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (brut) setLot(JSON.parse(brut) as LigneLot[])
    } catch {
      /* brouillon illisible : on repart de zéro, sans bruit */
    }
  }, [])

  useEffect(() => {
    if (!restaure.current) return
    try {
      sessionStorage.setItem(CLE_BROUILLON, JSON.stringify(lot))
    } catch {
      /* quota plein : le lot reste en mémoire, c'est suffisant */
    }
  }, [lot])

  // ── Cascade ───────────────────────────────────────────────────────────────
  async function choisirUnivers(u: Univers) {
    setUnivers(u)
    setSetChoisi(null); setCartes([]); setCarteChoisie(null); setVersions([]); setRecherche('')
    setChargement(true)
    const supabase = createClient()
    const { data } = await supabase
      .from(TABLES[u].sets)
      .select('id, code, name_fr')
      .eq('is_active', true)
      // Un set rattaché (migration 0057) se choisit par son parent.
      .is('display_parent_id', null)
      .order('code')
    setSets((data ?? []) as SetRow[])
    setChargement(false)
  }

  async function choisirSet(s: SetRow) {
    if (!univers) return
    setSetChoisi(s)
    setCarteChoisie(null); setVersions([]); setRecherche('')
    setChargement(true)
    const supabase = createClient()
    // Le set choisi et ses rattachés : les cartes de ces derniers suivent.
    const { data: rattaches } = await supabase
      .from(TABLES[univers].sets)
      .select('id, code')
      .eq('display_parent_id', s.id)
      .order('code')
    const groupe = [{ id: s.id, code: s.code }, ...((rattaches ?? []) as { id: string; code: string }[])]
    const rang = new Map(groupe.map((g, i) => [g.id, i]))
    const { data } = await supabase
      .from(TABLES[univers].cards)
      .select('id, set_id, name_fr, number, rarity, image_url')
      .in('set_id', groupe.map(g => g.id))
      .order('number')
      .limit(500 * groupe.length)
    setCodesDuGroupe(new Map(groupe.map(g => [g.id, g.code])))
    setCartes(
      ((data ?? []) as CardRow[]).sort((a, b) => (rang.get(a.set_id) ?? 0) - (rang.get(b.set_id) ?? 0)),
    )
    setChargement(false)
  }

  async function choisirCarte(c: CardRow) {
    if (!univers || !setChoisi) return
    setCarteChoisie(c)
    setChargement(true)
    const supabase = createClient()
    const { data } = await supabase
      .from(TABLES[univers].variants)
      .select('code, label')
      .or(`set_id.eq.${c.set_id},set_id.is.null`)
    const rows = (data ?? []) as VariantRow[]
    setVersions(rows)
    setChargement(false)
    // Une seule version possible : on n'impose pas un clic pour rien.
    if (rows.length === 1) ajouter(c, rows[0])
  }

  function ajouter(c: CardRow, v: VariantRow | null) {
    if (!univers || !setChoisi) return
    setLot(prev => {
      const i = prev.findIndex(
        l => l.card_id === c.id && (l.variant_code ?? null) === (v?.code ?? null)
      )
      if (i >= 0) {
        const copie = [...prev]
        copie[i] = { ...copie[i], quantity: copie[i].quantity + 1 }
        return copie
      }
      return [
        ...prev,
        {
          universe: univers,
          set_code: codesDuGroupe.get(c.set_id) ?? setChoisi.code,
          card_id: c.id,
          card_name: c.name_fr,
          card_number: c.number,
          variant_code: v?.code ?? null,
          variant_label: v?.label ?? null,
          image_url: c.image_url,
          quantity: 1,
        },
      ]
    })
    // On revient à l'étape « carte » : le geste courant est d'enchaîner
    // plusieurs cartes du même set.
    setCarteChoisie(null)
    setVersions([])
  }

  const retirer = (i: number) => setLot(prev => prev.filter((_, k) => k !== i))
  const changerQuantite = (i: number, delta: number) =>
    setLot(prev =>
      prev.map((l, k) => (k === i ? { ...l, quantity: Math.max(1, l.quantity + delta) } : l))
    )

  const cartesFiltrees = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    if (!q) return cartes.slice(0, 60)
    return cartes
      .filter(c => c.name_fr.toLowerCase().includes(q) || c.number.toLowerCase().includes(q))
      .slice(0, 60)
  }, [cartes, recherche])

  const totalCartes = lot.reduce((n, l) => n + l.quantity, 0)

  // ── Soumission ────────────────────────────────────────────────────────────
  async function soumettre() {
    if (!connected) {
      router.push('/login?redirect=/rachat')
      return
    }
    setEnvoi(true)
    setMessage(null)

    const res = await fetch('/api/rachat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'singles',
        // `image_url` ne part pas : c'est une commodité d'affichage, pas une
        // donnée du lot déclaré.
        items: lot.map(l => ({
          universe: l.universe,
          set_code: l.set_code,
          card_id: l.card_id,
          card_name: l.card_name,
          card_number: l.card_number,
          variant_code: l.variant_code,
          variant_label: l.variant_label,
          quantity: l.quantity,
        })),
      }),
    })
    const data = await res.json().catch(() => ({}))
    setEnvoi(false)

    if (!res.ok) {
      setMessage(data.error ?? 'Envoi impossible.')
      return
    }
    setLot([])
    setEnvoye(true)
    router.refresh()
  }

  const etapes = [
    { n: 1, t: 'Univers', fait: !!univers },
    { n: 2, t: 'Extension', fait: !!setChoisi },
    { n: 3, t: 'Carte', fait: lot.length > 0 || !!carteChoisie },
    { n: 4, t: 'Version', fait: lot.length > 0 },
  ]

  if (envoye) {
    return (
      <div className="glass rounded-panel-lg p-8 text-center lg:p-10">
        <h2 className="display-sub m-0">Lot transmis</h2>
        <p className="m-0 mx-auto mt-4 max-w-[54ch] text-[14px] leading-[1.65] text-ink-70">
          Votre lot est enregistré et attend l&apos;inspection. Nous revenons vers vous avec une
          offre chiffrée une fois les cartes reçues et contrôlées pièce par pièce.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <Link href="/compte/rachat" className="btn-ochre px-6 py-3.5 font-mono text-[11px] uppercase tracking-[0.14em]">
            Suivre ma demande
          </Link>
          <button
            type="button"
            onClick={() => setEnvoye(false)}
            className="btn-ghost px-6 py-3.5 font-mono text-[11px] uppercase tracking-[0.14em]"
          >
            Soumettre un autre lot
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Bandeau d'étapes */}
      <ol className="hair m-0 mb-8 grid list-none grid-cols-2 gap-5 pt-6 sm:grid-cols-4 lg:mb-10">
        {etapes.map(e => (
          <li key={e.n} className="flex items-start gap-2.5">
            <span
              className="mt-[1px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px]"
              style={
                e.fait
                  ? { background: 'var(--color-ochre)', color: '#1A1207' }
                  : { border: '1px solid rgba(26,22,17,0.25)', color: 'rgba(26,22,17,0.55)' }
              }
            >
              {e.n}
            </span>
            <span className="text-[13px] font-semibold leading-tight text-ink">{e.t}</span>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,62fr)_minmax(0,38fr)] lg:items-start">
        {/* ── Cascade de sélection ─────────────────────────────────────── */}
        <div className="glass flex flex-col gap-6 rounded-panel-lg p-5 lg:p-6">
          <div>
            <span className="data text-[9px]">1 · Univers</span>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {(Object.keys(TABLES) as Univers[]).map(u => (
                <button key={u} type="button" className="pill" data-active={univers === u} onClick={() => choisirUnivers(u)}>
                  {TABLES[u].label}
                </button>
              ))}
            </div>
          </div>

          {univers && (
            <div>
              <span className="data text-[9px]">2 · Extension</span>
              {chargement && sets.length === 0 ? (
                <p className="data m-0 mt-2.5 text-[9px]">Chargement…</p>
              ) : (
                <select
                  aria-label="Extension"
                  value={setChoisi?.id ?? ''}
                  onChange={e => {
                    const s = sets.find(x => x.id === e.target.value)
                    if (s) choisirSet(s)
                  }}
                  className="mt-2.5 w-full rounded-control border border-[rgba(26,22,17,0.14)] bg-[rgba(255,255,255,0.7)] px-3.5 py-2.5 text-[13px] text-ink"
                >
                  <option value="">Choisir une extension…</option>
                  {sets.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name_fr}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {setChoisi && (
            <div>
              <span className="data text-[9px]">3 · Carte</span>
              <input
                value={recherche}
                onChange={e => setRecherche(e.target.value)}
                placeholder="Filtrer par nom ou numéro…"
                aria-label="Filtrer les cartes de l'extension"
                className="field mt-2.5"
              />
              <div className="mt-3 max-h-[280px] overflow-y-auto rounded-panel border border-[rgba(26,22,17,0.1)]">
                {cartesFiltrees.length === 0 ? (
                  <p className="data m-0 px-4 py-3 text-[9px]">
                    {chargement ? 'Chargement…' : 'Aucune carte ne correspond.'}
                  </p>
                ) : (
                  cartesFiltrees.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => choisirCarte(c)}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[rgba(26,22,17,0.05)] ${
                        carteChoisie?.id === c.id ? 'bg-[rgba(200,134,10,0.1)]' : ''
                      }`}
                    >
                      {c.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- vignette de liste dense
                        <img src={c.image_url} alt="" aria-hidden className="h-11 w-8 rounded-[3px] object-cover" />
                      ) : (
                        <span className="scan-pending h-11 w-8 rounded-[3px]" />
                      )}
                      <span className="flex min-w-0 flex-col">
                        <span className="line-clamp-1 text-[13px] text-ink">{c.name_fr}</span>
                        <span className="data text-[8px]">
                          {/* Carte d'un set rattaché : son code, sinon 30TH-C 001
                              se confondrait avec 30TH 001. */}
                          {setChoisi && c.set_id !== setChoisi.id ? `${codesDuGroupe.get(c.set_id) ?? ''} ` : ''}
                          {c.number}
                          {c.rarity ? ` · ${c.rarity}` : ''}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {carteChoisie && versions.length > 1 && (
            <div>
              <span className="data text-[9px]">4 · Version de « {carteChoisie.name_fr} »</span>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {versions.map(v => (
                  <button key={v.code} type="button" className="pill" onClick={() => ajouter(carteChoisie, v)}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Liste latérale ───────────────────────────────────────────── */}
        <div className="glass rounded-panel-lg p-5 lg:sticky lg:top-24 lg:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="display-sub m-0">Mon lot</h2>
            <span className="data text-[9px]">
              {totalCartes} carte{totalCartes > 1 ? 's' : ''}
            </span>
          </div>

          {lot.length === 0 ? (
            <p className="m-0 mt-5 text-[13px] leading-[1.6] text-ink-70">
              Votre lot est vide. Choisissez un univers, puis une extension, puis les cartes
              que vous souhaitez nous confier.
            </p>
          ) : (
            <ul className="m-0 mt-4 flex max-h-[420px] list-none flex-col overflow-y-auto">
              {lot.map((l, i) => (
                <li
                  key={`${l.card_id}-${l.variant_code ?? 'x'}`}
                  className="flex items-center gap-2.5 border-b border-[rgba(26,22,17,0.09)] py-2.5 last:border-0"
                >
                  {l.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- vignette de ligne
                    <img src={l.image_url} alt="" aria-hidden className="h-12 w-[34px] shrink-0 rounded-[3px] object-cover" />
                  ) : (
                    <span className="scan-pending h-12 w-[34px] shrink-0 rounded-[3px]" />
                  )}

                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="line-clamp-1 text-[12px] font-medium leading-tight text-ink">{l.card_name}</span>
                    <span className="data text-[8px]">
                      {l.set_code} · {l.card_number}
                      {l.variant_label ? ` · ${l.variant_label}` : ''}
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => changerQuantite(i, -1)}
                      aria-label="Retirer un exemplaire"
                      className="h-6 w-6 rounded-control border border-[rgba(26,22,17,0.14)] text-[13px] leading-none text-ink-70 hover:bg-white"
                    >
                      −
                    </button>
                    <span className="w-5 text-center font-mono text-[11px] text-ink">{l.quantity}</span>
                    <button
                      type="button"
                      onClick={() => changerQuantite(i, 1)}
                      aria-label="Ajouter un exemplaire"
                      className="h-6 w-6 rounded-control border border-[rgba(26,22,17,0.14)] text-[13px] leading-none text-ink-70 hover:bg-white"
                    >
                      +
                    </button>
                  </span>

                  <button
                    type="button"
                    onClick={() => retirer(i)}
                    aria-label={`Retirer ${l.card_name}`}
                    className="shrink-0 rounded-control px-1.5 py-1 text-[15px] leading-none text-ink-55 transition-colors hover:bg-[rgba(26,22,17,0.07)] hover:text-ink"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          {message && <p className="m-0 mt-4 text-[12px] text-[#A33B2A]">{message}</p>}

          {connected && !verified && lot.length > 0 && (
            <p className="m-0 mt-4 rounded-control border border-[rgba(200,134,10,0.35)] bg-[rgba(200,134,10,0.1)] px-3.5 py-3 text-[12px] leading-[1.5] text-ink">
              Votre identité doit être vérifiée avant toute soumission.{' '}
              <Link href="/compte/verification" className="underline hover:text-ochre">
                Vérifier mon identité
              </Link>
            </p>
          )}

          <button
            type="button"
            onClick={soumettre}
            disabled={lot.length === 0 || envoi}
            className="btn-ochre mt-5 w-full px-5 py-3.5 font-mono text-[11px] uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {envoi
              ? 'Envoi…'
              : !connected
                ? 'Se connecter pour soumettre'
                : 'Soumettre pour inspection'}
          </button>

          <p className="m-0 mt-4 text-[11px] leading-[1.55] text-ink-55">
            Aucun montant n&apos;est annoncé à ce stade. L&apos;offre est chiffrée après
            réception et inspection physique du lot, pièce par pièce.
          </p>
        </div>
      </div>
    </>
  )
}
