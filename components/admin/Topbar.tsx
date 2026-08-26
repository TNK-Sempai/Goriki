import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * En-tête d'écran : sourcil, titre, recherche, action principale.
 *
 * Le SOURCIL porte l'état chiffré de l'écran — « 185 sets · 20 106 cartes ·
 * 29 210 variantes ». C'est ce qui évite de descendre dans la page pour savoir
 * où on en est, et ça reste vrai à chaque rendu puisque les nombres viennent
 * de la base : aucun de ces trois nombres n'est écrit dans le code, celui-ci
 * n'est qu'un exemple de forme.
 */
export default function Topbar({
  titre,
  eyebrow,
  action,
  recherche,
}: {
  titre: string
  eyebrow: ReactNode
  action?: { label: string; href: string }
  /**
   * Placeholder du champ de recherche. Absent = pas de champ sur cet écran.
   *
   * Le champ POSTE vers /admin/catalogue, qui lit `?q=` et en amorce le filtre
   * du panneau. Il a d'abord été livré sans ce câblage : il postait dans le
   * vide, et l'écran catalogue affichait alors DEUX champs dont un seul
   * répondait. D'où la règle ici — un écran qui porte déjà son propre filtre
   * ne reçoit pas ce champ en plus.
   */
  recherche?: string
}) {
  return (
    <header className="gk-topbar">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <span className="gk-eyebrow"><span />{eyebrow}</span>
        <h1 className="gk-titre">{titre}</h1>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 4 }}>
        {recherche && (
          <form action="/admin/catalogue" className="gk-champ" style={{ width: 300 }}>
            <span style={{ width: 6, height: 6, border: '1.5px solid var(--gk-muet)', borderRadius: '50%' }} />
            <input name="q" placeholder={recherche} aria-label="Rechercher" />
          </form>
        )}
        {action && (
          <Link href={action.href} className="gk-btn" data-primaire="true">
            {action.label}
          </Link>
        )}
      </div>
    </header>
  )
}
