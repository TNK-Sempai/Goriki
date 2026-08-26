'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pagination } from '@/components/ui/Pagination'
import {
  corrigerCarte, relacherChampCarte,
  ajouterVariante, supprimerVariante,
} from '@/app/admin/catalogue/actions'
import type { SetNettoyage, TypeVariante } from './types'

/**
 * Vue ÉDITEUR — trois colonnes, patron PonéglypheAPI.
 *
 * ─── L'UNITÉ D'AFFICHAGE EST LA VARIANTE, PAS LA CARTE ────────────────────
 * Une Normale et une Reverse sont deux OBJETS distincts : visuel propre, verrou
 * propre, existence propre. Une carte n'est qu'un regroupement. La grille rend
 * donc une vignette par VARIANTE — un set typique passe de 120 vignettes à 168.
 *
 * C'est ce qui permet le geste visé : lire « NORMALE 120 · REVERSE 44 » sur un
 * set de 120 cartes et voir immédiatement qu'il manque 76 Reverse. Une grille
 * par carte, si complète soit-elle en indicateurs, ne montre jamais ça.
 *
 * Répartition réelle des 29 210 variantes (après la purge Pocket) : Normale
 * 15 452, Reverse 7 017, Holo 6 051, 1ère édition 676, Pokéball 8,
 * Ball Copain 2, Ball Love 2, Ball Sombre 1, Ball Rapide 1, Masterball 0,
 * Ball Rocket 0.
 *
 * ─── FACETTES EN COMPTEURS AFFICHÉS, PAS EN MENUS ─────────────────────────
 * Les nombres sont calculés sur le SET ENTIER, jamais sur la page affichée :
 * voir le compte AVANT de filtrer est ce qui rend l'anomalie visible.
 */

export interface Exemplaire { id: string; quantity: number; condition: string | null }

export interface VarianteAdmin {
  id: string
  image_url: string | null
  image_manuelle: string | null
  locked_fields: string[]
  pokemon_variant_types: TypeVariante | TypeVariante[]
  pokemon_listings: Exemplaire[] | null
}

export interface CarteAdmin {
  id: string
  number: string
  name_fr: string
  rarity: string | null
  card_type: string | null
  category: string | null
  attribute: string | null
  is_secret: boolean
  is_promo: boolean
  image_url: string | null
  locked_fields: string[]
  pokemon_card_variants: VarianteAdmin[] | null
}

/** Une ligne de grille : la variante, aplatie avec sa carte porteuse. */
interface Ligne {
  variante: VarianteAdmin
  carte: CarteAdmin
  type: TypeVariante | undefined
  /** Nombre de variantes de la même carte — sert au rattachement visuel. */
  fratrie: number
}

const seul = <T,>(v: T | T[]): T => (Array.isArray(v) ? v[0] : v)
const variantesDe = (c: CarteAdmin) => c.pokemon_card_variants ?? []

type Tri = 'collection' | 'az' | 'za'
type EtatVisuel = 'api' | 'manuel' | 'aucun'

const etatVisuel = (v: VarianteAdmin): EtatVisuel =>
  v.image_manuelle ? 'manuel' : v.image_url ? 'api' : 'aucun'

