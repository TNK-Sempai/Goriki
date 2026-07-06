# MISSION 01 — CATALOGUE & IMPORTS (RYUU orchestre · ZARA exécute · REX en appui)

## Contexte projet (à lire avant tout)
- Goriki : boutique TCG mono-vendeur FR (Pokémon + One Piece), Next.js 16.2.9 + React 19 + Tailwind v4, Supabase (`qsejsgkuksojplhitebv`), Vercel, Stripe, Resend, Cloudinary.
- ⚠️ Divergences stack NON NÉGOCIABLES : pas de `tailwind.config.ts` (tokens dans `globals.css` via `@theme inline`) · `cookies()` async → `await createClient()` partout server-side · le middleware Next.js s'appelle `proxy.ts` (export `proxy`) · `use(params)` pour les routes dynamiques.
- La base de données est actuellement VIDE (toutes tables à 0 ligne). L'objectif final de cette mission est un catalogue complet et correct en base.

## Problèmes constatés (audit + retours utilisateur)
1. **Sets Pokémon importés sans leurs cartes** : le pipeline d'import (`/api/import/pokemon`, single/bulk/sync) ramène les sets mais pas le détail des cartes dans certains modes. Diagnostiquer lequel des trois modes est troué et le réparer.
2. **Mapping sets → séries/époques incorrect** : certains sets sont rangés dans la mauvaise série. La fonction `detectSerie` a déjà été réécrite une fois. RÈGLE ABSOLUE : interroger la base AVANT d'écrire la logique (`SELECT DISTINCT LEFT(code,2), COUNT(*) FROM pokemon_sets GROUP BY 1`) — ne JAMAIS supposer les codes. Codes réels connus : `SV*`, `SW*`, `SM*`, `XY*`, `BW*`, `ME*`, `A*/B*`. Préférer un mapping data-driven (table ou constante générée depuis TCGdex) à des regex devinées.
3. **One Piece totalement absent des données** : l'import `/api/import/onepiece` gère le cas « API OPECards indisponible » — diagnostiquer si OPECards répond aujourd'hui. Si l'API est morte : le SIGNALER dans la livraison avec 2-3 alternatives sourcées (ne pas improviser une source non validée), et livrer au minimum le pipeline prêt à brancher.
4. **Terminal admin muet** : les pages `/admin/import/*` ne donnent pas assez de détail. Ajouter un retour d'exécution détaillé : compteur sets/cartes importés, erreurs par item, durée, log scrollable dans la page (pas de console.log).

## Rappels techniques connus
- URLs images TCGdex : les logos exigent `.png` appendu, les cartes `/high.webp`. Pattern de détection existant : `url.match(/\.(png|jpg|webp|svg)$/) ? url : url + '.png'`.
- Types de variantes (NORMAL, REVERSE, HOLO, FIRST_EDITION) : chargés dynamiquement depuis les tables `*_variant_types` — JAMAIS hardcodés.
- Reset de données : TRUNCATE + repopulation complète, pas de patch incrémental.

## Livrables
1. Pipeline d'import Pokémon réparé : sets + cartes + variantes, mapping séries correct.
2. Pipeline One Piece fonctionnel OU diagnostic documenté + alternatives.
3. Pages `/admin/import/*` avec retour d'exécution détaillé.
4. Sécurisation : `GET /api/import/pokemon` et `GET /api/import/onepiece` actuellement SANS auth → exiger admin.
5. Ré-import complet exécuté et vérifié (requêtes de contrôle : counts par set, sets sans cartes = 0).
6. PROJECT LOG mis à jour.

## Hors périmètre (interdiction de toucher)
- Tunnel d'achat, panier, checkout, Stripe (missions 02/03).
- Tout le design/CSS des pages publiques (mission 04).
- Dépôt-vente, rachat, scan, exports Cardmarket/eBay.

## Validation
- `npm run build` → 0 erreur.
- En base : chaque set a ses cartes ; aucun set orphelin ; séries/époques correctes (échantillon contrôlé sur 10 sets répartis sur les époques).
