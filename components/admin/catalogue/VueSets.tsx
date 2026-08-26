'use client'

import Link from 'next/link'
import { useMemo, useState, useSyncExternalStore } from 'react'
import { corrigerSet, relacherChampSet, definirTypesSet, creerTypeVariante } from '@/app/admin/catalogue/actions'
import {
  sAbonnerPreferences,
  lireModeClient,
  modeServeur,
  definirMode,
  lireBlocsRepliesClient,
  blocsRepliesServeur,
  basculerBloc,
  definirTousLesBlocs,
  type ModeCatalogue,
} from '@/lib/admin/preferences-catalogue'
import { grouperEnBlocs, periode, comparerParParution } from '@/lib/admin/blocs-catalogue'
import type { SetNettoyage, TypeVariante } from './types'
import { etatDeLEcart } from './types'

/**
 * Vue SETS — patron PonéglypheAPI : table dense, jauge BASE / ATTENDU, compteur
 * de verrous en ligne, panneau latéral d'édition.
 *
 * LA COLONNE ÉTAT EST LE CŒUR DE L'OUTIL. Elle sort 19 sets anormaux sur 185
 * sans rien chercher. Mais elle ne le fait que si elle distingue deux natures
 * d'écart :
 *   · NÉGATIF — des cartes manquent réellement. 12 sets, 346 cartes.
 *   · POSITIF — `card_count` compte le set officiel SANS ses sous-blocs
 *     (Galeries TG, Galerie GG, Coffre Étincelant, Collection Classique).
 *     7 sets, 337 cartes. Ce n'est pas une anomalie.
 * Peindre les deux en rouge ferait crier au loup sur sept sets sains, et on
 * cesserait de lire la colonne.
 */

/**
 * Deux gabarits de colonnes.
 *
 * POINT 3 — VOIE RETENUE : la table se CONTRACTE au lieu d'être recouverte.
 * Panneau ouvert, on abandonne NOM puis SÉRIE, jamais BASE/ATTENDU ni ÉTAT :
 * ce sont les deux colonnes qui justifient l'écran, et le CODE qui reste suffit
 * à identifier la ligne. L'autre voie — affiner le panneau — aurait rendu
 * illisibles les textes d'aide, qui sont précisément ce qui évite les fausses
 * manœuvres.
 */
const COLS_LARGE = '78px 46px 1fr 150px 88px 118px 120px'
const COLS_ETROIT = '78px 46px 88px 118px 120px'
/**
 * Mode « par bloc » : la colonne SÉRIE disparaît, et ce n'est pas une économie
 * de place — c'est que l'en-tête de bloc la porte déjà, trois lignes au-dessus.
 * La répéter sur chacune de ses 25 lignes n'ajoute rien et brouille la lecture
 * de ce qui, lui, change d'une ligne à l'autre. La largeur libérée revient au
 * NOM, la colonne qu'on lit vraiment.
 */
const COLS_BLOC = '78px 46px 1fr 88px 118px 120px'

type Filtre = 'tous' | 'manquants' | 'sous-blocs' | 'complets' | 'entames' | 'sans-logo'

const FILTRES: { v: Filtre; label: string }[] = [
  { v: 'tous', label: 'Tous' },
  { v: 'manquants', label: 'Cartes manquantes' },
  { v: 'sous-blocs', label: 'Sous-blocs' },
  { v: 'complets', label: 'Complets' },
  { v: 'entames', label: 'Entamés' },
  { v: 'sans-logo', label: 'Sans logo' },
]

/**
 * Ce dont un set dispose comme visuel. 121 sets ont un logo, 32 n'ont qu'un
 * symbole, 32 n'ont rien.
 *
 * L'indicateur sert à savoir QUOI aller chercher, pas à alarmer : les 17 sets
 * qui portent du stock ont tous leur logo. On reste donc en glyphe étroit, sans
 * rouge — le rouge est réservé aux cartes réellement manquantes.
 */
type EtatVisuel = 'logo' | 'symbole' | 'rien'

const visuelDuSet = (s: SetNettoyage): EtatVisuel =>
  s.image_url ? 'logo' : s.symbol_url ? 'symbole' : 'rien'

