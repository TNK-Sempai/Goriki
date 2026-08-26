import Link from 'next/link'

/**
 * Groupes de résultats de recherche.
 *
 * Les vignettes ne réutilisent PAS `CardTile` : celle-ci porte la physique de
 * carte, le switch de variantes et l'appel « Je la cherche », qui supposent une
 * grille de set. Ici on liste des objets de natures différentes — cartes, sets,
 * scellés — dans une rangée compacte et homogène.
 */

export interface Resultat {
  type: string
  id: string
  titre: string
  sous_titre: string | null
  numero: string | null
  code: string | null
  set_id: string | null
  universe: string | null
  image_url: string | null
  rarete: string | null
  en_stock: boolean
  rang: number
}

export const GROUPES = [
  { type: 'carte_pokemon', titre: 'Cartes Pokémon', unite: 'carte' },
  { type: 'carte_onepiece', titre: 'Cartes One Piece', unite: 'carte' },
  { type: 'set_pokemon', titre: 'Sets Pokémon', unite: 'set' },
  { type: 'set_onepiece', titre: 'Sets One Piece', unite: 'set' },
  { type: 'scelle', titre: 'Scellés', unite: 'produit' },
] as const

/** Où mène un résultat, selon sa nature. */
export function lienDe(r: Resultat): string {
  if (r.type === 'set_pokemon') return `/catalogue/pokemon/${r.id}`
  if (r.type === 'set_onepiece') return `/catalogue/onepiece/${r.id}`
  if (r.type === 'scelle') return '/catalogue/scelles'
  // Une carte n'a pas de fiche propre : on ouvre son set, filtré sur son nom.
  return `/catalogue/${r.universe}/${r.set_id}?q=${encodeURIComponent(r.titre)}#cartes`
}

/**
 * « Voir tout » d'un groupe → la MÊME page, restreinte à ce type et paginée.
 *
 * Surtout PAS vers `/catalogue/pokemon?q=…` : `SetsIndex` garde sa recherche en
 * état local et ignore `q` dans l'URL. Ce lien serait mort — précisément le
 * défaut que cette mission corrige.
 */
export function lienGroupe(type: string, terme: string): string {
  return `/recherche?q=${encodeURIComponent(terme)}&type=${type}`
}

function Vignette({ r }: { r: Resultat }) {
  const estCarte = r.type.startsWith('carte')

  return (
    <Link
      href={lienDe(r)}
      data-card-hover
      className="glass glass-hoverable group flex gap-3.5 overflow-hidden rounded-panel p-3 transition-colors"
    >
      <div className="relative w-[54px] shrink-0 overflow-hidden rounded-control">
        {r.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- vignette dense de liste
          <img
            src={r.image_url}
            alt=""
            aria-hidden
            loading="lazy"
            className={`w-full object-cover ${estCarte ? 'aspect-[2.5/3.5]' : 'aspect-square'}`}
          />
        ) : (
          <div className={`scan-pending w-full ${estCarte ? 'aspect-[2.5/3.5]' : 'aspect-square'}`} />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <span className="line-clamp-2 text-[13px] font-semibold leading-tight text-ink">
          {r.titre}
        </span>
        {r.sous_titre && (
          <span className="line-clamp-1 mt-0.5 text-[11px] leading-tight text-ink-70">
            {r.sous_titre}
          </span>
        )}
        <span className="data mt-1.5 text-[8px]">
          {r.numero ? `#${r.numero}` : r.code}
          {r.rarete ? ` · ${r.rarete}` : ''}
          {r.en_stock ? ' · en stock' : ''}
        </span>
      </div>
    </Link>
  )
}

export default function GroupeResultats({
  titre,
  unite,
  resultats,
  total,
  hrefVoirTout,
}: {
  titre: string
  unite: string
  resultats: Resultat[]
  /** Total du groupe AVANT plafonnement — dit la vérité sur ce qui existe. */
  total: number
  hrefVoirTout: string
}) {
  if (resultats.length === 0) return null

  return (
    <section className="mb-9 lg:mb-11">
      <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-[rgba(26,22,17,0.12)] pb-2.5">
        <h2 className="display-sub m-0">{titre}</h2>
        <span className="data text-[9px]">
          {total > resultats.length
            ? `${resultats.length} sur ${total} ${unite}${total > 1 ? 's' : ''}`
            : `${total} ${unite}${total > 1 ? 's' : ''}`}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {resultats.map(r => (
          <Vignette key={`${r.type}-${r.id}`} r={r} />
        ))}
      </div>

      {total > resultats.length && (
        <div className="mt-4">
          <Link href={hrefVoirTout} className="data text-[9px] hover:text-ochre">
            Voir tout <span aria-hidden>→</span>
          </Link>
        </div>
      )}
    </section>
  )
}
