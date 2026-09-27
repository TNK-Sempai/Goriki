'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * File de réconciliation catalogue ↔ checklists.
 *
 * ─── UNE FILE, PAS UN ÉCRAN PAR SET ───────────────────────────────────────
 *
 * Les 1 599 écarts se traitent par NATURE, pas par set : les 71 doublons
 * `Normale · holo` se règlent tous de la même façon, quel que soit le set où ils
 * tombent. Un écran par set aurait imposé 173 passages pour un geste unique.
 *
 * ─── FINITION NULL N'EST PAS UNE LACUNE ───────────────────────────────────
 *
 * Une variante sans finition porte la finition normale de la rareté de sa
 * carte — une commune n'est pas holo, une Rare Holo l'est, et on ne l'écrit
 * pas. L'écran ne la note donc jamais « à compléter » : elle s'affiche sans
 * mention, exactement comme la base l'entend.
 *
 * ─── LE FILTRE STOCK EST LE PLUS IMPORTANT ────────────────────────────────
 *
 * 84 des 1 599 lignes portent un exemplaire physique. Ce sont les seules où une
 * erreur détruit quelque chose d'irremplaçable. Elles remontent en tête par
 * défaut, et le filtre les isole d'un clic.
 */

export interface LigneFile {
  variante_id: string
  set_code: string
  set_nom: string
  serie: string | null
  numero: string
  carte: string
  rarete: string | null
  image_url: string | null
  tirage_label: string
  finition_label: string | null
  tampon_label: string | null
  exemplaires: number
  jumelle_id: string | null
  jumelles_trouvees: number
  checklist_annonce: string | null
  famille: string
  variantes_de_la_carte: string | null
  total: number
}

export interface Facettes {
  familles: { valeur: string; libelle: string; n: number; stock: number }[]
  sets: { valeur: string; n: number }[]
  series: { valeur: string; n: number }[]
  raretes: { valeur: string; n: number }[]
  tirages: { valeur: string; n: number }[]
  total: number
  totalStock: number
}

type Action = 'rattacher_supprimer' | 'supprimer' | 'conserver'

interface LigneApercu {
  variante_id: string
  carte: string
  set_code: string
  numero: string
  variante: string
  exemplaires: number
  possible: boolean
  effet: string
}

interface LigneRapport {
  variante_id: string
  carte?: string
  set_code?: string
  numero?: string
  variante?: string
  ok: boolean
  message: string
}

const fr = (n: number) => n.toLocaleString('fr-FR')

/** Notation lisible d'une variante : la finition absente ne s'écrit pas. */
const notation = (l: LigneFile) =>
  [l.tirage_label, l.finition_label, l.tampon_label].filter(Boolean).join(' · ')

const LIBELLE_ACTION: Record<Action, string> = {
  rattacher_supprimer: 'Rattacher et supprimer',
  supprimer: 'Supprimer',
  conserver: 'Conserver',
}

