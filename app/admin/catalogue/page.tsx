import { createClient } from '@/lib/supabase/server'
import Topbar from '@/components/admin/Topbar'
import VueSets from '@/components/admin/catalogue/VueSets'
import type { SetNettoyage, TypeVariante } from '@/components/admin/catalogue/types'

export const dynamic = 'force-dynamic'

interface Props { searchParams: Promise<Record<string, string | string[] | undefined>> }

/**
 * Catalogue — écran 2 de la maquette : table dense, jauge BASE / ATTENDU,
 * compteur de verrous en ligne, panneau latéral d'édition.
 *
 * La colonne ÉTAT est l'outil central : elle sort 19 sets anormaux sur 185 sans
 * qu'on ait rien à chercher, en distinguant deux natures d'écart — 15 sets à qui
 * il MANQUE des cartes (796 au total) et 7 dont le surplus vient des sous-blocs
 * (337), qui ne sont pas des anomalies.
 *
 * Le rail de navigation vit désormais dans le layout : cet écran ne porte plus
 * que son en-tête et son contenu.
 */
export default async function CatalogueSetsPage({ searchParams }: Props) {
  const sp = await searchParams
  // `?q=` vient du champ de la topbar du dashboard : il amorce le filtre du
  // panneau plutôt que d'ouvrir un second champ concurrent sur cet écran.
  const q = typeof sp.q === 'string' ? sp.q : ''
  const supabase = await createClient()

  const [{ data, error }, { data: types }, { data: visuels }] = await Promise.all([
    supabase.rpc('admin_pokemon_sets_nettoyage'),
    // `set_id is null` : la liste GLOBALE. Un type taillé pour un set précis
    // n'a rien à faire dans le panneau d'un autre.
    supabase.from('pokemon_variant_types').select('id, code, label, sort_order, source').is('set_id', null).order('sort_order'),
    // Visuels lus à part : la RPC d'agrégation reste hors périmètre.
    supabase.from('pokemon_sets').select('id, image_url, symbol_url'),
  ])

  const parSet = new Map(
    ((visuels ?? []) as { id: string; image_url: string | null; symbol_url: string | null }[])
      .map(v => [v.id, v]),
  )

  const lignes: SetNettoyage[] = ((data ?? []) as SetNettoyage[]).map(s => ({
    ...s,
    image_url: parSet.get(s.set_id)?.image_url ?? null,
    symbol_url: parSet.get(s.set_id)?.symbol_url ?? null,
    cartes: Number(s.cartes),
    cartes_corrigees: Number(s.cartes_corrigees),
    variantes: Number(s.variantes),
    variantes_sans_visuel: Number(s.variantes_sans_visuel),
    champs_set_corriges: Number(s.champs_set_corriges),
    types_restreints: Number(s.types_restreints),
    locked_fields: s.locked_fields ?? [],
  }))

  const cartes = lignes.reduce((n, s) => n + s.cartes, 0)
  const variantes = lignes.reduce((n, s) => n + s.variantes, 0)
  const fr = (n: number) => n.toLocaleString('fr-FR')

  return (
    <>
      <Topbar
        titre="Catalogue"
        eyebrow={`${fr(lignes.length)} sets · ${fr(cartes)} cartes · ${fr(variantes)} variantes`}
        action={{ label: 'Éditeur de variantes', href: '/admin/catalogue/editeur' }}
      />

      <div className="gk-corps">
        {error && (
          <div className="gk-vide" style={{ borderColor: 'rgba(255,122,104,0.3)' }}>
            <span className="gk-vide-titre">Lecture impossible</span>
            <span className="gk-vide-texte">{error.message}</span>
          </div>
        )}
        <VueSets sets={lignes} types={(types ?? []) as TypeVariante[]} qInitial={q} />
      </div>
    </>
  )
}