export default function VueEditeur({
  sets, setCourant, cartes, typesAutorises,
}: {
  sets: SetNettoyage[]
  setCourant: SetNettoyage | null
  cartes: CarteAdmin[]
  typesAutorises: TypeVariante[]
}) {
  const [fType, setFType] = useState<string | null>(null)
  const [fRarete, setFRarete] = useState<string | null>(null)
  const [fVariante, setFVariante] = useState<string | null>(null)
  const [fEtat, setFEtat] = useState<'verrouillee' | 'libre' | null>(null)
  const [fVisuel, setFVisuel] = useState<EtatVisuel | null>(null)
  const [tri, setTri] = useState<Tri>('collection')
  const [page, setPage] = useState(1)
  const [parPage, setParPage] = useState(60)
  const [selection, setSelection] = useState<string | null>(null)

  // Aplatissement carte → variantes. L'ordre des cartes vient de la base
  // (ordre de collection) ; à l'intérieur d'une carte, l'ordre du set.
  const toutes: Ligne[] = useMemo(
    () =>
      cartes.flatMap(c => {
        const vs = variantesDe(c)
          .slice()
          .sort((a, b) => (seul(a.pokemon_variant_types)?.sort_order ?? 0) - (seul(b.pokemon_variant_types)?.sort_order ?? 0))
        return vs.map(v => ({
          variante: v,
          carte: c,
          type: seul(v.pokemon_variant_types),
          fratrie: vs.length,
        }))
      }),
    [cartes],
  )

  const facettes = useMemo(() => {
    const compter = (cle: (l: Ligne) => string | null | undefined) => {
      const m = new Map<string, number>()
      for (const l of toutes) {
        const k = cle(l)
        if (k) m.set(k, (m.get(k) ?? 0) + 1)
      }
      return [...m.entries()].sort((a, b) => b[1] - a[1])
    }
    return {
      types: compter(l => l.carte.card_type),
      raretes: compter(l => l.carte.rarity),
      variantes: compter(l => l.type?.label),
      verrouillees: toutes.filter(l => (l.carte.locked_fields?.length ?? 0) > 0 || (l.variante.locked_fields?.length ?? 0) > 0).length,
      visuelApi: toutes.filter(l => etatVisuel(l.variante) === 'api').length,
      visuelManuel: toutes.filter(l => etatVisuel(l.variante) === 'manuel').length,
      visuelAucun: toutes.filter(l => etatVisuel(l.variante) === 'aucun').length,
    }
  }, [toutes])

  const filtrees = useMemo(() => {
    const out = toutes
      .filter(l => !fType || l.carte.card_type === fType)
      .filter(l => !fRarete || l.carte.rarity === fRarete)
      .filter(l => !fVariante || l.type?.label === fVariante)
      .filter(l => {
        if (!fEtat) return true
        const verrouillee = (l.carte.locked_fields?.length ?? 0) > 0 || (l.variante.locked_fields?.length ?? 0) > 0
        return fEtat === 'verrouillee' ? verrouillee : !verrouillee
      })
      .filter(l => !fVisuel || etatVisuel(l.variante) === fVisuel)
    if (tri === 'az') return [...out].sort((a, b) => a.carte.name_fr.localeCompare(b.carte.name_fr))
    if (tri === 'za') return [...out].sort((a, b) => b.carte.name_fr.localeCompare(a.carte.name_fr))
    return out
  }, [toutes, fType, fRarete, fVariante, fEtat, fVisuel, tri])

  const pages = Math.max(1, Math.ceil(filtrees.length / parPage))
  const pageSure = Math.min(page, pages)
  const debut = (pageSure - 1) * parPage
  const affichees = filtrees.slice(debut, debut + parPage)

  const ligneActive = toutes.find(l => l.variante.id === selection) ?? null
  const reset = () => setPage(1)

  return (
    /* Colonnes indépendantes : chacune porte son propre défilement, et Lenis
       est désormais désactivé sur /admin — la molette atteint donc bien le
       conteneur survolé. */
    <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr 340px', flex: 1, minHeight: 0 }}>
      {/* ── Gauche : les 185 sets, numérotés ─────────────────────────────── */}
      <aside className="gk-colonne" aria-label="Liste des sets" style={{ borderRight: '1px solid var(--gk-line)' }}>
        {sets.map((s, i) => (
          <Link
            key={s.set_id}
            href={`/admin/catalogue/editeur?set=${s.set_id}`}
            className="gk-row"
            style={{ gridTemplateColumns: '26px 1fr', textDecoration: 'none', color: 'inherit', padding: '5px 10px' }}
            data-active={setCourant?.set_id === s.set_id}
          >
            <span className="gk-dim" style={{ fontSize: 9 }}>{String(i + 1).padStart(2, '0')}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.code}
              </span>
              <span className="gk-dim" style={{ fontSize: 9 }}>
                {s.variantes} var.
                {s.cartes_corrigees > 0 && <span className="gk-verrou"> {s.cartes_corrigees}🔒</span>}
              </span>
            </span>
          </Link>
        ))}
      </aside>

      {/* ── Centre : facettes puis grille de VARIANTES ───────────────────── */}
      <section className="gk-colonne" aria-label="Variantes du set" style={{ minWidth: 0 }}>
        <div className="gk-facettes">
          <LigneFacette label="Type" total={toutes.length} actif={fType}
            options={facettes.types} onChoisir={v => { setFType(v); reset() }} />
          <LigneFacette label="Rareté" total={toutes.length} actif={fRarete}
            options={facettes.raretes} onChoisir={v => { setFRarete(v); reset() }} />
          {/* La facette qui porte tout l'écran : « NORMALE 120 · REVERSE 44 »
              dit d'un coup qu'il manque 76 Reverse. */}
          <LigneFacette label="Variante" total={toutes.length} actif={fVariante}
            options={facettes.variantes} onChoisir={v => { setFVariante(v); reset() }} />

          <div className="gk-facette-ligne">
            <span className="gk-facette-label">Visuel</span>
            <button type="button" className="gk-facette" data-active={fVisuel === null} onClick={() => { setFVisuel(null); reset() }}>
              Tous<b>{toutes.length}</b>
            </button>
            <button type="button" className="gk-facette" data-active={fVisuel === 'api'} onClick={() => { setFVisuel('api'); reset() }}>
              API<b>{facettes.visuelApi}</b>
            </button>
            <button type="button" className="gk-facette" data-active={fVisuel === 'manuel'} onClick={() => { setFVisuel('manuel'); reset() }}>
              Manuel<b>{facettes.visuelManuel}</b>
            </button>
            <button type="button" className="gk-facette" data-active={fVisuel === 'aucun'} onClick={() => { setFVisuel('aucun'); reset() }}>
              Aucun<b>{facettes.visuelAucun}</b>
            </button>
          </div>

          <div className="gk-facette-ligne">
            <span className="gk-facette-label">État</span>
            <button type="button" className="gk-facette" data-active={fEtat === null} onClick={() => { setFEtat(null); reset() }}>
              Toutes<b>{toutes.length}</b>
            </button>
            <button type="button" className="gk-facette" data-active={fEtat === 'verrouillee'} onClick={() => { setFEtat('verrouillee'); reset() }}>
              Verrouillée<b>{facettes.verrouillees}</b>
            </button>
            <button type="button" className="gk-facette" data-active={fEtat === 'libre'} onClick={() => { setFEtat('libre'); reset() }}>
              Libre<b>{toutes.length - facettes.verrouillees}</b>
            </button>
          </div>

          <div className="gk-facette-ligne">
            <span className="gk-facette-label">Tri</span>
            {([['collection', 'Collection'], ['az', 'A → Z'], ['za', 'Z → A']] as [Tri, string][]).map(([v, l]) => (
              <button key={v} type="button" className="gk-facette" data-active={tri === v} onClick={() => setTri(v)}>{l}</button>
            ))}
          </div>
        </div>

        <div className="gk-grille">
          {affichees.map(l => {
            const vis = etatVisuel(l.variante)
            const verrouillee = (l.carte.locked_fields?.length ?? 0) > 0 || (l.variante.locked_fields?.length ?? 0) > 0
            return (
              <button
                key={l.variante.id}
                type="button"
                className="gk-vignette"
                data-active={selection === l.variante.id}
                onClick={() => setSelection(l.variante.id)}
              >
                {l.variante.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- vignette dense d'outil interne, 60 par page
                  <img src={l.variante.image_url} alt="" loading="lazy" />
                ) : (
                  <span style={{ display: 'block', aspectRatio: '2.5/3.5', background: '#111119' }} />
                )}
                <span className="gk-vignette-num">
                  {l.carte.number}
                  {/* Rattachement visuel entre variantes d'une même carte :
                      même numéro, types différents, aucune subordination. */}
                  {l.fratrie > 1 && <span className="gk-dim"> ·{l.fratrie}</span>}
                  {verrouillee && <span className="gk-verrou"> 🔒</span>}
                </span>
                <span className="gk-vignette-nom">{l.carte.name_fr}</span>
                {/* Le TYPE DE VARIANTE en clair : c'est ce qui distingue cette
                    vignette de sa voisine. */}
                <span className="gk-tag" data-etat={vis === 'aucun' ? 'aucun' : vis === 'manuel' ? 'logo' : 'symbole'}>
                  {l.type?.label ?? '—'}{vis === 'aucun' && ' · sans visuel'}
                </span>
              </button>
            )
          })}
        </div>

        {filtrees.length === 0 && (
          <p className="gk-dim" style={{ padding: '14px 16px', fontSize: 11 }}>
            Aucune variante ne correspond aux facettes.
          </p>
        )}

        <div style={{ padding: '0 16px 16px' }}>
          <Pagination
            page={pageSure}
            pages={pages}
            total={filtrees.length}
            parPage={parPage}
            premier={filtrees.length === 0 ? 0 : debut + 1}
            dernier={Math.min(debut + parPage, filtrees.length)}
            unite="variante"
            onChange={({ page: p, parPage: pp }) => {
              if (pp !== undefined) setParPage(pp)
              if (p !== undefined) setPage(p)
            }}
          />
        </div>
      </section>

      {/* ── Droite : éditeur de la VARIANTE sélectionnée ─────────────────── */}
      {/* 18 px et non 14 : le panneau empile une dizaine de champs et une
          quarantaine de boutons dans 340 px. Mesuré avant correction, les
          boutons voisins n'étaient séparés que de 5 px — la maquette admin,
          elle, pose 12 px entre ses contrôles. On ne va pas jusque-là ici
          (ce panneau est plus dense qu'une barre de facettes), mais on sort
          du contact. */}
      <aside className="gk-colonne" aria-label="Éditeur de variante" style={{ borderLeft: '1px solid var(--gk-line)', padding: 18 }}>
        {ligneActive ? (
          <EditeurVariante
            ligne={ligneActive}
            fratrie={variantesDe(ligneActive.carte)}
            typesAutorises={typesAutorises}
            codeSet={setCourant?.code ?? ''}
            onSelectionner={setSelection}
          />
        ) : (
          <p className="gk-dim" style={{ fontSize: 11 }}>
            Sélectionner une variante dans la grille.
          </p>
        )}
      </aside>
    </div>
  )
}

