/**
 * Garde-fou sur une URL de visuel de CATALOGUE collée à la main.
 *
 * ─── POURQUOI CE FICHIER N'EST PAS `photo-url.ts` ─────────────────────────
 *
 * `verifierUrlCloudinary` sert les SCANS D'EXEMPLAIRES : des photos d'objets
 * physiques que Goriki a eus en main et inspectés. Là, n'accepter que le
 * Cloudinary du site est la bonne rigueur — une photo d'exemplaire venue
 * d'ailleurs n'a aucune raison d'exister.
 *
 * Ici le contexte est autre : on corrige la RÉFÉRENCE de catalogue d'une
 * variante. Le cas d'usage réel est une illustration TCGdex morte ou fausse sur
 * une carte précise, qu'on remplace par la bonne — laquelle est souvent une
 * autre URL TCGdex. Exiger Cloudinary reviendrait à forcer un ré-hébergement
 * pour corriger une faute de l'API.
 *
 * ─── POURQUOI PAS « N'IMPORTE QUELLE URL VALIDE » NON PLUS ────────────────
 *
 * Parce que le site ne sait afficher que deux hôtes. `next.config.ts` déclare
 * `remotePatterns` sur `assets.tcgdex.net` et `res.cloudinary.com`, et
 * `next/image` REFUSE tout autre domaine à l'exécution. Le visuel d'une variante
 * ne reste pas dans l'éditeur : il ressort dans `ProductCard` (accueil) et dans
 * le panier, qui passent tous deux par `next/image`.
 *
 * Une URL d'un troisième domaine s'afficherait donc parfaitement dans
 * l'éditeur — qui utilise un `<img>` nu — puis planterait au panier, très loin
 * de l'écran où elle a été collée. C'est le pire cas de figure : un refus au
 * moment du collage coûte une seconde, ce bug-là coûte une enquête.
 *
 * Élargir la liste suppose donc d'ajouter l'hôte à `next.config.ts` EN MÊME
 * TEMPS. Les deux listes doivent rester d'accord ; c'est pour cela qu'elles se
 * citent l'une l'autre.
 */

export interface VerdictVisuel {
  ok: boolean
  /** L'URL nettoyée, à écrire en base. Présente seulement si `ok`. */
  url?: string
  /** D'où vient le visuel accepté — sert à l'expliquer dans l'interface. */
  source?: 'cloudinary' | 'tcgdex'
  /** Phrase à afficher telle quelle quand ce n'est pas bon. */
  raison?: string
}

/** Doit rester aligné sur `images.remotePatterns` de `next.config.ts`. */
const HOTES_TCGDEX = ['assets.tcgdex.net']

const COMPTE_CLOUDINARY = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

/**
 * Suffixe à ajouter à une URL TCGdex sans extension. Il DIFFÈRE selon la nature
 * du visuel, et c'est une règle du projet, pas un détail :
 *
 *   · une carte  → `/high.webp`  (un segment de plus, pas une extension)
 *   · un logo ou un symbole de set → `.png`
 *
 * Vérifié dans `lib/import/pokemon.ts`, qui appelle `withSuffix(…, '.png')`
 * pour `logo` comme pour `symbol`, là où les cartes reçoivent `/high.webp`.
 * Appliquer le suffixe des cartes à un logo donnerait une adresse morte —
 * d'où le paramètre plutôt qu'une constante.
 */
export type SuffixeTcgdex = '/high.webp' | '.png'

export function verifierUrlVisuel(
  brut: string,
  suffixeTcgdex: SuffixeTcgdex = '/high.webp',
): VerdictVisuel {
  const valeur = brut.trim()
  if (!valeur) return { ok: false, raison: 'Collez une URL.' }

  let u: URL
  try {
    u = new URL(valeur)
  } catch {
    return { ok: false, raison: "Ceci n'est pas une URL." }
  }

  if (u.protocol !== 'https:') {
    return { ok: false, raison: "L'URL doit être en https." }
  }

  const hote = u.hostname.toLowerCase()

  // ── TCGdex ────────────────────────────────────────────────────────────
  if (HOTES_TCGDEX.includes(hote)) {
    // Les URLs TCGdex n'ont PAS d'extension. Coller l'adresse nue donnerait
    // une image morte alors que le lien « existe ». On complète donc comme le
    // fait l'import — avec le suffixe propre à la NATURE du visuel.
    const aUneExtension = /\.(png|jpg|jpeg|webp|svg)$/i.test(u.pathname)
    const url = aUneExtension ? u.toString() : `${u.toString().replace(/\/$/, '')}${suffixeTcgdex}`
    return { ok: true, url, source: 'tcgdex' }
  }

  // ── Cloudinary ────────────────────────────────────────────────────────
  if (hote === 'cloudinary.com' || hote.endsWith('.cloudinary.com')) {
    const segments = u.pathname.split('/').filter(Boolean)
    // Le compte est le premier segment du chemin de distribution. Une image
    // hébergée sur le Cloudinary d'un tiers s'affiche aujourd'hui et disparaît
    // le jour où son propriétaire la supprime.
    if (COMPTE_CLOUDINARY && segments[0] && segments[0] !== COMPTE_CLOUDINARY) {
      return {
        ok: false,
        raison: `Cette URL vient du compte Cloudinary « ${segments[0]} », pas de celui du site.`,
      }
    }
    if (!u.pathname.includes('/upload/')) {
      return { ok: false, raison: "Ce n'est pas une URL de média Cloudinary (« /upload/ » absent)." }
    }
    return { ok: true, url: u.toString(), source: 'cloudinary' }
  }

  return {
    ok: false,
    raison: `Domaine non servi par le site (${u.hostname}). Attendu : assets.tcgdex.net ou res.cloudinary.com.`,
  }
}
