import { createClient } from '@/lib/supabase/server'
import Topbar from '@/components/admin/Topbar'
import ReconciliationChecklist, {
  type LigneFile,
  type Facettes,
} from '@/components/admin/catalogue/ReconciliationChecklist'

export const dynamic = 'force-dynamic'

interface Props { searchParams: Promise<Record<string, string | string[] | undefined>> }

/**
 * Réconciliation catalogue ↔ checklists.
 *
 * Remplace `/admin/catalogue/arbitrage`, conçu pour un modèle à un seul type de
 * variante et qui posait une question devenue sans objet.
 *
 * ─── PAGINATION CÔTÉ SERVEUR, ET NON CÔTÉ CLIENT ──────────────────────────
 *
 * La file compte 1 599 lignes, chacune portant l'énumération des variantes de sa
 * carte et ce que la checklist annonce. Tout charger ferait un payload que
 * PostgREST plafonnerait à 1 000 lignes — la troncature silencieuse déjà
 * rencontrée sur l'écran d'arbitrage, où l'écran affichait « 1 000 » pour 1 412.
 * Ici la RPC pagine et renvoie le total exact avec chaque page.
 *
 * Les facettes, elles, sont comptées sur la file ENTIÈRE : voir combien de
 * lignes portent du stock AVANT de filtrer est précisément ce qui oriente le
 * travail.
 */

const FAMILLES: { valeur: string; libelle: string }[] = [
  { valeur: 'doublon_holo',              libelle: 'Doublon Normale · holo' },
  { valeur: 'normale_inconnue',          libelle: 'Normale inconnue' },
  { valeur: 'reverse_inconnue',          libelle: 'Reverse inconnue' },
  { valeur: 'premiere_edition_inconnue', libelle: '1ère édition inconnue' },
  { valeur: 'illimite_inconnu',          libelle: 'Illimité inconnu' },
]

const PAR_PAGE = 50

export default async function ReconciliationPage({ searchParams }: Props) {
  const sp = await searchParams
  const lire = (k: string) => (typeof sp[k] === 'string' && sp[k] ? (sp[k] as string) : undefined)

  const filtres = {
    famille: lire('famille'),
    stock: lire('stock'),
    set: lire('set'),
    serie: lire('serie'),
    rarete: lire('rarete'),
    tirage: lire('tirage'),
  }
  const page = Math.max(1, Number(lire('page') ?? 1) || 1)

  const supabase = await createClient()

  const [{ data: lignesBrutes, error }, { data: agregats }] = await Promise.all([
    supabase.rpc('admin_file_reconciliation', {
      p_famille: filtres.famille ?? null,
      p_stock: filtres.stock ?? null,
      p_set_code: filtres.set ?? null,
      p_serie: filtres.serie ?? null,
      p_rarete: filtres.rarete ?? null,
      p_tirage: filtres.tirage ?? null,
      p_limite: PAR_PAGE,
      p_offset: (page - 1) * PAR_PAGE,
    }),
    // Les facettes sont AGRÉGÉES EN BASE, jamais comptées côté application.
    // Une première version relisait la vue entière : PostgREST la plafonnait à
    // 1 000 lignes et l'écran annonçait « 1 000 écarts » pour 1 599 réels. Un
    // chiffre faux mais plausible fait croire la file plus courte qu'elle n'est.
    supabase.rpc('admin_facettes_reconciliation'),
  ])

  const lignes = ((lignesBrutes ?? []) as LigneFile[]).map(l => ({
    ...l,
    exemplaires: Number(l.exemplaires),
    jumelles_trouvees: Number(l.jumelles_trouvees),
    total: Number(l.total),
  }))

  type Compte = { valeur: string; n: number; stock?: number }
  const a = (agregats ?? {}) as {
    total?: number; totalStock?: number
    familles?: Compte[]; sets?: Compte[]; series?: Compte[]; raretes?: Compte[]; tirages?: Compte[]
  }

  const facettes: Facettes = {
    familles: (a.familles ?? [])
      .map(f => ({
        valeur: f.valeur,
        libelle: FAMILLES.find(x => x.valeur === f.valeur)?.libelle ?? f.valeur,
        n: f.n,
        stock: f.stock ?? 0,
      }))
      .sort((x, y) => y.n - x.n),
    sets: a.sets ?? [],
    series: a.series ?? [],
    raretes: a.raretes ?? [],
    tirages: a.tirages ?? [],
    total: a.total ?? 0,
    totalStock: a.totalStock ?? 0,
  }

  return (
    <>
      <Topbar
        titre="Réconciliation"
        eyebrow={`${facettes.total.toLocaleString('fr-FR')} écart(s) · ${facettes.totalStock} avec stock`}
        action={{ label: 'Retour au catalogue', href: '/admin/catalogue' }}
      />
      {error ? (
        <div className="gk-corps">
          <div className="gk-vide" style={{ borderColor: 'rgba(255,122,104,0.3)' }}>
            <span className="gk-vide-titre">Lecture impossible</span>
            <span className="gk-vide-texte">{error.message}</span>
          </div>
        </div>
      ) : (
        <ReconciliationChecklist
          lignes={lignes}
          facettes={facettes}
          filtres={filtres}
          page={page}
          parPage={PAR_PAGE}
        />
      )}
    </>
  )
}
