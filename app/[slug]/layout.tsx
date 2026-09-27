import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PokemonBallBackground } from '@/components/blocks/PokemonBallBackground'
import { OnePieceMapBackground } from '@/components/blocks/OnePieceMapBackground.v3'
import FondNeutre from '@/components/fond/FondNeutre'
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
 * savoir quoi dessiner, et `natureDuFond()` peut classer le même préfixe.
 * Depuis ARCHI-01 la fiche est indexée sur l'id de la variante, à la RACINE :
 * `/{uuid}`, 29 210 routes qui ne disent rien de leur univers. Trois schémas
 * répondent à cette forme — variante Pokémon, listing One Piece, produit
 * scellé. Seule la base tranche, d'où la résolution du slug ci-dessous.
 *
 * Elle ne coûte AUCUNE requête : `getListing` est mémoïsée par `cache()`, et la
 * page comme `generateMetadata` appellent déjà la même fonction avec le même
 * slug. Le trio se partage un seul aller-retour.
 *
 * Les deux couches globales se retirent de leur côté sur toutes les routes en
 * forme d'UUID (`natureDuFond()` répond `fiche`) : c'est leur pendant de
 * l'exclusion par préfixe, et la raison pour laquelle un scellé monte ici
 * `FondNeutre` explicitement. Sans univers à lui, il est une page neutre comme
 * une autre et porte le wallpaper commun, décision du propriétaire.
 *
 * `relative z-10` sur le contenu : patron unique des fonds du site. Il est
 * indispensable au motif Poké Ball, qui est en `z-0` — à cette profondeur un
 * `fixed` se peindrait AU-DESSUS d'un contenu resté en flux normal. La carte
 * marine, elle, est en `-z-10` et passerait sans ; le même conteneur pour les
 * deux évite d'avoir à se souvenir laquelle est laquelle.
 *
 * Un slug inconnu tombe sur `notFound()` ICI, et non dans la page. La page est
 * enveloppée par `loading.tsx` : quand elle s'exécute, le squelette est déjà
 * parti avec un statut 200, et son `notFound()` ne peut plus changer le statut.
 * Ce layout est hors de cette frontière et résout déjà le slug : l'appel y
 * produit un vrai 404 HTTP, sans requête de plus.
 */
/**
 * Titre de la fiche introuvable. Le `notFound()` part désormais de ce layout :
 * le `generateMetadata` de la page n'est plus évalué dans ce cas, et le titre
 * « Produit introuvable » qu'il posait retombait sur celui du site.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  return (await getListing(slug)) ? {} : { title: 'Produit introuvable' }
}

export default async function ProductLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const resultat = await getListing(slug)
  if (!resultat) notFound()
  const tcg = resultat.tcg

  return (
    <>
      {tcg === 'pokemon' ? (
        <PokemonBallBackground />
      ) : tcg === 'onepiece' ? (
        <OnePieceMapBackground />
      ) : (
        <FondNeutre />
      )}
      <div className="relative z-10">{children}</div>
    </>
  )
}
