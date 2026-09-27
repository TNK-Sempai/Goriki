'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pagination } from '@/components/ui/Pagination'
import {
  corrigerCarte, relacherChampCarte,
  supprimerVariante,
  ajouterVarianteAxes, modifierAxesVariante,
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
  source: string
  /** Axe 1 — obligatoire : quelle impression a été mise en vente. */
  tirage_id: string
  /** Axe 2 — NULL = finition NON DÉTERMINÉE, distinct de « non-holo ». */
  finition_id: string | null
  /** Axe 3 — ce qui a été apposé après impression. */
  tampon_id: string | null
  /**
   * HÉRITAGE. La jointure n'est plus `!inner` : depuis la migration 0045 une
   * variante créée à la main porte `variant_type_id = NULL` et aurait disparu
   * de l'écran — une ligne invisible qu'on aurait recréée en boucle.
   */
  pokemon_variant_types: TypeVariante | TypeVariante[] | null
  pokemon_listings: Exemplaire[] | null
}

/** Les trois tables de référence, servies par la page. */
export interface AxesVariantes {
  tirages: TypeVariante[]
  finitions: TypeVariante[]
  tampons: TypeVariante[]
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
  /** Nom de la variante sur les trois axes — voir `notation()`. */
  libelle: string
  /** Nombre de variantes de la même carte — sert au rattachement visuel. */
  fratrie: number
}

const seul = <T,>(v: T | T[] | null | undefined): T | undefined =>
  Array.isArray(v) ? v[0] : (v ?? undefined)

/**
 * Nom lisible d'une variante, construit sur les TROIS AXES.
 *
 * ⚠️ NE PAS revenir à `pokemon_variant_types.label`. Depuis 0045 une variante
 * créée à la main porte `variant_type_id = NULL` : la nommer par ce champ
 * rendait une étiquette VIDE. La variante existait bien en base, mais l'écran
 * la montrait anonyme — on la recréait en boucle en croyant avoir échoué.
 * L'ancien label ne sert plus que de dernier recours, pour les lignes d'import
 * qui n'ont pas encore été reprises.
 *
 * `finition_id` NULL n'est PAS une lacune : c'est la finition normale de la
 * rareté de la carte, et on ne l'écrit pas. « Normale · — » ferait passer pour
 * incomplet ce qui est renseigné.
 */
function notation(v: VarianteAdmin, axes: AxesVariantes): string {
  const nom = (liste: TypeVariante[], id: string | null) =>
    id ? liste.find(x => x.id === id)?.label : undefined
  const parts = [
    nom(axes.tirages, v.tirage_id),
    nom(axes.finitions, v.finition_id),
    nom(axes.tampons, v.tampon_id),
  ].filter(Boolean)
  if (parts.length > 0) return parts.join(' · ')
  return seul(v.pokemon_variant_types)?.label ?? 'variante sans axe'
}

/** Rang de tri d'une variante : l'ordre des tirages, pas celui des vieux types. */
const rangTirage = (v: VarianteAdmin, axes: AxesVariantes) =>
  axes.tirages.find(x => x.id === v.tirage_id)?.sort_order ?? 0
const variantesDe = (c: CarteAdmin) => c.pokemon_card_variants ?? []

type Tri = 'collection' | 'az' | 'za'
type EtatVisuel = 'api' | 'manuel' | 'aucun'

const etatVisuel = (v: VarianteAdmin): EtatVisuel =>
  v.image_manuelle ? 'manuel' : v.image_url ? 'api' : 'aucun'

