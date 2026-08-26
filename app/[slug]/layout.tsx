import type { ReactNode } from 'react'
import { PokemonBallBackground } from '@/components/blocks/PokemonBallBackground'
import { OnePieceMapBackground } from '@/components/blocks/OnePieceMapBackground.v3'
import { AtmosphereBackdrop } from '@/components/atmosphere/AtmosphereLayer'
import { getListing } from '@/lib/catalogue/fiche'

/**
 * Fond d'univers de la FICHE PRODUIT — la route la plus fréquentée du site, et
 * la dernière à ne porter aucune identité.
 *
 * Même patron que `app/catalogue/pokemon/layout.tsx` et son homologue One
 * Piece : le fond est monté ICI, une seule fois, jamais dans la page. Ce qui
 * change, c'est comment on choisit lequel.
 *
 * POURQUOI CE LAYOUT NE RESSEMBLE PAS AUX DEUX AUTRES. Les rayons vivent sous
 * un préfixe d'univers (`/catalogue/pokemon/...`), donc le chemin suffit à
 * savoir quoi dessiner, et `AtmosphereLayer` peut exclure le même préfixe.
 * Depuis ARCHI-01 la fiche est indexée sur l'id de la variante, à la RACINE :
 * `/{uuid}`, 29 210 routes qui ne disent rien de leur univers. Trois schémas
 * répondent à cette forme — variante Pokémon, listing One Piece, produit
 * scellé. Seule la base tranche, d'où la résolution du slug ci-dessous.
 *
 * Elle ne coûte AUCUNE requête : `getListing` est mémoïsée par `cache()`, et la
 * page comme `generateMetadata` appellent déjà la même fonction avec le même
 * slug. Le trio se partage un seul aller-retour.
 *
 * `AtmosphereLayer` se retire de son côté sur toutes les routes en forme
 * d'UUID — c'est son pendant de l'exclusion par préfixe, et la raison pour
 * laquelle un scellé reçoit ici `AtmosphereBackdrop` explicitement : sans
 * univers à lui, il garde le canvas qu'il avait, et ne se retrouve pas nu.
 *
 * `relative z-10` sur le contenu : patron unique des fonds du site. Il est
 * indispensable au motif Poké Ball, qui est en `z-0` — à cette profondeur un
 * `fixed` se peindrait AU-DESSUS d'un contenu resté en flux normal. La carte
 * marine, elle, est en `-z-10` et passerait sans ; le même conteneur pour les
 * deux évite d'avoir à se souvenir laquelle est laquelle.
 *
 * Un slug inconnu tombe sur `notFound()` dans la page : pas d'univers, donc le
 * canvas neutre, comme sur n'importe quelle autre page sans identité.
 */
export default async function ProductLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const tcg = (await getListing(slug))?.tcg ?? null

  return (
    <>
      {tcg === 'pokemon' ? (
        <PokemonBallBackground />
      ) : tcg === 'onepiece' ? (
        <OnePieceMapBackground />
      ) : (
        <AtmosphereBackdrop />
      )}
      <div className="relative z-10">{children}</div>
    </>
  )
}