const GLYPHE: Record<EtatVisuel, string> = { logo: '◆', symbole: '◇', rien: '·' }
const TITRE_VISUEL: Record<EtatVisuel, string> = {
  logo: 'Logo présent',
  symbole: 'Symbole seul — pas de logo',
  rien: 'Ni logo ni symbole',
}

const fr = (n: number) => n.toLocaleString('fr-FR')

export default function VueSets({
  sets,
  types,
  qInitial = '',
}: {
  sets: SetNettoyage[]
  types: TypeVariante[]
  /** Terme venu du champ de la topbar (`/admin/catalogue?q=…`). */
  qInitial?: string
}) {
  const [filtre, setFiltre] = useState<Filtre>('tous')
  const [q, setQ] = useState(qInitial)
  const [ouvert, setOuvert] = useState<SetNettoyage | null>(null)

  // Mode d'affichage et blocs repliés : préférences persistées, servies au
  // rendu serveur par leur défaut (voir `lib/admin/preferences-catalogue`).
  const mode = useSyncExternalStore(sAbonnerPreferences, lireModeClient, modeServeur)
  const replies = useSyncExternalStore(sAbonnerPreferences, lireBlocsRepliesClient, blocsRepliesServeur)

  // Panneau ouvert : la table se contracte. ÉTAT reste toujours visible.
  const contracte = ouvert !== null
  const montrerSerie = !contracte && mode === 'chrono'
  const cols = contracte ? COLS_ETROIT : montrerSerie ? COLS_LARGE : COLS_BLOC

  const compte = useMemo(() => ({
    tous: sets.length,
    manquants: sets.filter(s => etatDeLEcart(s) === 'manquant').length,
    'sous-blocs': sets.filter(s => etatDeLEcart(s) === 'sous-blocs').length,
    complets: sets.filter(s => etatDeLEcart(s) === 'complet').length,
    entames: sets.filter(s => s.cartes_corrigees > 0).length,
    'sans-logo': sets.filter(s => visuelDuSet(s) !== 'logo').length,
  }), [sets])

  const lignes = useMemo(() => {
    const query = q.trim().toLowerCase()
    return sets
      .filter(s => {
        if (filtre === 'entames') return s.cartes_corrigees > 0
        if (filtre === 'sans-logo') return visuelDuSet(s) !== 'logo'
        if (filtre === 'tous') return true
        return etatDeLEcart(s) === filtre
      })
      .filter(s => !query || s.name_fr.toLowerCase().includes(query) || s.code.toLowerCase().includes(query))
      // Chronologique croissant — l'ordre de travail annoncé, et la base des
      // DEUX modes : c'est lui qui donne aussi l'ordre interne des blocs.
      .sort(comparerParParution)
  }, [sets, filtre, q])

  const blocs = useMemo(() => grouperEnBlocs(lignes), [lignes])
  const tousReplies = blocs.length > 0 && blocs.every(b => replies.has(b.nom))

  return (
    <>
      <div className="gk-facettes">
        <div className="gk-facette-ligne">
          <span className="gk-facette-label">État</span>
          {FILTRES.map(f => (
            <button
              key={f.v}
              type="button"
              className="gk-facette"
              data-active={filtre === f.v}
              onClick={() => setFiltre(f.v)}
            >
              {f.label}<b>{compte[f.v]}</b>
            </button>
          ))}
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="CODE OU NOM"
            aria-label="Rechercher un set"
            className="gk-input"
            style={{ width: 160, marginLeft: 'auto' }}
          />
        </div>

        {/* Les deux modes COEXISTENT : le groupement par bloc est le défaut,
            le chronologique plat reste l'ordre de travail, à un clic. */}
        <div className="gk-facette-ligne">
          <span className="gk-facette-label">Affichage</span>
          {([
            { v: 'blocs', label: 'Par bloc', n: blocs.length },
            { v: 'chrono', label: 'Chronologique', n: lignes.length },
          ] as { v: ModeCatalogue; label: string; n: number }[]).map(m => (
            <button
              key={m.v}
              type="button"
              className="gk-facette"
              data-active={mode === m.v}
              onClick={() => definirMode(m.v)}
            >
              {m.label}<b>{fr(m.n)}</b>
            </button>
          ))}
          {mode === 'blocs' && blocs.length > 0 && (
            <button
              type="button"
              className="gk-facette"
              style={{ marginLeft: 'auto' }}
              onClick={() => definirTousLesBlocs(blocs.map(b => b.nom), !tousReplies)}
            >
              {tousReplies ? 'Tout déplier' : 'Tout replier'}
            </button>
          )}
        </div>
      </div>

      <div className="gk-heads" style={{ gridTemplateColumns: cols }}>
        <span className="gk-label">Set</span>
        <span className="gk-label">Visuel</span>
        {!contracte && <span className="gk-label">Nom</span>}
        {montrerSerie && <span className="gk-label">Série</span>}
        <span className="gk-label">Sortie</span>
        <span className="gk-label">Base / attendu</span>
        <span className="gk-label">État</span>
      </div>

      {/* Aucun conteneur défilant ici : le défilement est porté par `.gk-main`,
          la colonne de la coquille — et non par le document, qui ne défile pas
          sous `.gk { overflow: hidden }`. La molette agit donc depuis n importe
          quel point de la page, à la condition que Lenis reste exclu de /admin
          (voir `PREFIXE_ADMIN`). */}
      <div>
        {lignes.length === 0 && (
          <div className="gk-row" style={{ gridTemplateColumns: '1fr', cursor: 'default' }}>
            <span className="gk-dim">Aucun set ne correspond.</span>
          </div>
        )}

        {mode === 'chrono'
          ? lignes.map(s => (
              <Ligne
                key={s.set_id}
                s={s}
                cols={cols}
                contracte={contracte}
                montrerSerie={montrerSerie}
                actif={ouvert?.set_id === s.set_id}
                onOuvrir={() => setOuvert(s)}
              />
            ))
          : blocs.map(b => {
              const replie = replies.has(b.nom)
              return (
                <section key={b.nom}>
                  <button
                    type="button"
                    className="gk-bloc"
                    aria-expanded={!replie}
                    onClick={() => basculerBloc(b.nom)}
                  >
                    <span className="gk-bloc-chevron" aria-hidden>{replie ? '▸' : '▾'}</span>
                    <span className="gk-bloc-nom">{b.nom}</span>
                    <span className="gk-bloc-periode">{periode(b)}</span>
                    <span className="gk-bloc-compte">{b.sets.length} set{b.sets.length > 1 ? 's' : ''}</span>
                    {/* Avancement du nettoyage : une quantité vérifiable de
                        cartes verrouillées, pas un pourcentage — c'est le même
                        compteur que le 🔒 des lignes, sommé sur le bloc. */}
                    <span className="gk-bloc-avancement">
                      {fr(b.corrigees)} / {fr(b.cartes)} 🔒
                    </span>
                    {b.aCompleter > 0 && (
                      <span className="gk-ecart" data-etat="manquant">
                        {b.aCompleter} à compléter
                      </span>
                    )}
                  </button>

                  {!replie && b.sets.map(s => (
                    <Ligne
                      key={s.set_id}
                      s={s}
                      cols={cols}
                      contracte={contracte}
                      montrerSerie={montrerSerie}
                      actif={ouvert?.set_id === s.set_id}
                      onOuvrir={() => setOuvert(s)}
                    />
                  ))}
                </section>
              )
            })}
      </div>

      {ouvert && <PanneauSet set={ouvert} types={types} onFermer={() => setOuvert(null)} />}
    </>
  )
}

