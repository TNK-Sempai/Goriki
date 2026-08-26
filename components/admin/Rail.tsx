'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Rail de navigation du back-office.
 *
 * Trois groupes NUMÉROTÉS, repris de la maquette. La numérotation n'est pas
 * décorative : elle donne une place stable à chaque rubrique dans un outil
 * qu'on rouvre des dizaines de fois, et se lit plus vite qu'une liste plate.
 *
 * Les badges portent des VOLUMES RÉELS, passés par le layout depuis la base.
 * Les inscrire en dur les aurait figés au jour de la maquette.
 */

export interface Compteurs {
  sets: number
  variantes: number
  exemplaires: number
  commandes: number
  scelles: number
  verifications: number
}

const fr = (n: number) => n.toLocaleString('fr-FR')

export default function Rail({ compteurs, email }: { compteurs: Compteurs; email: string }) {
  const pathname = usePathname()

  interface Item { href: string; label: string; badge?: string; exact?: boolean }

  const groupes: { num: string; label: string; items: Item[] }[] = [
    {
      num: '01',
      label: 'Pilotage',
      items: [
        { href: '/admin', label: 'Dashboard', exact: true },
        { href: '/admin/stats', label: 'Statistiques' },
      ],
    },
    {
      num: '02',
      label: 'Inventaire',
      items: [
        { href: '/admin/catalogue', label: 'Catalogue', badge: fr(compteurs.sets), exact: true },
        { href: '/admin/catalogue/editeur', label: 'Éditeur de variantes', badge: fr(compteurs.variantes) },
        { href: '/admin/listings', label: 'Listings', badge: fr(compteurs.exemplaires) },
        { href: '/admin/import', label: 'Import' },
        { href: '/admin/produits', label: 'Scellés', badge: compteurs.scelles ? fr(compteurs.scelles) : undefined },
      ],
    },
    {
      num: '03',
      label: 'Ventes',
      items: [
        { href: '/admin/commandes', label: 'Commandes', badge: compteurs.commandes ? fr(compteurs.commandes) : undefined },
        { href: '/admin/clients', label: 'Clients' },
        { href: '/admin/verifications', label: 'Vérifications', badge: compteurs.verifications ? fr(compteurs.verifications) : undefined },
        { href: '/admin/rachat', label: 'Rachat' },
      ],
    },
  ]

  const actif = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <aside className="gk-rail">
      <div className="gk-marque">
        <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span className="gk-pastille" />
          <span className="gk-marque-nom">GORIKI</span>
        </span>
        <span className="gk-label" style={{ paddingLeft: 16, letterSpacing: '0.22em' }}>Back-office</span>
      </div>

      <nav className="gk-nav">
        {groupes.map(g => (
          <div key={g.num} className="gk-nav-groupe">
            <span className="gk-nav-titre">
              <em>{g.num}</em>
              {g.label}
              <i />
            </span>
            {g.items.map(it => (
              <Link
                key={it.href}
                href={it.href}
                className="gk-nav-item"
                data-active={actif(it.href, it.exact)}
              >
                <span className="gk-nav-dot" />
                <span style={{ flex: 1 }}>{it.label}</span>
                {it.badge && <span className="gk-nav-badge">{it.badge}</span>}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="gk-rail-pied">
        <span className="gk-label">Session</span>
        <span style={{ fontSize: 12, color: 'var(--gk-gris)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {email}
        </span>
        <Link href="/" className="gk-label" style={{ letterSpacing: '0.16em' }}>← Voir la boutique</Link>
      </div>
    </aside>
  )
}