export default function VueEditeur({
  sets, setCourant, cartes, axes, checklist,
}: {
  sets: SetNettoyage[]
  setCourant: SetNettoyage | null
  cartes: CarteAdmin[]
  axes: AxesVariantes
  /** Paires [numéro de carte, cases attendues] — sérialisable, contrairement à une Map. */
  checklist: [string, number][]
}) {
  // Reconstituée côté client : une Map ne traverse pas la frontière serveur.
  const casesAttendues = useMemo(() => new Map(checklist), [checklist])
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
          .sort((a, b) => rangTirage(a, axes) - rangTirage(b, axes))
        return vs.map(v => ({
          variante: v,
          carte: c,
          libelle: notation(v, axes),
          fratrie: vs.length,
        }))
      }),
    [cartes, axes],
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
      variantes: compter(l => l.libelle),
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
      .filter(l => !fVariante || l.libelle === fVariante)
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
                  {l.libelle}{vis === 'aucun' && ' · sans visuel'}
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
            axes={axes}
            casesAttendues={casesAttendues}
            ligne={ligneActive}
            fratrie={variantesDe(ligneActive.carte)}
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
  ligne, fratrie, codeSet, axes, casesAttendues, onSelectionner,
}: {
  ligne: Ligne
  fratrie: VarianteAdmin[]
  codeSet: string
  axes: AxesVariantes
  /** Numéro de carte → cases de la checklist. Vide si le set n'en a pas. */
  casesAttendues: Map<string, number>
  onSelectionner: (id: string) => void
}) {
  const { carte, variante, libelle } = ligne
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
  const vis = etatVisuel(variante)

  /**
   * Axes de la variante À CRÉER. Trois états distincts de ceux de la variante
   * affichée : saisir une création ne doit rien changer à la ligne ouverte.
   */
  const [nTirage, setNTirage] = useState('')
  const [nFinition, setNFinition] = useState('')
  const [nTampon, setNTampon] = useState('')

  const apercuNouvelle = notation(
    { ...variante, tirage_id: nTirage, finition_id: nFinition || null, tampon_id: nTampon || null },
    axes,
  )
  /**
   * Doublon détecté AVANT l'appel, pour désactiver le bouton plutôt que de
   * laisser partir une écriture vouée au refus. La comparaison porte sur les
   * trois axes — la clé d'unicité réelle — et non sur `variant_type_id`, qui est
   * NULL sur toute variante créée à la main et rendrait le test toujours vrai.
   */
  const dejaLa = !!nTirage && fratrie.some(v =>
    v.tirage_id === nTirage
    && (v.finition_id ?? '') === nFinition
    && (v.tampon_id ?? '') === nTampon)

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

  /**
   * Enregistre les trois axes d'un coup.
   *
   * Une seule écriture, et non une par liste : les trois valeurs forment la clé
   * d'unicité `(carte, tirage, finition, tampon)`. Les enregistrer séparément
   * ferait passer la ligne par des états intermédiaires qui peuvent entrer en
   * collision avec une autre variante de la même carte — l'écriture serait
   * refusée pour une combinaison que l'utilisateur ne voulait pas.
   */
  async function enregistrerAxes(tirageId: string, finitionId: string | null, tamponId: string | null) {
    demarrer(async () => {
      const r = await modifierAxesVariante(variante.id, tirageId, finitionId, tamponId)
      setMsg(r.ok ? 'Axes enregistrés — la variante passe en « manuel ».' : (r.erreur ?? 'Échec'))
      if (r.ok) router.refresh()
    })
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
          <div className="gk-tag" data-etat="logo" style={{ marginTop: 4 }}>{libelle}</div>
          {stock > 0 && <div className="gk-verrou" style={{ fontSize: 10 }}>{stock} en stock</div>}
        </div>
      </div>

      {/* ── La checklist PokéCardex, en regard ───────────────────────────────
          C'est ce qui rend l'écran utilisable : la source dit combien de cases
          existent pour cette carte. L'utilisateur compare au lieu de deviner.

          On affiche l'ÉCART, pas seulement les deux nombres — c'est l'écart qui
          appelle une action. Et on distingue « pas de checklist » de « zéro
          case » : 176 sets sur 185 ont une référence, les autres n'en ont pas,
          et un tableau vide se lirait comme « rien à faire ». */}
      {(() => {
        const attendu = casesAttendues.get(carte.number.replace(/^0+(?=\d)/, ''))
        const presentes = fratrie.length
        if (casesAttendues.size === 0) {
          return (
            <div className="gk-field">
              <span className="gk-label">Checklist PokéCardex</span>
              <span className="gk-aide">
                Aucune checklist rattachée à ce set — rien à quoi comparer. Ce n&apos;est pas
                « zéro variante attendue ».
              </span>
            </div>
          )
        }
        if (attendu === undefined) {
          return (
            <div className="gk-field">
              <span className="gk-label">Checklist PokéCardex</span>
              <span className="gk-aide">
                Le set a une checklist, mais elle ne mentionne pas le numéro {carte.number}.
              </span>
            </div>
          )
        }
        const ecart = presentes - attendu
        return (
          <div className="gk-field">
            <span className="gk-label">Checklist PokéCardex</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 17, fontWeight: 500 }}>{presentes} / {attendu}</span>
              <span
                className="gk-tag"
                data-ton={ecart === 0 ? undefined : ecart < 0 ? 'rouge' : 'violet'}
              >
                {ecart === 0 ? 'conforme' : ecart < 0 ? `${-ecart} manquante(s)` : `${ecart} en trop`}
              </span>
            </div>
            <span className="gk-aide">
              Variantes en base face aux cases de la checklist. Un écart négatif signale une
              version jamais créée ; un écart positif, une version que la source ne connaît pas.
            </span>
          </div>
        )
      })()}

      {/* ── Ce qui appartient à CETTE variante ────────────────────────────── */}
      <div className="gk-label" style={{ marginBottom: 6 }}>Cette variante</div>

      {/* ── Les trois axes ──────────────────────────────────────────────────
          Une carte réelle se décrit par trois choses indépendantes. Un champ
          unique obligeait à choisir entre « 1ère édition » et « non-holo », donc
          à écrire quelque chose de faux — c'est le cas Mélodelfe #17.

          Le TIRAGE est obligatoire : c'est lui qui dit quelle impression a été
          mise en vente. Les deux autres ont une option « non déterminée » qui
          n'est PAS une valeur par défaut mais un aveu utile : « non-holo » et
          « Sans tampon » existent comme valeurs explicites, et les confondre
          avec l'absence de saisie ferait passer pour vérifié ce qui ne l'est
          pas. */}
      <div className="gk-field">
        <span className="gk-label">Tirage</span>
        <select
          className="gk-input"
          value={variante.tirage_id}
          disabled={enCours}
          onChange={e => enregistrerAxes(e.target.value, variante.finition_id, variante.tampon_id)}
        >
          {axes.tirages.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <span className="gk-aide">Quelle impression a été mise en vente. Obligatoire.</span>
      </div>

      <div className="gk-field">
        <span className="gk-label">Finition</span>
        <select
          className="gk-input"
          value={variante.finition_id ?? ''}
          disabled={enCours}
          onChange={e => enregistrerAxes(variante.tirage_id, e.target.value || null, variante.tampon_id)}
        >
          <option value="">— non déterminée —</option>
          {axes.finitions.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <span className="gk-aide">
          « Non déterminée » n&apos;est pas « non-holo » : cette dernière est une valeur
          explicite de la liste. 23 159 variantes reprises attendent encore leur finition.
        </span>
      </div>

      <div className="gk-field">
        <span className="gk-label">Tampon</span>
        <select
          className="gk-input"
          value={variante.tampon_id ?? ''}
          disabled={enCours}
          onChange={e => enregistrerAxes(variante.tirage_id, variante.finition_id, e.target.value || null)}
        >
          <option value="">— aucun renseigné —</option>
          {axes.tampons.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <span className="gk-aide">Ce qui a été apposé après impression. « Sans tampon » existe comme valeur explicite.</span>
      </div>

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
                {notation(x, axes)}
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
                {notation(x, axes)}
                {!x.image_url && ' ·sans visuel'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Créer une variante, sur les TROIS AXES ───────────────────────────
          Remplace une rangée de boutons « + Normale / + Reverse » qui appelait
          `admin_ajouter_variante` : cette RPC n'écrit que `variant_type_id`, et
          depuis que `tirage_id` est NOT NULL (0044) elle échouait à CHAQUE clic
          sur `23502 null value in column "tirage_id"`. La création était donc
          totalement morte, pendant que la suppression, elle, marchait.

          Une variante ne se DUPLIQUE pas depuis une autre : ce qui la distingue,
          ce sont ses trois axes. Les choisir explicitement est le geste — copier
          une ligne puis la corriger ferait passer par une combinaison
          intermédiaire qui peut déjà exister, et l'écriture serait refusée pour
          une variante que personne ne voulait créer. */}
      <div className="gk-field">
        <span className="gk-label">Créer une variante sur cette carte</span>

        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <label className="gk-field" style={{ gap: 3 }}>
            <span className="gk-aide">Tirage — obligatoire</span>
            <select className="gk-input" value={nTirage} disabled={enCours}
              onChange={e => { setNTirage(e.target.value); setMsg(null) }}>
              <option value="">— choisir —</option>
              {axes.tirages.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>

          <label className="gk-field" style={{ gap: 3 }}>
            <span className="gk-aide">Finition</span>
            <select className="gk-input" value={nFinition} disabled={enCours}
              onChange={e => { setNFinition(e.target.value); setMsg(null) }}>
              <option value="">— non déterminée —</option>
              {axes.finitions.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>

          <label className="gk-field" style={{ gap: 3 }}>
            <span className="gk-aide">Tampon</span>
            <select className="gk-input" value={nTampon} disabled={enCours}
              onChange={e => { setNTampon(e.target.value); setMsg(null) }}>
              <option value="">— aucun —</option>
              {axes.tampons.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginTop: 4 }}>
          <button type="button" className="gk-btn" data-primaire
            disabled={enCours || !nTirage || dejaLa}
            onClick={() => demarrer(async () => {
              const r = await ajouterVarianteAxes(carte.id, nTirage, nFinition || null, nTampon || null)
              if (r.ok) {
                setMsg(`Variante « ${apercuNouvelle} » créée sur ${carte.name_fr}.`)
                setNTirage(''); setNFinition(''); setNTampon('')
                // L'action revalide le cache serveur, mais ce composant tient sa
                // propre sélection : sans `refresh`, la nouvelle variante
                // n'apparaît ni dans la grille ni dans les sœurs.
                router.refresh()
              } else {
                setMsg(r.erreur ?? 'Échec')
              }
            })}>
            Créer cette variante
          </button>
          {nTirage && (
            <span className="gk-tag" data-etat={dejaLa ? 'aucun' : 'logo'}>{apercuNouvelle}</span>
          )}
        </div>

        <span className="gk-aide">
          {!nTirage
            ? 'Le tirage dit quelle impression a été mise en vente. Sans lui, la base refuse la ligne.'
            : dejaLa
              ? 'Cette carte porte déjà exactement cette combinaison — rien à créer.'
              : "Créée à la main, la variante est marquée « manuel » : aucun import ne l'écrasera."}
        </span>
        <span className="gk-aide">
          {/* Dit pourquoi la liste n'est plus restreinte par le set, plutôt que
              de laisser croire à un oubli : la restriction de {codeSet} est
              exprimée en types de l'ANCIEN modèle, où « Illimité » et
              « Normale » retombent tous deux sur `NORMAL`. La transposer aux
              trois axes demanderait une table de correspondance qui n'existe
              pas — l'inventer ici aurait interdit des tirages légitimes. */}
          Les {axes.tirages.length} tirages sont proposés : la restriction de {codeSet}{' '}
          est écrite dans l&apos;ancien vocabulaire et ne se transpose pas aux trois axes.
          C&apos;est la checklist, plus haut, qui dit combien de cases ce numéro attend.
        </span>
      </div>

      {/* ── Ce qui appartient à la CARTE, donc à toutes ses variantes ─────── */}
      <div className="gk-label" style={{ margin: '18px 0 4px' }}>
        La carte entière
      </div>
      <p className="gk-aide" style={{ marginBottom: 8 }}>
        Ces champs appartiennent à la CARTE. Les corriger depuis
        {' '}« {libelle} » les change aussi sur
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
