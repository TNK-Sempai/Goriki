import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Topbar from '@/components/admin/Topbar'

export const dynamic = 'force-dynamic'

/**
 * Dashboard — écran 1 de la maquette.
 *
 * Il répond à une seule question : **par quoi je continue aujourd'hui ?**
 *
 * La boutique n'a pas ouvert — 0 commande, 0 prix saisi. Un tableau de bord de
 * vente n'aurait donc que des zéros à montrer, ce qui n'apprend rien. Celui-ci
 * pilote le CHANTIER en cours : l'avancement du catalogue, et la file de ce qui
 * bloque la mise en vente.
 *
 * Le bloc commerce apparaît de lui-même dès la première commande : les deux
 * états cohabitent dans la maquette, on garde les deux.
 */
export default async function AdminDashboard() {
  const supabase = await createClient()

  const [
    sets, cartes, variantes, exemplaires,
    { count: commandes }, { data: paiements },
    { count: sansVisuel }, { count: sansPrixPkm }, { count: sansPrixOp }, { count: scelles },
    { data: apercu },
  ] = await Promise.all([
    supabase.from('pokemon_sets').select('id', { count: 'exact', head: true }),
    supabase.from('pokemon_cards').select('id', { count: 'exact', head: true }),
    supabase.from('pokemon_card_variants').select('id', { count: 'exact', head: true }),
    supabase.from('pokemon_listings').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('total').eq('status', 'paid'),
    supabase.from('pokemon_card_variants').select('id', { count: 'exact', head: true }).is('image_url', null),
    // « En stock sans prix » : la file de travail réelle, pour les DEUX univers.
    // One Piece manquait, et c'est là que tout le travail se trouve depuis
    // l'injection du stock : 937 annonces à chiffrer, invisibles de ce tableau.
    // `quantity > 0` ajouté côté Pokémon pour que les deux comptes veuillent
    // dire la même chose ; sans effet aujourd'hui, toutes les annonces Pokémon
    // ayant du stock, mais les 839 One Piece sans stock ni prix n'ont rien à
    // faire dans une file de saisie.
    supabase.from('pokemon_listings').select('id', { count: 'exact', head: true }).gt('quantity', 0).lte('price', 0),
    supabase.from('onepiece_listings').select('id', { count: 'exact', head: true }).gt('quantity', 0).lte('price', 0),
    supabase.from('sealed_products').select('id', { count: 'exact', head: true }),
    supabase.rpc('admin_pokemon_sets_nettoyage'),
  ])

  const lignes = (apercu ?? []) as {
    code: string; name_fr: string; cartes: number; card_count: number | null; cartes_corrigees: number
  }[]

  // Écart base / attendu : la mesure qui sort les sets anormaux sans rien
  // chercher. NÉGATIF = cartes manquantes ; POSITIF = sous-blocs, donc sain.
  const manquants = lignes.filter(s => s.card_count !== null && Number(s.cartes) < s.card_count)
  const cartesManquantes = manquants.reduce((n, s) => n + ((s.card_count ?? 0) - Number(s.cartes)), 0)
  const entames = lignes.filter(s => Number(s.cartes_corrigees) > 0).length

  const ca = (paiements ?? []).reduce((n, o) => n + (o.total ?? 0), 0)
  const fr = (n: number) => n.toLocaleString('fr-FR')

  // Histogramme : les cinq sets à qui il manque le plus de cartes. C'est la
  // seule série chiffrée qui ait un sens tant qu'aucune vente n'existe.
  const barres = manquants
    .map(s => ({ label: s.code, manque: (s.card_count ?? 0) - Number(s.cartes) }))
    .sort((a, b) => b.manque - a.manque)
    .slice(0, 8)
  const pire = barres[0]?.manque ?? 1

  const file = [
    {
      titre: 'Prix à saisir · Pokémon',
      compte: sansPrixPkm ?? 0,
      sub: 'En stock, mais pas encore chiffré',
      href: '/admin/listings',
      ton: (sansPrixPkm ?? 0) > 0 ? 'rouge' : 'muet',
    },
    {
      titre: 'Prix à saisir · One Piece',
      compte: sansPrixOp ?? 0,
      sub: 'En stock, mais pas encore chiffré',
      href: '/admin/listings',
      ton: (sansPrixOp ?? 0) > 0 ? 'rouge' : 'muet',
    },
    {
      titre: 'Variantes sans visuel',
      compte: sansVisuel ?? 0,
      sub: 'La fiche publique retombe sur l’illustration de la carte',
      href: '/admin/catalogue/editeur',
      ton: 'accent',
    },
    {
      titre: 'Cartes manquantes',
      compte: cartesManquantes,
      sub: `${manquants.length} set(s) incomplet(s) à l’import`,
      href: '/admin/catalogue',
      ton: cartesManquantes > 0 ? 'rouge' : 'muet',
    },
    {
      titre: 'Produits scellés',
      compte: scelles ?? 0,
      sub: 'Rayon à remplir avant ouverture',
      href: '/admin/produits',
      ton: 'muet',
    },
  ] as const

  const aujourdhui = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <>
      <Topbar
        titre="Dashboard"
        eyebrow={`${aujourdhui} · chantier catalogue`}
        action={{ label: 'Nouvel import', href: '/admin/import' }}
        recherche="Set, carte, commande, client"
      />

      <div className="gk-corps">
        <div className="gk-kpis">
          <Kpi label="Sets au catalogue" valeur={fr(sets.count ?? 0)} sub={`${entames} entamé(s) au nettoyage`} />
          <Kpi label="Cartes" valeur={fr(cartes.count ?? 0)} sub={`${fr(variantes.count ?? 0)} variantes`} />
          <Kpi label="Exemplaires" valeur={fr(exemplaires.count ?? 0)} sub="pièces physiquement détenues" ton="accent" />
          <Kpi
            label="Chiffre d’affaires"
            valeur={commandes ? `${ca.toFixed(2)} €` : '—'}
            sub={commandes ? `${fr(commandes)} commande(s)` : 'la boutique n’a pas ouvert'}
            ton={commandes ? undefined : 'muet'}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, alignItems: 'start' }}>
          <section className="gk-panneau">
            <div className="gk-panneau-tete">
              <span className="gk-label">Sets les plus incomplets</span>
              <span style={{ flex: 1 }} />
              <span className="gk-label">{fr(cartesManquantes)} cartes manquantes</span>
            </div>
            <div style={{ padding: '20px 16px 16px' }}>
              {barres.length > 0 ? (
                <div className="gk-barres">
                  {barres.map(b => (
                    <div key={b.label} className="gk-barre" title={`${b.label} — ${b.manque} carte(s) manquante(s)`}>
                      <span
                        className="gk-barre-fut"
                        data-ton={b.manque === pire ? 'accent' : undefined}
                        style={{ height: Math.max(4, Math.round((b.manque / pire) * 130)) }}
                      />
                      <span className="gk-barre-label">{b.label}</span>
                      <span className="gk-mono gk-dim">{b.manque}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="gk-aide" style={{ margin: 0 }}>
                  Aucun set incomplet : la base et les nombres annoncés coïncident partout.
                </p>
              )}
            </div>
          </section>

          <section className="gk-panneau">
            <div className="gk-panneau-tete">
              <span className="gk-label">File d’attente</span>
              <span style={{ flex: 1 }} />
              <span className="gk-label">Ce qui bloque l’ouverture</span>
            </div>
            {file.map(q => (
              <Link key={q.titre} href={q.href} className="gk-row" data-cliquable="true" style={{ gridTemplateColumns: '1fr auto' }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span>{q.titre}</span>
                  <span className="gk-aide">{q.sub}</span>
                </span>
                <span className="gk-tag" data-ton={q.ton}>{fr(q.compte)}</span>
              </Link>
            ))}
          </section>
        </div>
      </div>
    </>
  )
}

function Kpi({ label, valeur, sub, ton }: { label: string; valeur: string; sub: string; ton?: 'accent' | 'muet' }) {
  return (
    <div className="gk-kpi">
      <span className="gk-kpi-label">{label}</span>
      <span className="gk-kpi-val" data-ton={ton}>{valeur}</span>
      <span className="gk-kpi-sub">{sub}</span>
    </div>
  )
}
