'use client'

import { usePathname } from 'next/navigation'
import FondNeutre from './FondNeutre'
import { natureDuFond, fondDense } from '@/lib/fond'

/**
 * Monte le wallpaper commun sur les pages neutres, et sur elles seules.
 *
 * MÉCANISME UNIQUE : ce composant est monté une fois dans `app/layout.tsx`,
 * jamais page par page. Une page neutre ajoutée demain reçoit le fond sans
 * qu'on y touche, et ne peut pas recevoir en plus un motif d'univers puisque
 * la même fonction sert aux deux couches.
 *
 * Les pages d'univers, le back-office, le tunnel de paiement et les fiches
 * produit sont écartés par `natureDuFond()` : voir `lib/fond.ts` pour le
 * pourquoi de chacun.
 */
export default function FondNeutreAuto() {
  const pathname = usePathname()
  if (natureDuFond(pathname) !== 'neutre') return null
  return <FondNeutre dense={fondDense(pathname)} />
}
