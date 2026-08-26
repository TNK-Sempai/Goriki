'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useCart } from '@/hooks/useCart'
import { createClient } from '@/lib/supabase/client'
import LogoutButton from '@/components/auth/LogoutButton'
import PageContainer from '@/components/layout/PageContainer'

const NAV = [
  { label: 'One Piece', href: '/catalogue/onepiece' },
  { label: 'Pokémon', href: '/catalogue/pokemon' },
  { label: 'Scellés', href: '/catalogue/scelles' },
  { label: 'Dépôt-vente', href: '/depot-vente' },
  { label: 'Rachat', href: '/rachat' },
  { label: 'Want to Buy', href: '/want-to-buy' },
]

/**
 * Barre de navigation — composition de la planche de référence.
 *
 * La planche ne montre AUCUN header en pilule de verre flottante : c'est une
 * barre PLATE, pleine largeur, posée sur le parchemin et fermée par un filet.
 * Logo à gauche, nav au centre soulignée d'ocre sur l'actif, outils à droite
 * (recherche · compte · panier encre).
 *
 * Le compteur panier est le VRAI compteur (`useCart`), pas le « PANIER · 2 »
 * figé de la maquette.
 */
export default function SiteHeader() {
  const pathname = usePathname()
  const { count } = useCart()
  const [open, setOpen] = useState(false)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)

  // Lecture LOCALE de la session (aucun appel réseau) : sert uniquement à
  // choisir la destination de l'icône compte. Les vraies gardes restent côté
  // serveur (middleware + layouts).
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setSignedIn(!!session)
    )
    return () => sub.subscription.unsubscribe()
  }, [])

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href))

  return (
    <header className="site-bar sticky top-0 z-50">
      <PageContainer>
        <div className="flex h-[68px] items-center gap-6">
          <Link
            href="/"
            className="flex shrink-0 items-baseline gap-1.5 text-ink"
            aria-label="Goriki TCG — accueil"
          >
            <span className="font-display text-[22px] uppercase leading-none tracking-[-0.02em]">
              Goriki
            </span>
            <span className="font-mono text-[9px] tracking-[0.28em] text-ink-55">TCG</span>
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-7 lg:flex">
            {NAV.map(item => (
              <Link key={item.href} href={item.href} className="nav-link" data-active={isActive(item.href)}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2.5 lg:ml-0">
            {/* `/catalogue` est une page d'accueil de rayons : elle ne lisait
                pas `q`, et toute recherche y tombait dans le vide. */}
            <form action="/recherche" className="relative hidden xl:block">
              <input
                type="search"
                name="q"
                placeholder="Rechercher une carte, un set…"
                aria-label="Rechercher"
                className="field w-[268px] pr-9"
              />
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-55"
              >
                <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12.8 12.8 17 17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </form>

            <Link
              href={signedIn === false ? '/login' : '/compte'}
              aria-label={signedIn === false ? 'Connexion' : 'Mon compte'}
              className="hidden rounded-full p-2 text-ink transition-colors hover:bg-[rgba(26,22,17,0.07)] sm:block"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-[18px] w-[18px]">
                <circle cx="10" cy="6.6" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3.8 17c0-3.4 2.8-5.4 6.2-5.4s6.2 2 6.2 5.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </Link>

            <Link
              href="/panier"
              className="rounded-full bg-ink px-4 py-2.5 font-mono text-[10px] tracking-[0.16em] text-parchment transition-opacity hover:opacity-85"
            >
              PANIER · {count}
            </Link>

            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={open}
              className="rounded-control px-2.5 py-2 text-ink transition-colors hover:bg-[rgba(26,22,17,0.07)] lg:hidden"
            >
              <span className="block h-[1.5px] w-4 bg-current" />
              <span className="mt-1 block h-[1.5px] w-4 bg-current" />
              <span className="mt-1 block h-[1.5px] w-4 bg-current" />
            </button>
          </div>
        </div>

        {open && (
          <nav className="flex flex-col gap-0.5 border-t border-[rgba(26,22,17,0.1)] py-3 text-[14px] lg:hidden">
            {NAV.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`rounded-control px-3 py-2.5 text-ink transition-colors hover:bg-[rgba(26,22,17,0.06)] ${
                  isActive(item.href) ? 'bg-[rgba(26,22,17,0.07)] font-medium' : ''
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={signedIn === false ? '/login' : '/compte'}
              onClick={() => setOpen(false)}
              className="rounded-control px-3 py-2.5 text-ink transition-colors hover:bg-[rgba(26,22,17,0.06)] sm:hidden"
            >
              {signedIn === false ? 'Connexion' : 'Mon compte'}
            </Link>
            {signedIn && (
              <LogoutButton className="rounded-control px-3 py-2.5 text-left text-ink-60 transition-colors hover:bg-[rgba(26,22,17,0.06)] hover:text-ink" />
            )}
          </nav>
        )}
      </PageContainer>
    </header>
  )
}
