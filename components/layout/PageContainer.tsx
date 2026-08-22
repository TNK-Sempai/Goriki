import type { ReactNode, ElementType } from 'react'

/**
 * Conteneur de page — LA structure de référence des 20 maquettes
 * (`max-width:1360px; margin:0 auto; padding:… 56px`).
 *
 * L'implémentation vit dans `.page-shell` (styles/globals.css) : source unique,
 * utilisable soit via ce composant, soit en classe directe quand l'élément doit
 * être à la fois conteneur et grille. Aucun écran ne redéclare
 * `max-w-[1360px] mx-auto px-…` à la main — c'est ainsi que le portage a dérivé.
 *
 * Pour le portage des Groupes 2/3/4 : envelopper, ne pas recopier.
 */
export default function PageContainer({
  children,
  as: Tag = 'div',
  className = '',
  /** Gouttière nulle au desktop : la boîte occupe les 1360 px pleins (header, footer). */
  edge = false,
  /** Ancre de section (`href="#cartes"`) — cf. écran « détail d'un set ». */
  id,
}: {
  children: ReactNode
  as?: ElementType
  className?: string
  edge?: boolean
  id?: string
}) {
  return (
    <Tag id={id} className={`page-shell${edge ? ' page-shell-edge' : ''} ${className}`.trim()}>
      {children}
    </Tag>
  )
}