/**
 * Une ligne de set. Extraite parce que les DEUX modes d'affichage la rendent à
 * l'identique — la seule chose qui change entre « par bloc » et
 * « chronologique », c'est ce qui les regroupe.
 */
function Ligne({
  s, cols, contracte, montrerSerie, actif, onOuvrir,
}: {
  s: SetNettoyage
  cols: string
  contracte: boolean
  /** Faux en mode « par bloc » : l'en-tête de bloc porte déjà la série. */
  montrerSerie: boolean
  actif: boolean
  onOuvrir: () => void
}) {
  const etat = etatDeLEcart(s)
  const ecart = s.cartes - (s.card_count ?? s.cartes)
  const vis = visuelDuSet(s)

  return (
    <div
      className="gk-row"
      style={{ gridTemplateColumns: cols }}
      data-active={actif}
      onClick={onOuvrir}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onOuvrir() }}
    >
      <span>{s.code}</span>
      <span className="gk-tag" data-etat={vis} title={TITRE_VISUEL[vis]}>
        {GLYPHE[vis]}
      </span>
      {!contracte && (
        <span>
          {s.name_fr}
          {/* Compteur de verrous : une quantité vérifiable, meilleure
              qu'un pourcentage pour dire où en est le nettoyage. */}
          {s.cartes_corrigees > 0 && (
            <span className="gk-verrou" style={{ marginLeft: 7 }}>{s.cartes_corrigees}🔒</span>
          )}
        </span>
      )}
      {montrerSerie && <span className="gk-dim">{s.serie_name ?? '—'}</span>}
      <span className="gk-dim">{s.release_date ?? '—'}</span>
      <span className="gk-dim">{s.cartes} / {s.card_count ?? '—'}</span>
      <span className="gk-ecart" data-etat={etat}>
        {etat === 'complet' && 'COMPLET'}
        {etat === 'manquant' && `${ecart}`}
        {etat === 'sous-blocs' && `+${ecart} sous-blocs`}
      </span>
    </div>
  )
}

