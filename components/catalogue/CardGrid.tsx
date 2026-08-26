import CardTile, { type CardEntry } from './CardTile'
import Reveal from '@/components/motion/Reveal'
import CardCursor from '@/components/motion/CardCursor'

/**
 * Grille du catalogue — une tuile par CARTE, pas par listing.
 *
 * C'est le set entier qu'on donne à parcourir : les cartes indisponibles y
 * figurent, en retrait. Clé par carte plutôt que par listing pour deux raisons :
 * une carte à deux variantes n'apparaît pas deux fois, et le nombre de tuiles
 * reste borné par la taille du set (299 cartes au maximum, tous sets confondus)
 * au lieu du nombre de lignes de stock.
 */
export default function CardGrid({
  cards,
  loading = false,
  emptyLabel,
}: {
  cards: CardEntry[]
  loading?: boolean
  emptyLabel?: string
}) {
  const grid = 'grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'

  if (loading) {
    return (
      <div className={grid}>
        {[...Array(15)].map((_, i) => (
          <div key={i} className="scan-pending aspect-[2.5/3.5] rounded-panel" />
        ))}
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="glass rounded-block px-8 py-16 text-center">
        <p className="m-0 text-[14px] text-ink-70">
          {emptyLabel ?? 'Aucune carte ne correspond à ces filtres.'}
        </p>
      </div>
    )
  }

  return (
    <>
      <CardCursor />
      <Reveal className={grid} stagger={0.02} y={12}>
        {cards.map(card => (
          <CardTile key={card.cardId} card={card} />
        ))}
      </Reveal>
    </>
  )
}
