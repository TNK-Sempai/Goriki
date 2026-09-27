import { createClient } from '@/lib/supabase/server'
import Topbar from '@/components/admin/Topbar'
import VueEditeur from '@/components/admin/catalogue/VueEditeur'
import type { SetNettoyage, TypeVariante } from '@/components/admin/catalogue/types'
import { checklistDuSet, casesParNumero } from '@/lib/admin/checklists'
import type { CarteAdmin } from '@/components/admin/catalogue/VueEditeur'

export const dynamic = 'force-dynamic'

interface Props { searchParams: Promise<Record<string, string | string[] | undefined>> }

/**
 * Catalogue Pokémon — vue ÉDITEUR, patron PonéglypheAPI : trois colonnes.
 *
 *   · Gauche  — les 185 sets, numérotés, avec leur `n / total` et leur cadenas.
 *               La numérotation donne le repère de progression.
 *   · Centre  — la grille du set courant, précédée des facettes en COMPTEURS
 *               affichés, pas en menus déroulants : voir les nombres avant de
 *               filtrer est ce qui rend l'anomalie visible.
 *   · Droite  — l'éditeur de la carte sélectionnée.
 *
 * Le set entier est chargé d'un coup (299 cartes au plus gros) : la pagination
 * est un choix d'affichage de la grille, pas une contrainte de chargement.
 */
export default async function EditeurPage({ searchParams }: Props) {
  const sp = await searchParams
  const supabase = await createClient()

  // Les compteurs globaux du rail sont chargés par le layout : les refaire ici
  // coûtait trois `count exact` à chaque ouverture de l'éditeur pour un
  // résultat aussitôt jeté. Le sourcil de cet écran compte le SET courant.
  const { data: apercu } = await supabase.rpc('admin_pokemon_sets_nettoyage')

  const sets: SetNettoyage[] = ((apercu ?? []) as SetNettoyage[])
    .map(s => ({
      ...s,
      cartes: Number(s.cartes),
      cartes_corrigees: Number(s.cartes_corrigees),
      variantes: Number(s.variantes),
      variantes_sans_visuel: Number(s.variantes_sans_visuel),
      champs_set_corriges: Number(s.champs_set_corriges),
      types_restreints: Number(s.types_restreints),
      locked_fields: s.locked_fields ?? [],
    }))
    .sort((a, b) => {
      if (!a.release_date && !b.release_date) return a.code.localeCompare(b.code)
      if (!a.release_date) return 1
      if (!b.release_date) return -1
      return a.release_date.localeCompare(b.release_date)
    })

  // Set courant : celui demandé, sinon le premier de l'ordre chronologique.
  const demande = typeof sp.set === 'string' ? sp.set : null
  const setCourant = sets.find(s => s.set_id === demande) ?? sets[0] ?? null

  let cartes: CarteAdmin[] = []
  let axes: { tirages: TypeVariante[]; finitions: TypeVariante[]; tampons: TypeVariante[] } =
    { tirages: [], finitions: [], tampons: [] }
  /** Numéro de carte → nombre de cases attendues par la checklist PokéCardex. */
  let checklist = new Map<string, number>()

  if (setCourant) {
    const [{ data: lignes }, { data: tirages }, { data: finitions }, { data: tampons }] = await Promise.all([
      supabase
        .from('pokemon_cards')
        .select(`
          id, number, name_fr, rarity, card_type, category, attribute,
          is_secret, is_promo, image_url, locked_fields,
          pokemon_card_variants(
            id, image_url, image_manuelle, locked_fields, source,
            tirage_id, finition_id, tampon_id,
            pokemon_variant_types(id, code, label, sort_order),
            pokemon_listings(id, quantity, condition)
          )
        `)
        .eq('set_id', setCourant.set_id)
        .order('sort_prefix')
        .order('sort_num')
        .order('number')
        .limit(400),
      supabase.from('pokemon_variant_tirages').select('id, code, label, sort_order').order('sort_order'),
      supabase.from('pokemon_variant_finitions').select('id, code, label, sort_order').order('sort_order'),
      supabase.from('pokemon_variant_tampons').select('id, code, label, sort_order').order('sort_order'),
    ])

    axes = {
      tirages: (tirages ?? []) as TypeVariante[],
      finitions: (finitions ?? []) as TypeVariante[],
      tampons: (tampons ?? []) as TypeVariante[],
    }

    // La checklist du set courant — la référence contre laquelle comparer.
    checklist = casesParNumero(await checklistDuSet(setCourant.code))

    cartes = ((lignes ?? []) as unknown as CarteAdmin[])
  }

  return (
    <>
      <Topbar
        titre="Éditeur de variantes"
        eyebrow={
          setCourant
            ? `${setCourant.code} · ${setCourant.variantes} variantes · ${setCourant.cartes} cartes`
            : 'aucun set'
        }
        action={{ label: 'Retour aux sets', href: '/admin/catalogue' }}
      />
      <VueEditeur
        sets={sets}
        setCourant={setCourant}
        cartes={cartes}
        axes={axes}
        checklist={[...checklist.entries()]}
      />
    </>
  )
}