/**
 * Panneau latéral d'édition. La liste reste en place derrière : la position
 * n'est jamais perdue, c'est la première exigence de l'outil.
 *
 * Chaque champ porte un texte d'aide décrivant sa CONSÉQUENCE, pas sa
 * définition — c'est ce qui évite les fausses manœuvres.
 */
function PanneauSet({
  set: s, types, onFermer,
}: { set: SetNettoyage; types: TypeVariante[]; onFermer: () => void }) {
  const [brouillon, setBrouillon] = useState<Record<string, string>>({
    code: s.code,
    name_fr: s.name_fr,
    serie_name: s.serie_name ?? '',
    release_date: s.release_date ?? '',
    card_count: s.card_count === null ? '' : String(s.card_count),
  })
  const [choisis, setChoisis] = useState<string[] | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [filtreType, setFiltreType] = useState('')
  const [nouveauType, setNouveauType] = useState('')

  const typesFiltres = useMemo(() => {
    const q = filtreType.trim().toLowerCase()
    if (!q) return types
    return types.filter(t => t.label.toLowerCase().includes(q) || t.code.toLowerCase().includes(q))
  }, [types, filtreType])

  const verrouille = (c: string) => (s.locked_fields ?? []).includes(c)

  async function chargerTypes() {
    const r = await fetch(`/api/admin/catalogue/types-set?setId=${s.set_id}`)
    setChoisis(r.ok ? ((await r.json()).typeIds ?? []) : [])
  }

  async function enregistrer() {
    setOccupe(true); setMsg(null)
    for (const [champ, valeur] of Object.entries(brouillon)) {
      const initial =
        champ === 'card_count' ? (s.card_count === null ? '' : String(s.card_count))
        : champ === 'serie_name' ? (s.serie_name ?? '')
        : champ === 'release_date' ? (s.release_date ?? '')
        : (s as unknown as Record<string, string>)[champ] ?? ''
      if (valeur === initial) continue
      const r = await corrigerSet(s.set_id, champ, valeur)
      if (!r.ok) { setMsg(r.erreur ?? 'Échec'); setOccupe(false); return }
    }
    setMsg('Enregistré.')
    setOccupe(false)
  }

  const champ = (nom: string, label: string, aide: string, type = 'text') => (
    <label className="gk-field" key={nom}>
      <span className="gk-label">
        {label}
        {verrouille(nom) && <span className="gk-verrou" style={{ marginLeft: 6 }}>🔒</span>}
      </span>
      <input
        className="gk-input"
        type={type}
        data-verrouille={verrouille(nom)}
        value={brouillon[nom] ?? ''}
        onChange={e => setBrouillon(b => ({ ...b, [nom]: e.target.value }))}
        onKeyDown={e => { if (e.key === 'Enter') enregistrer() }}
      />
      <span className="gk-aide">{aide}</span>
      {verrouille(nom) && (
        <button
          type="button"
          className="gk-btn"
          style={{ alignSelf: 'flex-start', marginTop: 3 }}
          onClick={async () => {
            const r = await relacherChampSet(s.set_id, nom)
            setMsg(r.ok ? `${label} relâché — l'API reprendra la main au prochain import.` : (r.erreur ?? 'Échec'))
          }}
        >
          Relâcher vers l&apos;API
        </button>
      )}
    </label>
  )

  return (
    <aside className="gk-tiroir" aria-label={`Édition du set ${s.code}`}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 13, letterSpacing: '0.08em' }}>{s.code}</span>
        <button type="button" className="gk-btn" style={{ marginLeft: 'auto' }} onClick={onFermer}>
          Fermer
        </button>
      </div>

      {/* CONTENU RÉEL : ce que le set contient vraiment, avant toute édition. */}
      <div style={{ border: '1px solid var(--gk-line)', padding: 10, marginBottom: 16 }}>
        <div className="gk-label" style={{ marginBottom: 6 }}>Contenu réel</div>
        <div style={{ fontSize: 11, lineHeight: 1.7 }}>
          <div>{s.cartes} carte(s) rattachée(s)</div>
          <div>{s.variantes} variante(s), dont {s.variantes_sans_visuel} sans visuel</div>
          <div>
            {s.cartes_corrigees} carte(s) verrouillée(s)
            {s.cartes_corrigees > 0 && <span className="gk-verrou"> 🔒</span>}
          </div>
          <div className="gk-dim">
            {etatDeLEcart(s) === 'sous-blocs'
              ? "L'écart positif vient des sous-blocs : le nombre attendu ne les compte pas."
              : etatDeLEcart(s) === 'manquant'
                ? `${(s.card_count ?? 0) - s.cartes} carte(s) manquante(s) à l'import.`
                : 'Base et attendu coïncident.'}
          </div>
        </div>
      </div>

      {champ('code', 'Code', "Identifiant du set dans les URL de catalogue et les références « SV10 197 ». Le changer casse les liens déjà partagés.")}
      {champ('name_fr', 'Nom', 'Affiché sur la fiche du set et dans la recherche.')}
      {champ('serie_name', 'Série', "Regroupe les sets dans les filtres du catalogue public et le tri de cet écran.")}
      {champ('release_date', 'Sortie', "Sert l'ordre chronologique de travail et le hero « nouveautés » de la home.", 'date')}
      {champ('card_count', 'Nombre attendu', "Nombre officiel de cartes du set. C'est lui qui alimente la colonne ÉTAT : le corriger fait disparaître ou apparaître un écart.", 'number')}

      <div style={{ marginTop: 18 }}>
        <div className="gk-label" style={{ marginBottom: 4 }}>Variantes autorisées</div>
        <p className="gk-aide" style={{ marginBottom: 8 }}>
          Aucune cochée = les {types.length}{' '}types globaux restent permis. C&apos;est ici
          qu&apos;on empêche une Masterball sur un set de 1999. Une restriction qui
          exclurait une variante déjà saisie est refusée.
        </p>
        <p className="gk-aide" style={{ marginBottom: 8 }}>
          {/* Le point qui décide de l'utilisabilité : avec 39 types, l'éditeur
              ne doit jamais en proposer 39 sur un set donné. Déclarer la liste
              ici est ce qui ramène le menu d'ajout à cinq ou six entrées. */}
          Déclarer la liste d&apos;un set, c&apos;est aussi ce qui rend l&apos;éditeur de
          variantes utilisable : il ne proposera plus que ces types-là.
        </p>

        {choisis === null ? (
          <button type="button" className="gk-btn" onClick={chargerTypes}>Charger</button>
        ) : (
          <>
            {/* Filtre par libellé : 39 pastilles se parcourent mal à l'œil, et
                on sait toujours ce qu'on cherche — « tampon », « staff », « laic ». */}
            <input
              value={filtreType}
              onChange={e => setFiltreType(e.target.value)}
              placeholder="FILTRER LES TYPES"
              aria-label="Filtrer les types de variante"
              className="gk-input"
              style={{ width: '100%', marginBottom: 8 }}
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {typesFiltres.map(t => {
                const actif = choisis.includes(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    className="gk-btn"
                    data-primaire={actif}
                    aria-pressed={actif}
                    title={t.source === 'manuel'
                      ? `${t.code} — relevé à la main, aucun import ne le recréera`
                      : `${t.code} — décrit par l'API`}
                    onClick={() => setChoisis(c => (c ?? []).includes(t.id) ? (c ?? []).filter(x => x !== t.id) : [...(c ?? []), t.id])}
                  >
                    {t.label}
                    {/* Le point marque les types relevés à la main : ce sont
                        ceux qu'aucun réimport ne rétablira. */}
                    {t.source === 'manuel' && <span className="gk-verrou" style={{ marginLeft: 5 }}>·</span>}
                  </button>
                )
              })}
              {typesFiltres.length === 0 && (
                <span className="gk-aide">Aucun type ne correspond à « {filtreType} ».</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="gk-btn"
                data-primaire
                onClick={async () => {
                  const r = await definirTypesSet(s.set_id, choisis)
                  setMsg(r.ok ? 'Restriction enregistrée.' : (r.erreur ?? 'Échec'))
                }}
              >
                Appliquer
              </button>
              <button
                type="button"
                className="gk-btn"
                onClick={async () => {
                  setChoisis([])
                  const r = await definirTypesSet(s.set_id, [])
                  setMsg(r.ok ? 'Restriction levée.' : (r.erreur ?? 'Échec'))
                }}
              >
                Lever
              </button>
            </div>

            {/* ── Ajouter un type à la nomenclature ─────────────────────────
                Ici, et pas dans un écran de réglages à part : le moment où l'on
                s'aperçoit qu'un libellé manque, c'est celui où on coche la liste
                d'un set en tenant sa checklist. Aller le créer ailleurs ferait
                perdre la place, et donc la session de nettoyage. */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--gk-line)' }}>
              <div className="gk-label" style={{ marginBottom: 4 }}>Type absent de la liste ?</div>
              <p className="gk-aide" style={{ marginBottom: 8 }}>
                Le créer ici l&apos;ajoute à la nomenclature GLOBALE, pas seulement à ce
                set — c&apos;est le même type qu&apos;on retrouvera sur les autres. Reprendre
                le libellé exact de la checklist ; le code technique en est déduit.
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={nouveauType}
                  onChange={e => setNouveauType(e.target.value)}
                  placeholder="Tampon (…)"
                  aria-label="Libellé du nouveau type de variante"
                  className="gk-input"
                  style={{ flex: 1, minWidth: 0 }}
                />
                <button
                  type="button"
                  className="gk-btn"
                  disabled={occupe || !nouveauType.trim()}
                  onClick={async () => {
                    setOccupe(true)
                    const r = await creerTypeVariante(nouveauType)
                    setOccupe(false)
                    if (r.ok) {
                      setNouveauType('')
                      // La liste `types` vient du serveur : `revalidatePath` dans
                      // l'action la rafraîchit, le nouveau type apparaît parmi les
                      // pastilles sans rechargement ni perte de position.
                      setMsg(`Type « ${nouveauType.trim()} » ajouté à la nomenclature.`)
                    } else {
                      setMsg(r.erreur ?? 'Échec')
                    }
                  }}
                >
                  Créer
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 22, paddingTop: 12, borderTop: '1px solid var(--gk-line)' }}>
        <button type="button" className="gk-btn" data-primaire disabled={occupe} onClick={enregistrer}>
          {occupe ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <Link href={`/admin/catalogue/editeur?set=${s.set_id}`} className="gk-btn" style={{ textDecoration: 'none' }}>
          Ouvrir l&apos;éditeur
        </Link>
        {msg && <span className="gk-aide">{msg}</span>}
      </div>
    </aside>
  )
}
