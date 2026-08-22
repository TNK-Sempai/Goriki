'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from '@/components/auth/LogoutButton'

/**
 * Colonne de navigation du compte — case 10 de la planche de référence.
 *
 * La planche dessine une LISTE VERTICALE simple, chaque entrée précédée d'une
 * petite icône, l'entrée active marquée d'un filet ocre à gauche, et
 * « Déconnexion » en dernière position DANS la même liste. L'ancienne version
 * empilait un panneau de verre et un bouton de déconnexion séparé.
 *
 * `isAdmin` vient du layout, qui lit `profiles.role` — la même source que la
 * garde de route `/admin` et que le middleware. C'est un simple pont de
 * navigation : le lien ne change ni la session ni le rôle effectif, et il
 * n'ouvre rien qui ne soit déjà gardé côté serveur.
 */

const TABS = [
  { href: '/compte', label: 'Profil', exact: true },
  { href: '/compte/commandes', label: 'Commandes' },
  { href: '/compte/wishlist', label: 'Wishlist' },
  { href: '/compte/want-to-buy', label: 'Want to Buy' },
  { href: '/compte/depot-vente', label: 'Mes dépôts' },
  { href: '/compte/rachat', label: 'Rachats' },
  { href: '/compte/verification', label: 'Vérification' },
]

export default function CompteNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname()

  const line =
    'flex items-center gap-2.5 border-l-2 py-2.5 pl-3.5 pr-2 text-[13px] transition-colors'

  return (
    <nav className="flex flex-col lg:sticky lg:top-24">
      {TABS.map(tab => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`${line} ${
              active
                ? 'border-ochre bg-[rgba(200,134,10,0.08)] font-medium text-ink'
                : 'border-transparent text-ink-70 hover:border-[rgba(26,22,17,0.18)] hover:text-ink'
            }`}
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rotate-45 ${active ? 'bg-ochre' : 'bg-[rgba(26,22,17,0.3)]'}`}
            />
            {tab.label}
          </Link>
        )
      })}

      {isAdmin && (
        <Link
          href="/admin"
          className={`${line} mt-2 border-transparent border-t border-t-[rgba(26,22,17,0.12)] pt-4 text-ochre transition-colors hover:text-ink`}
        >
          <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-ochre" />
          Administration
          <span aria-hidden className="ml-auto text-[11px]">→</span>
        </Link>
      )}

      <LogoutButton
        className={`${line} ${isAdmin ? 'mt-0 border-t-0 pt-2.5' : 'mt-2 border-t border-t-[rgba(26,22,17,0.12)] pt-4'} border-transparent text-left text-ink-55 transition-colors hover:text-ochre`}
      />
    </nav>
  )
}
