'use client'

import { useState } from 'react'

/**
 * Visuel d'une extension, en haut de sa fiche.
 *
 * CHAÎNE DE REPLI, dans cet ordre strict :
 *   1. `image_url` — le logo du set ;
 *   2. `symbol_url` — le symbole ;
 *   3. le cadre rayé, inchangé.
 *
 * Le logo est l'ÉTAT PAR DÉFAUT, pas l'état « rupture » : l'affichage n'est plus
 * conditionné à la présence d'exemplaires en vente. Le filtre « Disponibles » de
 * la barre d'outils répond déjà à la question du stock.
 *
 * Ce bloc rendait auparavant un éventail des cartes les plus chères EN VENTE, et
 * retombait sur le cadre rayé sinon. Cette substitution avait été actée quand
 * `*_sets.image_url` était NULL partout — ce n'est plus le cas : 121 des 185 sets
 * Pokémon portent un logo, 147 un symbole.
 *
 * REPLI AU RUNTIME. La validation serveur (`scripts/validate-card-images.ts`,
 * cible `sets`) réduit le risque d'URL morte, elle ne l'annule pas : le CDN peut
 * tomber après la passe. Un `onError` fait donc descendre d'un niveau côté
 * navigateur.
 *
 * RATIOS. Un logo est large et bas, un symbole petit et carré : `object-contain`
 * dans une boîte de dimensions fixes, jamais d'étirement. Le symbole n'est PAS
 * agrandi à la taille du logo — il deviendrait flou.
 */

type Niveau = { url: string; kind: 'logo' | 'symbole' }

export default function SetVisual({
  logoUrl,
  symbolUrl,
  setName,
}: {
  logoUrl: string | null
  symbolUrl: string | null
  setName: string
}) {
  const chaine: Niveau[] = [
    ...(logoUrl ? [{ url: logoUrl, kind: 'logo' as const }] : []),
    ...(symbolUrl ? [{ url: symbolUrl, kind: 'symbole' as const }] : []),
  ]

  const [index, setIndex] = useState(0)
  const courant = chaine[index] ?? null

  return (
    // Hauteur fixée quel que soit le niveau servi : aucun décalage de mise en
    // page entre le rendu serveur et le chargement de l'image.
    <div className="relative flex min-h-[220px] items-center justify-center lg:min-h-[280px]">
      {courant ? (
        // eslint-disable-next-line @next/next/no-img-element -- `onError` pilote la chaîne de repli ; next/image avale l'événement et impose son propre wrapper
        <img
          key={courant.url}
          src={courant.url}
          alt={setName}
          onError={() => setIndex(i => i + 1)}
          className={
            courant.kind === 'logo'
              ? 'max-h-[150px] w-auto max-w-[82%] object-contain lg:max-h-[186px]'
              : 'h-[76px] w-[76px] object-contain lg:h-[92px] lg:w-[92px]'
          }
          style={{
            // Les PNG TCGdex sont transparents et souvent très sombres (ME05
            // « Nuit Noire »). Une ombre portée claire les décolle du parchemin
            // sans les recouvrir d'une plaque, qui écraserait au contraire les
            // logos clairs.
            filter: 'drop-shadow(0 2px 10px rgba(248,244,236,0.9)) drop-shadow(0 8px 22px rgba(26,22,17,0.14))',
          }}
        />
      ) : (
        <div className="scan-pending flex aspect-[2.5/3.5] h-[236px] items-center justify-center rounded-[8px]">
          <span className="data text-[9px]">visuel non disponible</span>
        </div>
      )}
    </div>
  )
}
