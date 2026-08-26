import Link from 'next/link'
import { prixDepuis } from '@/lib/utils'

/**
 * « Autres versions de cette carte » — colonne de gauche de la fiche produit.
 *
 * Une LISTE VERTICALE, pas une grille de vignettes. Deux raisons :
 *
 *  · Ce qui distingue ces lignes n'est pas l'illustration — elle est identique
 *    d'une version à l'autre — mais le libellé, la rareté, le stock et le prix.
 *    Une grille met l'image en avant et cache justement ce qui différencie ;
 *    une liste met les mots côte à côte, donc comparables.
 *  · La version précédente était une rangée pleine largeur en six colonnes.
 *    Avec une seule autre version, elle occupait 370 px pour une carte et cinq
 *    sixièmes de vide horizontal. En colonne, deux versions tiennent dans la
 *    hauteur laissée libre sous la photo.
 *
 * La ligne COURANTE reste affichée et n'est pas cliquable : c'est un repère de
 * position dans la liste, pas une suggestion. Un lien vers la page où l'on se
 * trouve déjà serait un piège.
 */

export interface LigneVersion {
  /** Identité servant d'URL de fiche : variante (Pokémon) ou listing (One Piece). */
  id: string
  libelle: string
  reference: string
  rarete: string | null
  image: string | null
  /** Somme des quantités réellement vendables. */
  stock: number
  /** Plus bas prix vendable, `null` si rien ne l'est. */
  prix: number | null
  courante: boolean
}

export default function AutresVersions({ versions }: { versions: LigneVersion[] }) {
  // Une seule version = rien à comparer. Pas de section, pas de titre orphelin.
  if (versions.length < 2) return null

  return (
    <section aria-labelledby="autres-versions">
      <div className="hair flex items-baseline justify-between gap-3 pb-3 pt-5">
        <h2 id="autres-versions" className="display-sub m-0">
          Autres versions de cette carte
        </h2>
        <span className="data shrink-0 text-[9px]">
          {versions.length} version{versions.length > 1 ? 's' : ''} répertoriée{versions.length > 1 ? 's' : ''}
        </span>
      </div>

      <ul className="m-0 flex list-none flex-col gap-2">
        {versions.map(v => {
          const contenu = (
            <>
              {v.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- vignette dense de liste
                <img
                  src={v.image}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  className="h-[52px] w-[37px] shrink-0 rounded-[3px] object-cover"
                />
              ) : (
                <span className="scan-pending h-[52px] w-[37px] shrink-0 rounded-[3px]" />
              )}

              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-[13px] font-medium text-ink">{v.libelle}</span>
                <span className="data mt-1 truncate text-[8px]">{v.reference}</span>
                {v.rarete && (
                  <span className="badge badge-muted mt-1.5 self-start text-[8px]">{v.rarete}</span>
                )}
              </span>

              <span className="flex shrink-0 flex-col items-end leading-tight">
                {/* `prixDepuis` porte la règle du site : 0 ou absent → « Épuisé »
                    en toutes lettres. Jamais de tiret, jamais de « 0,00 € » —
                    un tiret laisse croire à une donnée manquante là où
                    l'information est justement qu'il n'y a rien à vendre. */}
                <span
                  className={
                    v.prix != null && v.prix > 0
                      ? 'text-[14px] font-semibold text-ink'
                      : 'text-[12px] text-ink-55'
                  }
                >
                  {prixDepuis(v.prix)}
                </span>
                {/* Le stock ne s'affiche QUE s'il y en a. Sans ce garde-fou la
                    ligne donnait « Épuisé » sous « Épuisé » — le prix le dit
                    déjà, le répéter n'ajoute rien et alourdit une liste dont
                    tout l'intérêt est d'être balayée d'un coup d'œil. */}
                {v.stock > 0 && (
                  <span className="data mt-1 text-[8px]">{v.stock} dispo</span>
                )}
              </span>
            </>
          )

          const classesCommunes =
            'flex items-center gap-3 rounded-control border px-3 py-2.5 transition-colors'

          return (
            <li key={v.id}>
              {v.courante ? (
                /* Mise en avant par l'ocre de la DA, à 8 % — le même traitement
                   que la pilule active et que la liste d'exemplaires plus haut.
                   Pas d'aplat vif : c'est un repère, pas une alerte. */
                <div
                  aria-current="true"
                  className={`${classesCommunes} border-[rgba(200,134,10,0.55)] bg-[rgba(200,134,10,0.08)]`}
                >
                  {contenu}
                </div>
              ) : (
                <Link
                  href={`/${v.id}`}
                  className={`${classesCommunes} border-[rgba(26,22,17,0.14)] bg-[rgba(255,255,255,0.5)] hover:bg-white`}
                >
                  {contenu}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
