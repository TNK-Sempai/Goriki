import { redirect } from 'next/navigation'

/**
 * L'édition en masse n'est plus un écran à part.
 *
 * Elle vivait dans un mode séparé, déconnecté du contexte visuel : on
 * choisissait un set dans une liste déroulante sans jamais voir où était le
 * travail. Le mécanisme (sélection → valeur commune → rapport par ligne) est
 * désormais intégré à la vue par set. Cette route ne subsiste que pour ne pas
 * casser les liens et signets existants.
 */
export default function MasseRedirect() {
  redirect('/admin/listings')
}
