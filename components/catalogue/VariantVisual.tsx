'use client'

import { useState } from 'react'

/**
 * Visuel d'une VARIANTE de carte.
 *
 * CHAÎNE DE REPLI, dans cet ordre strict :
 *   1. `image_url` de la variante — visuel manuel s'il existe, sinon celui de
 *      l'API (la colonne est générée en base : `coalesce(image_manuelle, image_api)`) ;
 *   2. `image_url` de la CARTE, avec le label de la variante en surimpression ;
 *   3. le placeholder rayé.
 *
 * LE NIVEAU 2 N'EST PAS UN CAS RARE : 3 702 des 29 210 variantes n'ont aucun
 * visuel propre — un affichage sur huit. Le label doit donc être soigné, pas
 * bricolé : il annonce que l'illustration montrée est celle de la carte de base,
 * et que la version affichée en diffère.
 *
 * LISIBILITÉ SUR N'IMPORTE QUELLE ILLUSTRATION. Une étiquette claire disparaît
 * sur une carte claire, une étiquette sombre sur une carte sombre. On pose donc
 * un bandeau encre à opacité franche, en bas — jamais au centre : le sujet de la
 * carte occupe le haut de l'illustration et ne doit pas être masqué.
 */

export default function VariantVisual({
  variantImageUrl,
  cardImageUrl,
  variantLabel,
  alt,
  className = '',
}: {
  variantImageUrl: string | null
  cardImageUrl: string | null
  variantLabel: string | null
  alt: string
  className?: string
}) {
  // Niveaux réellement disponibles, dans l'ordre de la chaîne.
  const chaine = [
    ...(variantImageUrl ? [{ url: variantImageUrl, estRepli: false }] : []),
    ...(cardImageUrl ? [{ url: cardImageUrl, estRepli: true }] : []),
  ]

  const [index, setIndex] = useState(0)
  const courant = chaine[index] ?? null

  if (!courant) {
    return (
      <div className={`scan-pending flex aspect-[2.5/3.5] w-full items-center justify-center rounded-control ${className}`}>
        <span className="font-mono text-[10px] tracking-[0.12em] text-[rgba(26,22,17,0.45)]">
          scan à venir
        </span>
      </div>
    )
  }

  return (
    <div className={`relative aspect-[2.5/3.5] w-full overflow-hidden rounded-control ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- `onError` pilote la chaîne de repli ; next/image avale l'événement */}
      <img
        key={courant.url}
        src={courant.url}
        alt={alt}
        loading="lazy"
        draggable={false}
        // La validation serveur réduit le risque d'URL morte, elle ne l'annule
        // pas : le CDN peut tomber après la passe.
        onError={() => setIndex(i => i + 1)}
        className="h-full w-full object-cover"
      />

      {/* Surimpression UNIQUEMENT au niveau 2 : au niveau 1, l'illustration EST
          celle de la variante, l'annoncer serait faux. */}
      {courant.estRepli && variantLabel && (
        <span
          className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 px-2 py-1.5 text-center"
          style={{
            // Bandeau encre : tient sur illustration claire comme sombre, là où
            // une étiquette d'une seule teinte disparaît sur l'une des deux.
            background: 'linear-gradient(to top, rgba(20,17,13,0.92), rgba(20,17,13,0.72) 62%, rgba(20,17,13,0))',
          }}
        >
          <span className="font-mono text-[8px] uppercase leading-none tracking-[0.14em] text-parchment">
            {variantLabel}
          </span>
          <span
            aria-hidden
            className="font-mono text-[8px] leading-none text-[rgba(248,244,236,0.55)]"
            title="Visuel de la carte de base — cette version n'a pas encore son propre scan"
          >
            ·&nbsp;visuel de base
          </span>
        </span>
      )}
    </div>
  )
}
