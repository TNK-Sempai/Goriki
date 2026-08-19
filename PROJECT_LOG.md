# PROJECT LOG — Goriki
> Init : KAEL | Mis à jour : RYUU | Date : 2026-08-19

## Stack validée
- Framework : Next.js 16.2.9 App Router + React 19 (`cookies()` async → `await createClient()` partout ; routes dynamiques via `use(params)`)
- CSS : Tailwind v4 **SANS tailwind.config** — tokens dans `styles/globals.css` via `@import "tailwindcss"` + `@theme inline` + `@custom-variant dark` (⚠️ divergence assumée vs skill nextjs-multiagent v2 §5 qui prévoit un tailwind.config — le skill a tort pour CE projet, ne jamais recréer de config ; cf. CLAUDE.md)
- Animations : keyframes CSS dans `globals.css` (fade-in, slide-up, pulse-soft, shimmer) — pas de librairie motion
- DB : Supabase, projet `qsejsgkuksojplhitebv` (@supabase/ssr, cookies). Catalogue Pokémon repeuplé (mission 01 : 192 sets / 21 426 cartes / 29 113 listings). ✅ Migrations intégralement versionnées depuis la mission 03 : les 17 migrations distantes sont dans `supabase/migrations/` au format `<version>_<nom>.sql`, chacune vérifiée par md5 contre le SQL réellement appliqué (⚠️ voir signalement « historique non rejouable »)
- Auth : Supabase Auth (password + magic link, confirmation email). Rôles réels : binaire `customer`/`admin` (CHECK en base) — pas de rôle « déposant »
- Middleware : **`proxy.ts`** (export `proxy`) — `lib/supabase/middleware.ts` est un module ordinaire, pas le hook Next.js
- Paiement : Stripe Checkout Sessions (apiVersion `2026-05-27.dahlia`), webhook traitant `checkout.session.completed`, `checkout.session.expired` et `payment_intent.payment_failed` (mission 03). Crédit boutique via **coupon Stripe** (un line item négatif est refusé par l'API). Commande à 0 € : Stripe court-circuité
- Emails : Resend (`order-confirmed` au webhook, `order-shipped` à la saisie du n° de suivi — mission 03 ; `welcome.ts` toujours non branché). ⚠️ `RESEND_API_KEY` est un placeholder : les envois échouent, l'échec est loggé et non bloquant
- Images : Cloudinary (upload photos listings) ; URLs TCGdex sans extension (logos → `.png`, cartes → `/high.webp`)
- PDF : @react-pdf/renderer (factures `/api/invoice/[id]`)
- Graphes : Recharts (admin)

## Fichiers clés
| Fichier | Rôle | Agent responsable |
|---|---|---|
| app/layout.tsx | Providers, fonts, metadata | KAEL |
| styles/globals.css | Tokens CSS, thèmes light/dark, keyframes, utilities | NOVA |
| proxy.ts | Middleware Next.js (nom imposé v16) | KAEL |
| lib/supabase/server.ts | `createClient()` async (cookies async) | KAEL |
| lib/supabase/middleware.ts | Session + garde admin — lit `profiles.role` depuis la mission 03 | KAEL |
| lib/supabase/service.ts | Client service-role (bypass RLS), serveur uniquement — requis pour `order_items` et les RPC de stock | ZARA (mission 03) |
| lib/orders/finalize.ts | `finalizeOrder()` — chemin UNIQUE `pending` → `paid`, partagé webhook / bypass 0 € | ZARA (mission 03) |
| lib/stripe.ts | Client Stripe unique | KAEL |
| lib/resend.ts | Client Resend | KAEL |
| lib/cloudinary.ts | Client Cloudinary | KAEL |
| lib/constants.ts | `NEXT_PUBLIC_APP_URL` fallback localhost:3000 | KAEL |
| lib/utils.ts | `cn` / `formatPrice` / `slugify` uniquement | KAEL |
| lib/types.ts | ⚠️ Fichier vide (0 octet) | KAEL |
| hooks/useCart.ts | Panier client + événements `goriki:cart-updated`/`goriki:cart-open` (sync inter-instances, ouverture drawer) | ZARA |
| components/product/AddToCartButton.tsx | CTA panier fiche produit (validation via POST /api/cart) | ZARA |
| lib/shipping.ts | Abstraction livraison `ShippingProvider` / `FlatRateProvider` (tarifs dans lib/constants.ts) | ZARA |
| app/api/stripe/webhook/route.ts | Création commande post-paiement (service-role) | KAEL |
| lib/tcgdex.ts | Client TCGdex typé (briefs de set vs détails de carte séparés) | ZARA |
| lib/import/pokemon.ts | Moteur d'import partagé route/script : sets+séries, détails cartes (pool 8), listings par variantes réelles, `ignoreDuplicates` | ZARA |
| app/api/import/pokemon/route.ts | Import Pokémon (GET/single/bulk/sync), admin requis partout, contrat `{ok,logs,stats}` | ZARA |
| app/api/import/onepiece/route.ts | Import One Piece — même contrat, dégradation explicite OPECards down | ZARA |
| scripts/import-catalogue-pokemon.ts | Ré-import CLI service-role (`npx tsx`, `--set/--all/--from`) | ZARA |
| components/admin/ImportLogPanel.tsx | Terminal d'import : log scrollable + compteurs + erreurs par item | ZARA |
| app/api/invoice/[id]/route.ts | Facture PDF (coordonnées vendeur en dur) | — |
| components/admin/Sidebar.tsx | Sidebar admin 200px fixe | — |
| ETAT-DES-LIEUX.md (racine Goriki) | Audit 2026-07-06 — source de vérité état du code | KAEL |
| CLAUDE.md | Règles projet lues par toute session | KAEL |

## Tokens CSS actifs
Source : `styles/globals.css` (constaté, pas théorique). Thème par défaut = light ; dark via `[data-theme="dark"]`.

| Token | Valeur (light) | Valeur (dark) | Usage |
|---|---|---|---|
| --bg | #E8E1D8 | #0C0A07 | Fond de page |
| --surface-1 | #DDD6CC | #141108 | Surface niveau 1 |
| --surface-2 | #D4CECE | #1C180E | Surface niveau 2 |
| --amber | #C8860A | #D4900C | Accent principal (bouton primaire unique) |
| --amber-light | #D4900C | #F0AB24 | Accent hover |
| --cream | #1A1008 | #EEE4CC | Texte principal |
| --muted | rgba(26,16,8,0.4) | #7A6E5C | Texte secondaire |
| --border | rgba(26,16,8,0.08) | rgba(212,144,12,0.18) | Bordures |
| --border-dim | rgba(26,16,8,0.05) | rgba(255,255,255,0.06) | Bordures discrètes |
| --font-display | "Playfair Display", Georgia, serif | idem | Titres (h1–h6) |
| --font-body | "DM Sans", system-ui, sans-serif | idem | Corps |
| --animate-fade-in | fadeIn 0.3s ease-out | idem | Animation |
| --animate-slide-up | slideUp 0.3s ease-out | idem | Animation |
| --animate-pulse-soft | pulseSoft 2s ease-in-out infinite | idem | Animation |
| --animate-shimmer | shimmer 1.5s infinite | idem | Skeletons |

Utilities exposées dans `@layer utilities` : `.text-amber`, `.text-amber-light`, `.text-cream`, `.text-muted`, `.bg-base`, `.bg-surface-1`, `.bg-surface-2`, `.bg-amber`, `.border-goriki`, `.border-dim`, `.font-display`, `.font-body`, `.text-bg` + guard `prefers-reduced-motion`.

## Décisions d'architecture validées
| # | Décision | Par | Raison | Irréversible ? |
|---|---|---|---|---|
| 1 | Next.js 16.2.9 App Router + React 19 | Existant (constaté audit) | Socle du projet | Oui |
| 2 | Tailwind v4 sans tailwind.config — tokens en `@theme inline` dans globals.css | Existant, entériné par CLAUDE.md | Convention Tailwind v4 ; override explicite du skill v2 | Oui (interdiction de recréer un config) |
| 3 | Middleware nommé `proxy.ts` (export `proxy`) | Existant (Next.js 16) | Convention Next 16 | Oui |
| 4 | Dark mode par variables CSS commutées `data-theme` (pas de classes `dark:` Tailwind brutes) | Existant | Thème par tokens | Non |
| 5 | Public en light par défaut, admin verrouillé en dark (`app/admin/layout.tsx`) | Existant, entériné par CLAUDE.md | Identité visuelle validée | Non |
| 6 | Prix construits côté serveur au checkout (relus en base, jamais ceux du client) | Existant | Sécurité paiement | Oui |
| 7 | `price_cm` et données pokemon-api.com ADMIN ONLY | CLAUDE.md | Règle métier | Oui |
| 8 | Types de variantes chargés depuis `*_variant_types`, jamais hardcodés | CLAUDE.md | Données dynamiques | Oui |
| 9 | Boutique FR uniquement ; collecte adresse Stripe BE/FR/LU/NL/DE, devise EUR | Existant / CLAUDE.md | Périmètre commercial | Non |
| 10 | Doctrine animations STANDARD : fade-in / slide-up / hover 150ms, max 4 dans le projet | CLAUDE.md | Sobriété motion | Non |
| 11 | Mapping séries Pokémon DATA-DRIVEN : `serie_id`/`serie_name` (TCGdex) stockés sur `pokemon_sets` à l'import, groupement catalogue dessus — plus jamais de regex sur les codes | RYUU/ZARA/REX (mission 01) | Les codes de sets ne sont pas prévisibles (A1, P-A, SV03.5…) ; TCGdex fournit la série | Oui |
| 12 | Les imports ne créent des listings QUE s'ils n'existent pas (`ignoreDuplicates` sur `card_id,variant_type_id,condition`) — un ré-import n'écrase jamais quantity/price | RYUU/ZARA (mission 01) | Protéger le stock réel saisi par l'admin | Oui |
| 13 | « Tout importer » orchestré CÔTÉ CLIENT (boucle de POST single par set) — le bulk serveur reste pour usage direct mais dépasse le maxDuration 300s Vercel sur 192 sets | RYUU/ZARA (mission 01) | Terminal progressif + contournement timeout serverless | Non |
| 14 | Détail carte via `/v2/fr/cards/{id}` (pool de 8 concurrent, 1 retry, fallback dégradé) — le brief `/sets/{id}` ne contient NI rarity NI variants | ZARA (mission 01) | Seule source des variantes réelles par carte | Non (GraphQL TCGdex inutilisable, vérifié 07/2026) |
| 15 | **Le panier vit en base** : commande `pending` + `order_items` créés AVANT la session Stripe, seul `order_id` en metadata (+ `user_id`, `store_credit_used`) | KAEL (mission 03) | La metadata Stripe est plafonnée à 500 caractères — la sérialisation du panier cassait dès ~4 articles. La commande devant exister de toute façon, une table `checkout_sessions` aurait créé une 2ᵉ source de vérité | Oui |
| 16 | **Réservation de stock en table dédiée** `stock_reservations` (polymorphe), PAS de colonne `reserved_qty` | KAEL (mission 03) | 3 tables de stock → 1 table au lieu de 3 colonnes ; une réservation orpheline se libère avec sa commande, une colonne mal décrémentée dérive définitivement. Disponible = `quantity` − réservations dont la commande est `pending` et non expirée | Oui |
| 17 | TTL unique porté par `orders.checkout_expires_at` (35 min ; session Stripe à 31 min). Libération par 3 filets : `checkout.session.expired`, balayage au début de chaque checkout, `ON DELETE CASCADE` | KAEL (mission 03) | Deux TTL séparés divergent ; le stock doit se libérer même si le webhook n'arrive jamais | Non |
| 18 | Idempotence à 2 niveaux : table `stripe_events` (PK = `event.id`) + transition d'état sous verrou `FOR UPDATE` dans `finalize_paid_order` | KAEL (mission 03) | Le verrou couvre aussi les rejeux non-Stripe (chemin 0 €, event.id différent sur la même session), ce qu'un index unique seul ne fait pas | Oui |
| 19 | Toute la finalisation (verrou + décrément + crédit + écriture commande) dans UNE RPC transactionnelle ; seul l'email reste hors transaction | KAEL (mission 03) | Supprime la fenêtre « commande payée, stock non décrémenté ». En cas d'échec partiel de stock : `needs_review = true`, jamais de stock négatif | Oui |
| 20 | Crédit boutique via **coupon Stripe** (`amount_off`, `max_redemptions: 1`, `redeem_by`) et non via un line item négatif | ZARA (mission 03, découvert au test) | Stripe REFUSE `unit_amount` négatif (« Invalid non-negative integer ») — le mécanisme hérité de la mission 02 n'avait jamais pu fonctionner faute d'appel Stripe abouti | Oui |
| 21 | Commande à 0 € (crédit couvrant tout + port offert) : Stripe court-circuité, finalisation directe par le même chemin ; adresse reprise de la dernière commande du client, sinon `needs_review` | KAEL (mission 03) | Stripe refuse une session `payment` à 0 €. Sans Stripe, aucune adresse n'est collectée : la reprise est le seul recours sans nouvelle UI (hors périmètre) | Non |

## Composants produits
| Composant | Path | Agent | Statut |
|---|---|---|---|
| Hero | components/blocks/Hero.tsx | Existant (pré-LOG) | ⚠️ Code mort — bien conçu (responsive, skeletons) mais importé nulle part |
| CardGrid | components/catalogue/CardGrid.tsx | Existant (pré-LOG) | ⚠️ Code mort — idem |
| CardTile | components/catalogue/CardTile.tsx | Existant (pré-LOG) | ⚠️ Code mort — idem |
| SetGrid | components/catalogue/SetGrid.tsx | Existant (pré-LOG) | ⚠️ Code mort — idem |
| HeroCarousel | components/ (home) | Existant (pré-LOG) | Actif mais px fixes (h 440px, offset 200px) — cassé mobile |
| Navbar | components/ | Existant (pré-LOG) | Actif — aucun menu mobile/hamburger |
| Footer | components/ | Existant (pré-LOG) | Actif — bug copyright couleur claire en dur (invisible en dark) |
| CartDrawer | components/ | Existant (pré-LOG) | Actif, responsive, aux tokens — bon exemple |
| LoginForm / RegisterForm | components/auth/ | Existant (pré-LOG) | Actifs (`alert()` pour magic link à revoir) |
| Sidebar admin | components/admin/Sidebar.tsx | Existant (pré-LOG) | Actif — 200px fixe, entrée `/admin/depot-vente` désactivée (page inexistante) |
| MassListingTable | components/admin/ | Existant (pré-LOG) | Actif — seul tableau admin avec `overflow-x-auto` |

| AddToCartButton | components/product/AddToCartButton.tsx | ZARA (mission 02) | Actif — CTA fiche produit, validation serveur /api/cart, gère épuisé/désactivé/stock max, ouvre le CartDrawer |
| FlatRateProvider (module) | lib/shipping.ts | ZARA (mission 02) | Actif — interface ShippingProvider swappable (Sendcloud possible sans toucher au checkout) ; tarifs `SHIPPING_RATES` dans lib/constants.ts, placeholder à valider |

## Bugs résolus
| Bug | Cause racine | Fix | Par |
|---|---|---|---|
| Sets importés « sans cartes » (catalogue vide à l'écran) | Double cause : (a) `/sets/{id}` TCGdex ne renvoie pas `variants` → `listingsToCreate=[]` → 0 listing créé, or les pages catalogue affichent les listings ; (b) tables `*_variant_types` vides (seed jamais joué) | Moteur `lib/import/pokemon.ts` : détails cartes via `/cards/{id}` (pool 8), listings sur variantes réelles + fallback NORMAL ; seed des variantes en migration 0014 | ZARA-A + RYUU (mission 01) |
| Sync muet sur 15 sets TCG Pocket (A1, P-A, B1…) | `fetchSet(code.toLowerCase())` : les ids TCGdex sont case-sensibles, 404 avalé par un catch vide | Résolution id API via map code→id construite depuis `fetchSets()` ; plus aucun catch vide | ZARA-A (mission 01) |
| Erreurs d'upsert carte invisibles en bulk (Pokémon ET One Piece) | `if (!cardRow) continue` sans log ni compteur | Chaque échec → logs + `stats.errors[{item,message}]`, affichés dans ImportLogPanel | ZARA-A / ZARA-B (mission 01) |
| Mauvais classement de sets par série | `detectSerie()` = regex devinées sur le code | Supprimé — groupement sur `serie_name` en base (source TCGdex), ordre chronologique, « Autres » en dernier | REX (mission 01) |
| `/checkout` redirigeait TOUJOURS vers `/panier`, même panier plein (constaté E2E : navigation directe ET clic « Commander ») | `useCart` initialise `items` à `[]` et n'hydrate depuis sessionStorage qu'en `useEffect` ; le `router.push('/panier')` s'exécutait pendant le premier render, avant hydratation | Flag `hydrated` + redirection déplacée en `useEffect` ; `return null` tant que non hydraté ou panier vide (`app/checkout/page.tsx`) | REX (mission 02) |
| Crédit boutique : Stripe rejetait la session avec « Invalid non-negative integer » dès qu'un crédit était appliqué | `unit_amount` négatif dans un `price_data` — interdit par l'API Stripe. Jamais détecté car aucun appel Stripe n'avait pu aboutir avant la mission 03 (clé placeholder) | Coupon Stripe à usage unique (`amount_off`) + `discounts: [{coupon}]` (`app/api/stripe/checkout/route.ts`) | ZARA (mission 03) |
| Survente possible entre l'ajout au panier et le paiement | La validation lisait `quantity` sans tenir compte des paniers concurrents en cours de paiement | Réservation atomique sous verrou de ligne (`reserve_order_stock`) : disponible = stock − réservations actives. Vérifié : stock 9, 2 réservés, tentative de 8 → 409 | ZARA (mission 03) |
| `orders.shipping_cost` toujours à 0 alors que le port était encaissé | Colonne NOT NULL jamais écrite : aucun writer dans le code | Extraction de `session.shipping_cost.amount_total` au webhook, écriture dans la RPC de finalisation ; lignes port + crédit ajoutées à la facture PDF | ZARA (mission 03) |
| Le panier survivait au paiement (sessionStorage jamais purgé) | Aucun appel à `clearCart` après la commande | `components/cart/CartCleaner.tsx` monté sur `/checkout/success` | ZARA (mission 03) |

## Signalements en attente
Issus de l'audit ETAT-DES-LIEUX.md du 2026-07-06. Priorités : P0 = bloque toute vente, P1 = bloquant avant encaissement réel, P2 = important, P3 = qualité/dette.

| Signalement | Par | Priorité | Décision RYUU |
|---|---|---|---|
| CTA « Ajouter au panier » mort : `<button>` sans onClick (`app/[slug]/page.tsx:191-208`), `useCart.addItem` appelé nulle part → /panier et /checkout inatteignables, aucune vente possible | KAEL (audit) | P0 | ✅ Résolu mission 02 (AddToCartButton + événements useCart) |
| Webhook Stripe sans idempotence (aucun contrôle `event.id` / `stripe_session_id` existant) → retry Stripe = commande, décrément stock et déduction store_credit dupliqués | KAEL (audit) | P1 | ✅ Résolu mission 03 — 2 niveaux (table `stripe_events` + verrou d'état). Vérifié : 3 livraisons webhook → 1 commande, stock décrémenté une seule fois |
| Base Supabase vide (0 ligne partout) : imports catalogue à rejouer avant ouverture | KAEL (audit) | P1 | ✅ Résolu mission 01 — 192 sets / 21 426 cartes / 29 113 listings Pokémon (purge + repopulation service-role, contrôles OK). One Piece reste vide (source morte, voir signalement OPECards) |
| Incohérence source de vérité rôle : middleware lit `app_metadata.role === 'admin'` (`lib/supabase/middleware.ts:37`) vs layout admin + toutes les API lisent `profiles.role === 'admin'` — un admin défini d'un seul côté est bloqué | KAEL (audit) | P1 | ✅ Résolu mission 03 — middleware unifié sur `profiles.role`. Contrôlé AVANT bascule : le compte unique avait les deux (`profiles.role='admin'` ET `app_metadata.role='admin'`), aucun risque de verrouillage. Vérifié APRÈS : `/admin` → 200 en admin, 307 vers `/` en customer |
| Migrations non versionnées : `goriki/supabase/migrations/` vide alors que 13 migrations existent en distant ; policies RLS non versionnées (contenu exact à vérifier) | KAEL (audit) | P1 | ✅ Résolu mission 03 — 16/16 migrations dans le dépôt (RLS incluses), md5 vérifié contre le distant |
| Aucun code remboursement : statut `refunded` = simple UPDATE, sans refund Stripe, ré-incrément stock ni ré-crédit | KAEL (audit) | P2 | ✅ Résolu mission 03 — `stripe.refunds.create` + `restock_order` + re-crédit ; statut modifié seulement si Stripe confirme. Vérifié sur un vrai paiement de test (105 € remboursés, stock 9→10). Remboursement PARTIEL hors périmètre (V2) |
| Frais de port : UI annonce « Calculée par Stripe » mais aucun `shipping_options` configuré → livraison de fait gratuite | KAEL (audit) | P2 | ✅ Résolu mission 02 (lib/shipping.ts + shipping_options ; ⚠️ tarifs placeholder `// TODO tarifs à valider`) |
| Événements Stripe non gérés : `payment_intent.payment_failed`, `checkout.session.expired`, litiges ; décrément stock non atomique (read-then-write), pas de réservation au checkout (survente possible), pas de rollback sur les inserts webhook | KAEL (audit) | P2 | ✅ Résolu mission 03 (sauf litiges → TODO V2) — les 2 événements traités, décrément en RPC transactionnelle, réservation de stock, échec partiel → `needs_review` |
| `GET /api/import/pokemon` et `GET /api/import/onepiece` : aucune authentification (impact limité : proxy vers API externes) | KAEL (audit) | P2 | ✅ Résolu mission 01 — `requireAdmin()` sur tous les handlers des deux routes, GET compris |
| API OPECards MORTE : le domaine `api.opecards.fr` ne résout plus (DNS, vérifié 06/07/2026) → import One Piece impossible en l'état. Pipeline durci et « prêt à brancher ». Alternatives sondées : `optcgapi.com` (200, JSON sets/cards, gratuit) et `apitcg.com` (200, multi-TCG, clé API requise) — données EN, pas FR ; `onepiece-cardgame.dev` (403). DÉCISION UTILISATEUR REQUISE avant branchement | RYUU (mission 01) | P1 (si One Piece requis à l'ouverture) | En attente décision utilisateur — cf. 00_ORDONNANCEMENT « décisions ouvertes » |
| 6 sets sans cartes CÔTÉ SOURCE TCGdex FR (B1, B1A, B2 Pocket récents ; JUMBO, RC, WP historiques) → désactivés (`is_active=false`) pour ne pas afficher de sets vides. À réactiver si TCGdex les complète (le sync réimportera les cartes mais ne réactive pas tout seul) | RYUU (mission 01) | P3 | Désactivation appliquée en base |
| Carte Zarbi « ? » (id TCGdex `exu-?`) : l'id casse l'URL de détail → importée en mode dégradé (sans rareté, listing NORMAL). 21 425/21 426 cartes complètes | RYUU (mission 01) | P3 | Accepté — cas unique, données non critiques |
| Sets TCG Pocket (jeu NUMÉRIQUE : 15 sets, série `tcgp`) importés et affichés dans le catalogue d'une boutique de cartes PHYSIQUES — comportement historique conservé. À confirmer : faut-il les désactiver ? | RYUU (mission 01) | P2 | En attente décision utilisateur |
| Perf sync : 1 seule carte manquante dans un set → refetch complet du set (réutilisation du moteur unique, idempotent). Acceptable aujourd'hui, à arbitrer si volumes gênants | ZARA-A (mission 01) | P3 | Accepté en l'état |
| `GET /api/listings` accessible à tout utilisateur connecté alors qu'il expose des données de gestion (listings inactifs, `needs_photo`) | KAEL (audit) | P2 | ✅ Résolu mission 03 — contrôle `profiles.role = admin`, vérifié : 403 en compte client |
| Pills de filtre statut `/admin/commandes` sans onClick — purement décoratives | KAEL (audit) | P2 | À trier |
| `POST /api/cart` (validation prix/stock) écrit mais appelé nulle part côté client | KAEL (audit) | P2 | ✅ Résolu mission 02 (appelé à chaque ajout par AddToCartButton) |
| Parcours d'achat mobile inutilisable : Navbar sans menu mobile, HeroCarousel/home en px fixes, grilles `repeat(N,1fr)` sans breakpoint, fiche produit et panier sans passage en colonne | KAEL (audit) | P2 | À trier |
| Code mort responsive : Hero, CardGrid, CardTile, SetGrid conçus responsive mais importés nulle part — les pages réimplémentent en inline sans breakpoint | KAEL (audit) | P3 | À trier — candidats au rebranchement plutôt qu'à la réécriture |
| Deux paradigmes de style concurrents (inline `style={{}}` + var CSS vs classes Tailwind tokens) → deux styles de bouton « commander » (crème vs ambre) ; identité validée = un seul bouton primaire ambre | KAEL (audit) | P3 | À trier |
| Footer : copyright couleur claire en dur quasi invisible en dark (`Footer.tsx:38`) ; composants en palette Tailwind brute (`bg-red-950/30`…) ne suivant pas le thème | KAEL (audit) | P3 | À trier |
| Tableaux admin en colonnes px fixes sans `overflow-x-auto` (dashboard, commandes, clients, produits, stats) ; sidebar 200px sans version mobile — admin desktop-only assumé, priorité basse | KAEL (audit) | P3 | À trier |
| `/admin/stats` self-fetch via `NEXT_PUBLIC_APP_URL` : valeur incorrecte en prod = page silencieusement vide ; `/admin` duplique la logique de `/api/stats` | KAEL (audit) | P3 | À trier |
| Adresse affichée en `JSON.stringify` brut (`compte/commandes/[id]:82-83`) ; wishlist en N+1 (une requête par item) | KAEL (audit) | P3 | À trier |
| `lib/types.ts` vide (0 octet) ; `alert()` dans LoginForm et checkout | KAEL (audit) | P3 | À trier (le `router.push` en render de /checkout : ✅ résolu mission 02 — voir Bugs résolus) |
| Branchement `order-shipped.ts` / `welcome.ts` non tracé jusqu'à un appelant ; `npm run build` jamais exécuté (compilation Next 16 à confirmer) | KAEL (audit) | P3 | 🟠 Partiellement résolu mission 03 — `order-shipped` branché sur la première saisie d'un n° de suivi (`PATCH /api/commandes`) ; `welcome.ts` toujours orphelin. `npm run build` : 0 erreur |
| Historique de migrations NON REJOUABLE : les 6 premières migrations (mars/avril 2026) visent un schéma abandonné (`extensions`, `blog_posts`, `pokemon_listings.variant/condition_id`) remplacé par `001`→`007` en juin. Le dossier est donc une HISTOIRE fidèle, pas un script de reconstruction : `supabase db reset` échouerait | RYUU (mission 03) | P2 | À trier — une baseline squashée exige `supabase db pull` avec le mot de passe Postgres (non disponible en session) |
| Policy `Profiles — lecture publique` : `USING (true)` sur `profiles` → n'importe quel visiteur peut lire tous les emails, `store_credit` et `role` via l'API REST | RYUU (mission 03, hors périmètre) | P1 | ✅ Résolu 2026-08-19 (demande utilisateur, migration `0017`) — remplacée par `USING (auth.uid() = id OR is_admin())`. Vérifié sur `/rest/v1/profiles` : anonyme 0 ligne, client 1 ligne (la sienne) sur 2 profils, admin 2 lignes |
| Les commandes `pending` (checkouts en cours, TTL 35 min) apparaissent dans la liste admin `/admin/commandes` puis disparaissent à l'expiration | RYUU (mission 03) | P3 | À trier — filtrer la liste admin sur `status <> 'pending'` si le bruit gêne |
| Advisories Supabase préexistants : `search_path` mutable sur `update_updated_at` / `handle_new_user` / `set_needs_photo` ; `handle_new_user` et `is_admin` (SECURITY DEFINER) exécutables par `anon`/`authenticated` ; protection « mots de passe compromis » désactivée | RYUU (mission 03) | P2 | À trier — antérieurs à la mission, aucun objet créé en 03 n'est concerné. ⚠️ Depuis la migration `0017`, l'EXECUTE de `is_admin()` par `anon`/`authenticated` est **nécessaire** : la policy SELECT de `profiles` l'évalue avec les droits de l'appelant. Le révoquer casserait la lecture des profils — ne pas « corriger » cet advisory-là |
| Chantiers absents (zéro ligne de code) : cycle dépôt-vente complet (tables `consignment_items`/`buyback_requests` existantes en base mais orphelines, taux unique 15 % sans paliers 30/25/20/15, pas de `gross_amount`/`payout`/`vat_scheme`, pas de rôle déposant), scan de cartes IA, exports Cardmarket/eBay | KAEL (audit) | P2 (post-ouverture possible) | À trier — features V2, pas des bugs |
| ⚠️ `STRIPE_SECRET_KEY` du `.env.local` = placeholder (9 caractères, ni sk_test_ ni sk_live_) → AUCUN appel Stripe ne peut aboutir ; le paiement E2E et la validation « frais de port visibles » sont bloqués tant qu'une vraie clé de TEST (sk_test_) + STRIPE_WEBHOOK_SECRET ne sont pas renseignés | RYUU (mission 02, E2E) | P1 | ✅ Résolu 2026-08-19 — `sk_test_`/`pk_test_`/`whsec_` renseignés (le `whsec_` correspond bien à celui de `stripe listen`, vérifié sans affichage). ⚠️ Des clés **live** avaient d'abord été posées par erreur : signalé et remplacées avant tout test |
| ⚠️ `RESEND_API_KEY` = placeholder (9 caractères, pas de préfixe `re_`) → aucun email ne part (confirmation de commande, expédition). L'échec est capturé et loggé, jamais bloquant pour la commande | RYUU (mission 03) | P2 | En attente d'une vraie clé `re_` — le branchement est fait et testable immédiatement après |
| Session Stripe à total 0 € possible : si `creditToApply === subtotal` ET livraison offerte (≥ 60 €), la Checkout Session n'a plus aucun montant → Stripe refusera la création en mode `payment`. Bug pré-existant rendu atteignable par la gratuité de port | KAEL (spec mission 02) | P2 | ✅ Résolu mission 03 — Stripe court-circuité, commande créée par le même chemin de finalisation. Vérifié : commande 70 € réglée par crédit, total 0 €, sans session Stripe |
| Choix de zone de livraison déclaratif : le client peut cocher « Belgique 5 € » avec une adresse FR (hosted Checkout fixe les options avant l'adresse) — display_name explicites en mitigation ; contrôle a posteriori à envisager | KAEL (spec mission 02) | P3 | Mission 03 (contrôle zone/adresse au webhook) ou passage Embedded Checkout |
| `useCart.addItem` plafonne silencieusement à `maxQuantity` (pas de feedback lors d'un incrément depuis drawer/panier) ; bouton AddToCartButton `disabled` garde `cursor: pointer` | KAEL (spec mission 02) | P3 | Mission 04 (feedback UI) |
| `/checkout` ne revalide pas tout le panier via `/api/cart` avant `/api/stripe/checkout` (la route Stripe revalide en base — non bloquant, UX d'erreur perfectible) ; `/api/cart` en N+1 (1 requête/item) | KAEL (spec mission 02) | P3 | Différé |

## Journal de session
### Session 1 — 2026-07-06
Demande : Initialiser le PROJECT_LOG.md du projet Goriki à partir de l'audit ETAT-DES-LIEUX.md (Brief #1 de RYUU).
Agents actifs : KAEL (init du LOG).
Produit : `goriki/PROJECT_LOG.md` — stack validée, fichiers clés, tokens CSS réels relevés dans `styles/globals.css`, décisions d'architecture, inventaire composants, signalements de l'audit triés par priorité.
Prochaine étape : Mission 01 CATALOGUE_IMPORTS en cours de lancement par RYUU (repopulation de la base vide).

### Session 2 — 2026-07-06 (mission 02 TUNNEL_ACHAT, session parallèle à la 01)
Demande : Mission 02 — tunnel d'achat complet (CTA panier mort, /api/cart orpheline, shipping_options absents).
Agents actifs : RYUU (orchestration), KAEL (spec architecture : événements custom vs Context → événements ; interface ShippingProvider), ZARA (implémentation 8 fichiers), REX (fix redirection /checkout).
Produit :
- Ajout au panier fonctionnel : `AddToCartButton` (validation serveur POST /api/cart à chaque ajout) + événements `goriki:cart-updated`/`goriki:cart-open` dans useCart (sync inter-instances, ouverture du CartDrawer). Cas gérés : épuisé, produit désactivé, quantité max = stock, prix modifié.
- Livraison : `lib/shipping.ts` (ShippingProvider/FlatRateProvider swappable) + `SHIPPING_RATES` dans lib/constants.ts (BE 5 €, UE-proche 8 €, offert dès 60 € — `// TODO tarifs à valider`) + `shipping_options` branchés dans la Checkout Session ; seuil de gratuité évalué sur le sous-total marchandises AVANT store_credit (décision KAEL).
- Bug bloquant découvert et corrigé : `/checkout` redirigeait toujours vers `/panier` (router.push pendant le render, avant hydratation du panier) — fix REX.
- Note coordination : deux PROJECT_LOG.md créés en parallèle par les sessions 01 et 02 (course à l'init) → celui-ci (`goriki/PROJECT_LOG.md`) est le CANONIQUE ; celui de la racine converti en pointeur.
Validation : `npm run build` 0 erreur · E2E Edge headless 11/12 PASS (login → fiche → ajout → drawer → panier → checkout ; refus quantité > stock ; refus prix falsifié ; sous-total recalculé) · FlatRateProvider testé unitairement (2 zones sous le seuil, gratuité à 60 € pile) · données de test purgées.
⚠️ Étape paiement NON exécutée : `STRIPE_SECRET_KEY` placeholder dans .env.local (voir signalement P1). Dès que des clés de TEST sont renseignées : relancer le parcours, payer en 4242 4242 4242 4242, vérifier frais de port visibles + commande/stock/store_credit en base.
Prochaine étape : mission 03 STRIPE_COMPLET (webhook idempotent, remboursements, cas 0 €) — nécessite les clés de test.

### Session 3 — 2026-07-06 (mission 01 CATALOGUE_IMPORTS, session parallèle à la 02)
Demande : Mission 01 — pipeline d'import Pokémon réparé (sets+cartes+variantes, séries correctes), One Piece fonctionnel ou diagnostiqué, terminal admin détaillé, GET d'import sécurisés, ré-import complet vérifié.
Agents actifs : RYUU (orchestration + diagnostic + migration + ré-import), KAEL (init LOG), ZARA-A (moteur import Pokémon, route, script CLI, migration versionnée), ZARA-B (route One Piece, ImportLogPanel, pages admin), REX (mapping séries data-driven).
Diagnostic clé (vérifié sur l'API réelle) : le brief `/sets/{id}` TCGdex ne contient ni variantes ni raretés → 0 listing créé (cause racine « sets sans cartes ») ; tables `*_variant_types` vides ; sync cassé sur les 15 ids case-sensibles Pocket ; OPECards mort (DNS).
Produit :
- Migration `0014` (appliquée + versionnée) : colonnes `serie_id`/`serie_name` sur pokemon_sets, seed variantes NORMAL/REVERSE/HOLO/FIRST_EDITION (Pokémon, global) et STANDARD (One Piece).
- `lib/import/pokemon.ts` (moteur partagé route/script) + route Pokémon réécrite (admin partout, contrat `{ok,logs,stats}`, sync fixé) + `scripts/import-catalogue-pokemon.ts` (service-role, `--set/--all/--from`).
- Route One Piece durcie (mêmes fixes, 503 explicite OPECards down) ; `ImportLogPanel` étendu (compteurs, erreurs par item, durée) ; « Tout importer » orchestré client set par set (progressif, sans timeout).
- Catalogue : groupement par `serie_name` en base (regex `detectSerie` supprimée).
- Ré-import exécuté : purge (aucune donnée réelle en jeu — vérifié : 0 commande/wishlist/stock) puis 192 sets / 21 426 cartes / 29 113 listings / 19 séries. Contrôles : 0 set actif sans cartes (6 sets vides côté source désactivés), 0 set sans série, 0 carte sans listing, 21 425/21 426 raretés, échantillon 12 sets sur toutes les époques 1999→2025 = 12/12 corrects.
Validation : `npm run build` 0 erreur (inclut le code Session B en l'état à 15:45).
Découverte : la base n'était PAS vide (compteurs « 0 ligne » de l'outil MCP = estimations périmées) — ancien import dégradé purgé selon la règle TRUNCATE+repopulation. Un compte admin existe (`profiles.role='admin'`).
Prochaine étape : décision utilisateur sur la source One Piece (optcgapi/apitcg) et sur l'affichage des sets TCG Pocket ; missions 03/04 selon ordonnancement.

### Session 4 — 2026-08-19 (mission 03 STRIPE_COMPLET + addendum)
Demande : Mission 03 — Stripe de A à Z (webhook fiable, réservation de stock, remboursements, vue paiements, sécurité) + addendum §F/§G (stockage panier en base AVANT tout, `shipping_cost` persisté, minimum de commande, cas 0 €, nettoyage base).
Agents actifs : RYUU (orchestration, prérequis, tests E2E), KAEL (architecture {panier serveur + réservation}, décisions #15→#21), ZARA (implémentation, 12 fichiers + 2 migrations).
Prérequis : session interrompue une première fois — `03_ADDENDUM.md` introuvable dans le dépôt (fourni ensuite par l'utilisateur) et clés Stripe **live** posées par erreur dans `.env.local`, remplacées par des clés de test avant tout appel.
Produit :
- Migrations `0015` (colonnes de checkout, index unique `stripe_session_id`, tables `stock_reservations` / `stripe_events`, RLS, suppression de `decrement_stock_on_paid_order`) et `0016` (5 RPC : réservation, finalisation, ré-incrément, libération ciblée, balayage).
- Panier en base : commande `pending` + `order_items` créés avant Stripe ; metadata réduite à 3 clés courtes (36 car. max contre 1 697 pour un panier de 8 articles).
- Webhook réécrit : 3 événements, idempotence à 2 niveaux, finalisation transactionnelle partagée avec le chemin 0 €.
- Remboursement réel, vue paiements admin (liens profonds Stripe test/live), bannière `needs_review`.
- Sécurité : middleware sur `profiles.role`, `GET /api/listings` réservé aux admins, 16/16 migrations versionnées.
- `shipping_cost` persisté ; facture PDF complétée (sous-total, port, crédit) ; minimum de commande `MIN_ORDER_AMOUNT` (placeholder 5 €) ; `order-shipped` branché ; panier vidé après commande.
Validation : `npm run build` 0 erreur · 10 tests E2E sur clés de test (détail dans le rapport de livraison) · vrai remboursement Stripe de 105 € exécuté et vérifié · données de test purgées (0 commande, 0 réservation, 0 event, listings remis à price=0/quantity=0), utilisateur de test supprimé.
Découverte majeure : le crédit boutique en line item négatif (mission 02) était **cassé depuis l'origine** — Stripe refuse `unit_amount` négatif. Jamais visible avant, faute de clé Stripe réelle. Remplacé par un coupon.
⚠️ Non exécuté : le paiement par carte 4242 sur la page hébergée Stripe (aucun runner navigateur installé) — le contrat webhook a été éprouvé avec des événements signés portant la vraie session. Seule étape manuelle restante.
Correctif post-livraison (même session, demande utilisateur) : migration `0017` — la policy `Profiles — lecture publique` (`USING (true)`) est remplacée par `USING (auth.uid() = id OR is_admin())`. Vérifié directement sur `/rest/v1/profiles` : anonyme 0 ligne, client connecté 1 ligne (la sienne) sur 2 profils, admin 2 lignes. Les 26 lectures de `profiles` du code ont été auditées avant bascule : toutes lisent soit le profil du demandeur, soit avec une session admin, soit en service-role. `is_admin()` étant SECURITY DEFINER, aucune récursion de policy. 17/17 migrations versionnées.
Prochaine étape : paiement manuel de bout en bout, vraie clé Resend, décision sur `MIN_ORDER_AMOUNT` et les tarifs de port, puis mission 04 (design/responsive).