function LigneFacette({
  label, total, options, actif, onChoisir,
}: {
  label: string
  total: number
  options: [string, number][]
  actif: string | null
  onChoisir: (v: string | null) => void
}) {
  return (
    <div className="gk-facette-ligne">
      <span className="gk-facette-label">{label}</span>
      <button type="button" className="gk-facette" data-active={actif === null} onClick={() => onChoisir(null)}>
        All<b>{total}</b>
      </button>
      {options.map(([v, n]) => (
        <button key={v} type="button" className="gk-facette" data-active={actif === v} onClick={() => onChoisir(v)}>
          {v}<b>{n}</b>
        </button>
      ))}
    </div>
  )
}

/**
 * Éditeur de la VARIANTE sélectionnée.
 *
 * Deux portées cohabitent et doivent être distinguées sans ambiguïté :
 *   · ce qui appartient à la VARIANTE — son visuel, son type, sa suppression ;
 *   · ce qui appartient à la CARTE — nom, numéro, rareté… donc commun à TOUTES
 *     ses variantes. Corriger le nom depuis la Reverse renomme aussi la
 *     Normale : le dire est indispensable, sinon la correction surprend.
 */
function EditeurVariante({
  ligne, fratrie, typesAutorises, codeSet, onSelectionner,
}: {
  ligne: Ligne
  fratrie: VarianteAdmin[]
  typesAutorises: TypeVariante[]
  codeSet: string
  onSelectionner: (id: string) => void
}) {
  const { carte, variante, type } = ligne
  const [msg, setMsg] = useState<string | null>(null)
  const [aDeplacer, setADeplacer] = useState(false)
  const [enCours, demarrer] = useTransition()
  /** Champ « coller une URL » — vidé après un succès, conservé après un refus
      pour qu'on puisse corriger la faute de frappe sans tout retaper. */
  const [urlCollee, setUrlCollee] = useState('')
  const [urlEnCours, setUrlEnCours] = useState(false)
  // Les actions serveur de cet écran revalident elles-mêmes ; le chemin par URL
  // passe par une route d'API, qui ne revalide rien. Sans ce `refresh`, la
  // vignette et l'étiquette « visuel manuel » resteraient sur l'ancien état
  // alors que la base, elle, aurait bien changé — le pire des deux mondes.
  const router = useRouter()

  const verrousCarte = carte.locked_fields ?? []
  const stock = (variante.pokemon_listings ?? []).reduce((n, e) => n + (e.quantity ?? 0), 0)
  const soeurs = fratrie.filter(v => v.id !== variante.id)
  const dejaPris = new Set(fratrie.map(v => seul(v.pokemon_variant_types)?.id))
  const ajoutables = typesAutorises.filter(t => !dejaPris.has(t.id))
  const vis = etatVisuel(variante)

  const champCarte = (nom: string, label: string, valeur: string | null) => {
    const verrouille = verrousCarte.includes(nom)
    return (
      <label className="gk-field" key={nom}>
        <span className="gk-label">
          {label}{verrouille && <span className="gk-verrou" style={{ marginLeft: 6 }}>🔒</span>}
        </span>
        <input
          className="gk-input"
          data-verrouille={verrouille}
          defaultValue={valeur ?? ''}
          disabled={enCours}
          onBlur={e => {
            if (e.target.value === (valeur ?? '')) return
            const v = e.target.value
            demarrer(async () => {
              const r = await corrigerCarte(carte.id, nom, v)
              setMsg(r.ok
                ? `${label} corrigé et verrouillé — appliqué aux ${fratrie.length} variante(s) de cette carte.`
                : (r.erreur ?? 'Échec'))
            })
          }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        />
        {verrouille && (
          <button
            type="button"
            className="gk-btn"
            style={{ alignSelf: 'flex-start', marginTop: 3 }}
            onClick={() => demarrer(async () => {
              const r = await relacherChampCarte(carte.id, nom)
              setMsg(r.ok ? `${label} relâché — l'API reprendra la main au prochain import.` : (r.erreur ?? 'Échec'))
            })}
          >
            Relâcher
          </button>
        )}
      </label>
    )
  }

  async function poserVisuel(fichier: File) {
    const fd = new FormData()
    fd.append('file', fichier)
    fd.append('variante_id', variante.id)
    const r = await fetch('/api/admin/catalogue/visuel-variante', { method: 'POST', body: fd })
    const j = await r.json()
    setMsg(r.ok ? "Visuel posé sur cette variante — il survivra à l'import." : (j.error ?? "Échec de l'envoi"))
  }

  /**
   * Rattache un visuel DÉJÀ en ligne à partir de son URL.
   *
   * Route distincte de l'upload : rien n'est envoyé à Cloudinary ici. Le cas
   * d'usage qui l'a motivée est la correction d'une illustration TCGdex morte
   * ou fausse sur une carte précise — repasser par « Poser un visuel »
   * obligerait à télécharger l'image puis à la ré-héberger pour corriger une
   * faute de l'API.
   *
   * Le serveur seul fait autorité : c'est lui qui valide le domaine ET sonde le
   * lien. On ne double pas la vérification ici, sans quoi les deux règles
   * finiraient par diverger.
   */
  async function poserVisuelParUrl() {
    const valeur = urlCollee.trim()
    if (!valeur) { setMsg('Collez une URL.'); return }
    setUrlEnCours(true)
    try {
      const r = await fetch('/api/admin/catalogue/visuel-variante/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variante_id: variante.id, url: valeur }),
      })
      const j = await r.json()
      if (!r.ok) { setMsg(j.error ?? 'Échec'); return }
      setUrlCollee('')
      setMsg(
        j.avertissement ??
          (j.source === 'tcgdex'
            ? "Visuel TCGdex corrigé — posé à la main, l'import ne l'écrasera pas."
            : "Visuel posé sur cette variante — il survivra à l'import."),
      )
      // Rafraîchit la vignette et l'état « visuel manuel » depuis le serveur.
      demarrer(() => { router.refresh() })
    } finally {
      setUrlEnCours(false)
    }
  }


  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        {variante.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- vignette d'éditeur interne
          <img src={variante.image_url} alt="" style={{ width: 74, aspectRatio: '2.5/3.5', objectFit: 'cover' }} />
        ) : (
          <span style={{ width: 74, aspectRatio: '2.5/3.5', background: '#111119', display: 'block' }} />
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12 }}>{carte.name_fr}</div>
          <div className="gk-dim" style={{ fontSize: 10 }}>{codeSet} · {carte.number}</div>
          <div className="gk-tag" data-etat="logo" style={{ marginTop: 4 }}>{type?.label ?? '—'}</div>
          {stock > 0 && <div className="gk-verrou" style={{ fontSize: 10 }}>{stock} en stock</div>}
        </div>
      </div>

      {/* ── Ce qui appartient à CETTE variante ────────────────────────────── */}
      <div className="gk-label" style={{ marginBottom: 6 }}>Cette variante</div>

      <div className="gk-field">
        <span className="gk-label">Visuel</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          <span className="gk-tag" data-etat={vis === 'manuel' ? 'logo' : vis === 'api' ? 'symbole' : 'aucun'}>
            {vis === 'manuel' ? 'visuel manuel' : vis === 'api' ? 'visuel api' : 'sans visuel'}
          </span>
          <label className="gk-btn" style={{ cursor: 'pointer' }}>
            Poser un visuel
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) poserVisuel(f) }} />
          </label>
        </div>

        {/* Le champ URL vient EN PLUS du téléversement, pas à sa place : les
            deux usages sont légitimes. On téléverse un visuel qu'on possède ;
            on colle une URL quand l'image est déjà en ligne — typiquement pour
            remplacer une illustration TCGdex morte par la bonne, sans avoir à
            la télécharger puis à la ré-héberger. */}
        {/* Placeholder court volontairement : la colonne fait 340 px, un texte
            plus long était coupé en plein mot. Les hôtes acceptés sont dits par
            l'aide juste en dessous, où il y a la place de les lire. */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            className="gk-input"
            type="url"
            inputMode="url"
            placeholder="Coller une URL"
            value={urlCollee}
            onChange={e => setUrlCollee(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); poserVisuelParUrl() } }}
            style={{ flex: 1, minWidth: 0 }}
            aria-label="URL du visuel à poser sur cette variante"
          />
          <button
            type="button"
            className="gk-btn"
            disabled={urlEnCours || !urlCollee.trim()}
            onClick={poserVisuelParUrl}
          >
            {urlEnCours ? 'Vérification…' : 'Poser'}
          </button>
        </div>

        <span className="gk-aide">
          {vis === 'manuel'
            ? "Posé à la main : l'import ne l'écrase pas."
            : vis === 'api'
              ? 'Fourni par TCGdex : un import peut le remplacer. En poser un à la main le fige.'
              : "Aucun visuel. La fiche publique retombe sur l'illustration de la carte, avec le label de la variante en surimpression."}
        </span>
        <span className="gk-aide">
          {/* Dit pourquoi la liste est courte, plutôt que de laisser croire à
              une restriction arbitraire : ce sont les deux seuls hôtes que
              `next.config.ts` déclare, donc les deux seuls que le site sait
              afficher. Une URL d'ailleurs planterait au panier, loin d'ici. */}
          Le lien est sondé avant d&apos;être accepté. Seuls TCGdex et le Cloudinary
          du site sont servis par les pages publiques.
        </span>
      </div>

      <div className="gk-field">
        <span className="gk-label">Suppression</span>
        {aDeplacer ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="gk-aide" style={{ width: '100%' }}>
              Déplacer les {stock} exemplaire(s) vers :
            </span>
            {soeurs.map(x => (
              <button key={x.id} type="button" className="gk-btn" data-primaire
                onClick={() => demarrer(async () => {
                  const r = await supprimerVariante(variante.id, x.id)
                  setMsg(r.ok ? 'Exemplaires déplacés, variante supprimée.' : (r.erreur ?? 'Échec'))
                  setADeplacer(false)
                })}>
                {seul(x.pokemon_variant_types)?.label}
              </button>
            ))}
            <button type="button" className="gk-btn" onClick={() => setADeplacer(false)}>Annuler</button>
          </div>
        ) : (
          <button type="button" className="gk-btn" data-danger style={{ alignSelf: 'flex-start' }}
            onClick={() => demarrer(async () => {
              const r = await supprimerVariante(variante.id)
              if (r.ok) { setMsg('Variante supprimée.'); return }
              // La base refuse tant qu'un exemplaire porte du stock : on propose
              // alors la cible plutôt que de forcer.
              setMsg(r.erreur ?? 'Échec')
              if ((r.erreur ?? '').includes('exemplaire')) setADeplacer(true)
            })}>
            Supprimer cette variante
          </button>
        )}
      </div>

      {/* ── Les sœurs, atteignables sans repasser par la grille ───────────── */}
      {soeurs.length > 0 && (
        <div className="gk-field">
          <span className="gk-label">Autres variantes de cette carte</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {soeurs.map(x => (
              <button key={x.id} type="button" className="gk-btn" onClick={() => onSelectionner(x.id)}>
                {seul(x.pokemon_variant_types)?.label}
                {!x.image_url && ' ·sans visuel'}
              </button>
            ))}
          </div>
        </div>
      )}

      {ajoutables.length > 0 && (
        <div className="gk-field">
          <span className="gk-label">Ajouter une variante</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ajoutables.map(t => (
              <button key={t.id} type="button" className="gk-btn"
                onClick={() => demarrer(async () => {
                  const r = await ajouterVariante(carte.id, t.id)
                  setMsg(r.ok ? `Variante ${t.label} ajoutée.` : (r.erreur ?? 'Échec'))
                })}>
                + {t.label}
              </button>
            ))}
          </div>
          <span className="gk-aide">
            Seuls les types autorisés par {codeSet} sont proposés.
          </span>
        </div>
      )}

      {/* ── Ce qui appartient à la CARTE, donc à toutes ses variantes ─────── */}
      <div className="gk-label" style={{ margin: '18px 0 4px' }}>
        La carte entière
      </div>
      <p className="gk-aide" style={{ marginBottom: 8 }}>
        Ces champs appartiennent à la CARTE. Les corriger depuis
        {' '}« {type?.label ?? 'cette variante'} » les change aussi sur
        {' '}{fratrie.length > 1 ? `ses ${fratrie.length - 1} autre(s) variante(s)` : 'toutes ses variantes'}.
      </p>

      {champCarte('number', 'Numéro', carte.number)}
      {champCarte('name_fr', 'Nom', carte.name_fr)}
      {champCarte('rarity', 'Rareté', carte.rarity)}
      {champCarte('card_type', 'Type', carte.card_type)}
      {champCarte('category', 'Catégorie', carte.category)}
      {champCarte('attribute', 'Attribut', carte.attribute)}

      {msg && <p className="gk-aide" style={{ marginTop: 10 }}>{msg}</p>}
    </>
  )
}