export default function ReconciliationChecklist({
  lignes,
  facettes,
  filtres,
  page,
  parPage,
}: {
  lignes: LigneFile[]
  facettes: Facettes
  filtres: Record<string, string | undefined>
  page: number
  parPage: number
}) {
  const router = useRouter()
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [apercu, setApercu] = useState<{ action: Action; lignes: LigneApercu[] } | null>(null)
  const [rapport, setRapport] = useState<LigneRapport[] | null>(null)
  const [motif, setMotif] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const total = lignes[0]?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / parPage))

  const poser = (cle: string, valeur: string | null) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(filtres)) if (v) p.set(k, v)
    if (valeur) p.set(cle, valeur); else p.delete(cle)
    p.delete('page')
    router.push(`/admin/catalogue/reconciliation?${p.toString()}`)
  }

  const allerPage = (n: number) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(filtres)) if (v) p.set(k, v)
    p.set('page', String(n))
    router.push(`/admin/catalogue/reconciliation?${p.toString()}`)
  }

  const basculer = (id: string) =>
    setSelection(s => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })

  const toutBasculer = () =>
    setSelection(s => (s.size === lignes.length ? new Set() : new Set(lignes.map(l => l.variante_id))))

  /** Demande l'aperçu — aucune écriture. */
  async function demanderApercu(action: Action) {
    if (selection.size === 0) return
    setOccupe(true); setErreur(null); setRapport(null)
    try {
      const r = await fetch('/api/admin/catalogue/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'apercu', action, variante_ids: [...selection], motif: motif || 'aperçu' }),
      })
      const j = await r.json()
      if (!r.ok) { setErreur(j.error ?? 'Échec'); return }
      setApercu({ action, lignes: j.apercu ?? [] })
    } finally { setOccupe(false) }
  }

  async function executer() {
    if (!apercu) return
    setOccupe(true); setErreur(null)
    try {
      const r = await fetch('/api/admin/catalogue/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'executer', action: apercu.action, variante_ids: [...selection], motif }),
      })
      const j = await r.json()
      if (!r.ok) { setErreur(j.error ?? 'Échec'); return }
      setRapport(j.lignes ?? [])
      setApercu(null)
      setSelection(new Set())
      setMotif('')
      router.refresh()
    } finally { setOccupe(false) }
  }

  const facette = (
    label: string,
    cle: string,
    valeurs: { valeur: string; n: number; libelle?: string }[],
  ) => (
    <div className="gk-facette-ligne" key={cle}>
      <span className="gk-facette-label">{label}</span>
      <button type="button" className="gk-facette" data-active={!filtres[cle]} onClick={() => poser(cle, null)}>
        Tous<b>{fr(facettes.total)}</b>
      </button>
      {valeurs.slice(0, 12).map(v => (
        <button
          key={v.valeur}
          type="button"
          className="gk-facette"
          data-active={filtres[cle] === v.valeur}
          onClick={() => poser(cle, v.valeur)}
        >
          {v.libelle ?? v.valeur}<b>{fr(v.n)}</b>
        </button>
      ))}
    </div>
  )

  return (
    <div className="gk-corps">
      {/* ── Progression ─────────────────────────────────────────────────── */}
      <div className="gk-kpis" style={{ marginBottom: 18 }}>
        <div className="gk-kpi">
          <span className="gk-label">Écarts restants</span>
          <span className="gk-kpi-val">{fr(facettes.total)}</span>
          <span className="gk-aide">variantes absentes de la checklist</span>
        </div>
        <div className="gk-kpi">
          <span className="gk-label">Dont avec stock</span>
          <span className="gk-kpi-val">{fr(facettes.totalStock)}</span>
          <span className="gk-aide">exemplaires physiques en jeu</span>
        </div>
        <div className="gk-kpi">
          <span className="gk-label">Sélection courante</span>
          <span className="gk-kpi-val">{fr(total)}</span>
          <span className="gk-aide">après filtres</span>
        </div>
        <div className="gk-kpi">
          <span className="gk-label">Cochées</span>
          <span className="gk-kpi-val">{fr(selection.size)}</span>
          <span className="gk-aide">page {page} sur {fr(pages)}</span>
        </div>
      </div>

      {/* ── Filtres ─────────────────────────────────────────────────────── */}
      <div className="gk-facettes">
        {facette('Famille', 'famille', facettes.familles.map(f => ({ valeur: f.valeur, n: f.n, libelle: f.libelle })))}
        <div className="gk-facette-ligne">
          {/* Le filtre qui compte : il isole les lignes où une erreur détruit
              un objet physique. */}
          <span className="gk-facette-label">Stock</span>
          {[
            { v: null, l: 'Tous', n: facettes.total },
            { v: 'avec', l: 'Avec stock', n: facettes.totalStock },
            { v: 'sans', l: 'Sans stock', n: facettes.total - facettes.totalStock },
          ].map(o => (
            <button
              key={o.l}
              type="button"
              className="gk-facette"
              data-active={(filtres.stock ?? null) === o.v}
              onClick={() => poser('stock', o.v)}
            >
              {o.l}<b>{fr(o.n)}</b>
            </button>
          ))}
        </div>
        {facette('Set', 'set', facettes.sets)}
        {facette('Série', 'serie', facettes.series)}
        {facette('Rareté', 'rarete', facettes.raretes)}
        {facette('Tirage', 'tirage', facettes.tirages)}
      </div>

      {erreur && <div className="gk-vide" style={{ marginTop: 14, borderColor: 'rgba(255,122,104,0.35)' }}>{erreur}</div>}

      {/* ── Barre d'action ──────────────────────────────────────────────── */}
      <div className="gk-panneau" style={{ padding: 14, marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="gk-btn" onClick={toutBasculer} disabled={lignes.length === 0}>
            {selection.size === lignes.length && lignes.length > 0 ? 'Tout décocher' : `Cocher les ${lignes.length} de la page`}
          </button>
          <span className="gk-aide" style={{ marginRight: 'auto' }}>
            {selection.size === 0 ? 'Cochez des lignes pour agir.' : `${fr(selection.size)} ligne(s) cochée(s)`}
          </span>
          {(['rattacher_supprimer', 'supprimer', 'conserver'] as Action[]).map(a => (
            <button
              key={a}
              type="button"
              className="gk-btn"
              data-primaire={a === 'rattacher_supprimer' ? 'true' : undefined}
              disabled={occupe || selection.size === 0 || (a === 'conserver' && !motif.trim())}
              onClick={() => demanderApercu(a)}
            >
              {LIBELLE_ACTION[a]}
            </button>
          ))}
        </div>
        <input
          className="gk-input"
          placeholder="Motif — obligatoire pour « Conserver »"
          value={motif}
          onChange={e => setMotif(e.target.value)}
          style={{ marginTop: 10, width: '100%' }}
        />
      </div>

      {/* ── Aperçu d'impact, avant écriture ─────────────────────────────── */}
      {apercu && (
        <div className="gk-panneau" style={{ padding: 16, marginTop: 16, borderColor: 'rgba(255,122,104,0.35)' }}>
          <span className="gk-label" style={{ color: 'var(--gk-rouge)' }}>
            Impact de « {LIBELLE_ACTION[apercu.action]} » — {fr(apercu.lignes.length)} ligne(s)
          </span>
          <div style={{ maxHeight: 260, overflowY: 'auto', marginTop: 10 }}>
            {apercu.lignes.map(l => (
              <div key={l.variante_id} className="gk-row" style={{ gridTemplateColumns: '150px 1fr', padding: '5px 0' }}>
                <span className="gk-label">{l.set_code} #{l.numero}</span>
                <span style={{ fontSize: 12, color: l.possible ? 'var(--gk-doux)' : 'var(--gk-rouge)' }}>
                  <b>{l.carte}</b> · {l.variante} — {l.effet}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" className="gk-btn" data-primaire="true" disabled={occupe} onClick={executer}>
              {occupe ? 'Exécution…' : 'Confirmer'}
            </button>
            <button type="button" className="gk-btn" disabled={occupe} onClick={() => setApercu(null)}>Annuler</button>
          </div>
        </div>
      )}

      {/* ── Rapport ligne à ligne ───────────────────────────────────────── */}
      {rapport && (
        <div className="gk-panneau" style={{ padding: 16, marginTop: 16 }}>
          <span className="gk-label">
            Rapport — {fr(rapport.filter(l => l.ok).length)} traitée(s), {fr(rapport.filter(l => !l.ok).length)} en échec
          </span>
          <div style={{ maxHeight: 300, overflowY: 'auto', marginTop: 10 }}>
            {rapport.map(l => (
              <div key={l.variante_id} className="gk-row" style={{ gridTemplateColumns: '150px 1fr', padding: '5px 0' }}>
                <span className="gk-label">{l.set_code ? `${l.set_code} #${l.numero}` : '—'}</span>
                <span style={{ fontSize: 12, color: l.ok ? 'var(--gk-doux)' : 'var(--gk-rouge)' }}>
                  {l.carte ? <b>{l.carte} · {l.variante} — </b> : null}{l.message}
                </span>
              </div>
            ))}
          </div>
          <button type="button" className="gk-btn" style={{ marginTop: 12 }} onClick={() => setRapport(null)}>Fermer</button>
        </div>
      )}

      {/* ── La file ─────────────────────────────────────────────────────── */}
      {lignes.length === 0 ? (
        <div className="gk-vide" style={{ marginTop: 18 }}>
          <span className="gk-vide-titre">File vide</span>
          <span className="gk-vide-texte">Aucun écart ne répond à ces filtres.</span>
        </div>
      ) : (
        <div className="gk-panneau" style={{ marginTop: 16 }}>
          <div className="gk-heads" style={{ display: 'grid', gridTemplateColumns: '34px 96px 1fr 200px 210px 92px' }}>
            <span className="gk-label"></span>
            <span className="gk-label">Set · nº</span>
            <span className="gk-label">Carte</span>
            <span className="gk-label">En base</span>
            <span className="gk-label">Checklist</span>
            <span className="gk-label">Stock</span>
          </div>
          {lignes.map(l => (
            <div
              key={l.variante_id}
              className="gk-row"
              style={{ gridTemplateColumns: '34px 96px 1fr 200px 210px 92px', alignItems: 'center' }}
              data-active={selection.has(l.variante_id)}
            >
              <input
                type="checkbox"
                checked={selection.has(l.variante_id)}
                onChange={() => basculer(l.variante_id)}
                aria-label={`Sélectionner ${l.carte} ${l.set_code} #${l.numero}`}
              />
              <span className="gk-label">{l.set_code} #{l.numero}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 12.5 }}>{l.carte}</span>
                <span className="gk-aide">{l.rarete ?? '—'} · {l.serie ?? l.set_nom}</span>
              </span>
              <span style={{ minWidth: 0 }}>
                <span className="gk-tag" data-ton={l.finition_label ? 'violet' : undefined}>{notation(l)}</span>
                <span className="gk-aide" style={{ display: 'block', marginTop: 3 }}>
                  {l.variantes_de_la_carte ?? '—'}
                </span>
              </span>
              <span className="gk-aide">{l.checklist_annonce ?? 'carte absente de la checklist'}</span>
              <span>
                {l.exemplaires > 0 ? (
                  <span className="gk-tag" data-ton="accent">{l.exemplaires} ex.</span>
                ) : (
                  <span className="gk-aide">aucun</span>
                )}
                {l.exemplaires > 0 && l.jumelles_trouvees === 1 && (
                  <span className="gk-aide" style={{ display: 'block', marginTop: 3 }}>jumelle prête</span>
                )}
                {l.exemplaires > 0 && l.jumelles_trouvees !== 1 && (
                  <span className="gk-aide" style={{ display: 'block', marginTop: 3 }}>
                    {l.jumelles_trouvees === 0 ? 'pas de jumelle' : 'jumelle ambiguë'}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Pagination serveur ──────────────────────────────────────────── */}
      {pages > 1 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14 }}>
          <button type="button" className="gk-btn" disabled={page <= 1} onClick={() => allerPage(page - 1)}>← Précédente</button>
          <span className="gk-aide">Page {page} sur {fr(pages)} · {fr(total)} ligne(s)</span>
          <button type="button" className="gk-btn" disabled={page >= pages} onClick={() => allerPage(page + 1)}>Suivante →</button>
        </div>
      )}
    </div>
  )
}
