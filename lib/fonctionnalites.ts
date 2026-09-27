/**
 * Ce qui est OUVERT au lancement.
 *
 * ─── UN SEUL INTERRUPTEUR PAR FONCTION ────────────────────────────────────
 * Goriki ouvre avec la vente seule. Le rachat et le dépôt-vente sont écrits,
 * testés et conservés INTACTS : rien n'a été supprimé, ni en code ni en base.
 * Les rouvrir consiste à passer une constante à `true` et à redéployer.
 *
 * ─── POURQUOI UNE CONSTANTE ET NON UN RÉGLAGE EN BASE ─────────────────────
 * Contrairement aux tarifs de livraison, ouvrir une fonction n'est pas un
 * réglage du quotidien : cela demande d'avoir relu le parcours, les emails et
 * les pages légales qui le décrivent. Un interrupteur en base inviterait à le
 * basculer un soir sans ce travail. Un redéploiement est ici la bonne friction.
 *
 * ⚠️ Chaque fonction fermée doit l'être à DEUX endroits : la page, qui
 * l'explique, et la route serveur, qui refuse. La première seule laisserait
 * passer une requête forgée.
 */

export const RACHAT_OUVERT = false
export const DEPOT_VENTE_OUVERT = false

/** Message unique des écrans fermés, pour ne pas en écrire quatre variantes. */
export const MESSAGE_BIENTOT =
  "Cette fonctionnalité n'est pas encore ouverte. Nous démarrons avec la vente, et nous l'activerons ensuite."

/** Refus renvoyé par les routes serveur quand la fonction est fermée. */
export const REFUS_FERME =
  "Cette fonctionnalité n'est pas encore ouverte. Aucune demande ne peut être enregistrée pour le moment."
