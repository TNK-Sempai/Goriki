/**
 * Garde-fou sur une URL de scan collée à la main.
 *
 * ─── POURQUOI CE CHEMIN EXISTE ────────────────────────────────────────────
 *
 * Téléverser les scans un par un depuis la fiche est lent quand on en a cent à
 * poser. L'usage réel est de tout envoyer sur Cloudinary en une fois, puis de
 * rattacher chaque URL déjà générée à son exemplaire. Repasser par le bouton
 * « Téléverser » referait un upload du MÊME fichier : un doublon sur Cloudinary,
 * un `public_id` distinct, et deux copies à maintenir.
 *
 * Les deux usages restent légitimes — celui-ci ne remplace pas l'autre.
 *
 * ─── CE QUE LA VÉRIFICATION ATTRAPE, ET CE QU'ELLE LAISSE PASSER ──────────
 *
 * Elle refuse ce qui est manifestement faux : un autre domaine, un autre compte
 * Cloudinary, une adresse qui n'est pas une URL. Elle ne cherche PAS à valider
 * la forme du chemin : Cloudinary accepte quantité de transformations dans
 * l'URL (`w_600`, `f_auto`, versions, dossiers imbriqués) et refuser ce qu'on
 * n'a pas prévu bloquerait un lien parfaitement bon.
 *
 * Le contrôle qui compte vraiment est celui du COMPTE : coller l'URL du
 * Cloudinary de quelqu'un d'autre donnerait une image qui s'affiche aujourd'hui
 * et disparaît le jour où son propriétaire la supprime.
 *
 * La même fonction sert des deux côtés — retour immédiat dans le champ, et
 * refus côté serveur, qui est celui qui fait autorité.
 */

export interface VerdictUrl {
  ok: boolean
  /** L'URL nettoyée, à écrire en base. Présente seulement si `ok`. */
  url?: string
  /** Phrase à afficher telle quelle quand ce n'est pas bon. */
  raison?: string
}

/**
 * Nom du compte Cloudinary du projet. Variable `NEXT_PUBLIC_`, donc lisible
 * aussi bien au navigateur qu'au serveur : le champ peut refuser tout de suite,
 * sans aller-retour.
 */
const COMPTE = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

export function verifierUrlCloudinary(brut: string): VerdictUrl {
  const valeur = brut.trim()
  if (!valeur) return { ok: false, raison: 'Collez une URL.' }

  let u: URL
  try {
    u = new URL(valeur)
  } catch {
    return { ok: false, raison: "Ceci n'est pas une URL." }
  }

  if (u.protocol !== 'https:') {
    return { ok: false, raison: 'L’URL doit être en https.' }
  }

  // `endsWith` sur le point : `cloudinary.com` et ses sous-domaines de
  // distribution (`res.cloudinary.com`), mais pas `cloudinary.com.exemple.net`.
  const hote = u.hostname.toLowerCase()
  if (hote !== 'cloudinary.com' && !hote.endsWith('.cloudinary.com')) {
    return { ok: false, raison: `Domaine inattendu (${u.hostname}) — attendu : res.cloudinary.com.` }
  }

  const segments = u.pathname.split('/').filter(Boolean)

  // Le compte est le premier segment du chemin de distribution.
  if (COMPTE && segments[0] && segments[0] !== COMPTE) {
    return {
      ok: false,
      raison: `Cette URL vient du compte Cloudinary « ${segments[0]} », pas de celui du site.`,
    }
  }

  if (!u.pathname.includes('/upload/')) {
    return { ok: false, raison: "Ce n'est pas une URL de média Cloudinary (« /upload/ » absent)." }
  }

  return { ok: true, url: u.toString() }
}
