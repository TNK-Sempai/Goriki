import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

/**
 * Rendu d'un document légal.
 *
 * ─── POURQUOI UNE TABLE DE COMPOSANTS PLUTÔT QUE DU CSS DESCENDANT ────────
 * `react-markdown` produit des éléments React, jamais du HTML injecté : aucun
 * `dangerouslySetInnerHTML`, donc aucune surface d'injection même si un texte
 * légal venait un jour d'ailleurs. Et chaque balise reçoit ici les classes du
 * design system, au lieu d'une feuille descendante qu'un utilitaire Tailwind
 * pourrait élaguer (voir le piège de cascade documenté dans CLAUDE.md).
 *
 * ─── LES TABLEAUX SONT LE POINT DÉLICAT ───────────────────────────────────
 * La politique de confidentialité en contient deux, à trois colonnes. Sur un
 * téléphone, un tableau non contenu déborde et pousse TOUTE la page en défilement
 * horizontal. Chacun vit donc dans son propre conteneur à débordement, et lui
 * seul défile.
 */

const composants: Components = {
  h1: ({ children }) => (
    <h1 className="display-section m-0 mb-6 mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="display-sub m-0 mb-3 mt-10 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="m-0 mb-2 mt-7 text-[16px] font-semibold text-ink">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="m-0 mb-4 text-[15px] leading-[1.7] text-ink-70">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="m-0 mb-4 flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-[1.7] text-ink-70">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="m-0 mb-4 flex list-decimal flex-col gap-1.5 pl-5 text-[15px] leading-[1.7] text-ink-70">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  hr: () => <hr className="hair my-8 border-0" />,

  a: ({ href, children }) => {
    const cible = href ?? '#'
    // Un lien interne passe par <Link> : sans lui, chaque renvoi d'un document
    // à l'autre rechargerait tout le site.
    const interne = cible.startsWith('/')
    const classe = 'underline underline-offset-2 decoration-[rgba(26,22,17,0.35)] hover:decoration-ink'
    return interne
      ? <Link href={cible} className={classe}>{children}</Link>
      : <a href={cible} className={classe} target="_blank" rel="noopener noreferrer">{children}</a>
  },

  table: ({ children }) => (
    <div className="mb-6 -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      {/* `min-w` calé pour qu'un écran de 390 px affiche le tableau ENTIER :
          au-delà, la dernière colonne se coupe au bord sans que rien n'indique
          qu'elle défile, et on lit une base légale tronquée sans le savoir.
          Plus étroit encore, le conteneur reprend la main et défile seul. */}
      <table className="w-full min-w-[340px] border-collapse text-left text-[13px] sm:text-[14px]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-[rgba(26,22,17,0.18)] px-2 py-2.5 sm:px-3 align-top font-mono text-[10px] uppercase tracking-[0.1em] text-ink-70">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-[rgba(26,22,17,0.09)] px-2 py-2.5 sm:px-3 align-top leading-[1.6] text-ink-70">
      {children}
    </td>
  ),
}

export default function DocumentLegal({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={composants}>
      {markdown}
    </ReactMarkdown>
  )
}
