# PROJECT LOG — Goriki
> Init : KAEL | Mis à jour : RYUU | Date : 2026-08-19

## Stack validée
- Framework : Next.js 16.2.9 App Router + React 19 (`cookies()` async → `await createClient()` partout ; routes dynamiques via `use(params)`)
- CSS : Tailwind v4 **SANS tailwind.config** — tokens dans `styles/globals.css` via `@import "tailwindcss"` + `@theme inline` + `@custom-variant dark` (⚠️ divergence assumée vs skill nextjs-multiagent v2 §5 qui prévoit un tailwind.config — le skill a tort pour CE projet, ne jamais recréer de config ; cf. CLAUDE.md)
- Animations : **motion system débridé** (2026-08-21) — Lenis (smooth scroll), GSAP + ScrollTrigger (reveals), framer-motion (`AnimatePresence` dans `template.tsx`), canvas maison pour le morph d'univers. Keyframes CSS résiduelles dans `globals.css`. Doctrine à signatures nommées, cf. CLAUDE.md
- DB : Supabase, projet `qsejsgkuksojplhitebv` (@supabase/ssr, cookies). Catalogue Pokémon (mission 01 : 192 sets / 21 426 cartes / 29 113 listings) ET One Piece (Poneglyphe : 30 sets / 1 721 cartes / 1 721 listings). ✅ Migrations intégralement versionnées depuis la mission 03 : les 18 migrations distantes sont dans `supabase/migrations/` au format `<version>_<nom>.sql`, chacune vérifiée par md5 contre le SQL réellement appliqué (⚠️ voir signalement « historique non rejouable »)
- Auth : Supabase Auth (password + magic link, confirmation email). Rôles réels : binaire `customer`/`admin` (CHECK en base) — pas de rôle « déposant »
- Middleware : **`proxy.ts`** (export `proxy`) — `lib/supabase/middleware.ts` est un module ordinaire, pas le hook Next.js
- Paiement : Stripe Checkout Sessions (apiVersion `2026-05-27.dahlia`), webhook traitant `checkout.session.completed`, `checkout.session.expired` et `payment_intent.payment_failed` (mission 03). Crédit boutique via **coupon Stripe** (un line item négatif est refusé par l'API). Commande à 0 € : Stripe court-circuité
- Emails : Resend (`order-confirmed` au webhook, `order-shipped` à la saisie du n° de suivi — mission 03 ; `welcome.ts` supprimé au nettoyage du 2026-08-19, jamais branché). ⚠️ `RESEND_API_KEY` est un placeholder : les envois échouent, l'échec est loggé et non bloquant
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

| 22 | Couche de tokens v3 **ADDITIVE** dans `globals.css` : radius sémantiques (`--radius-control/panel/panel-lg/block/hero`), couleurs `ink/ochre/parchment`, classes `.glass*`, `.btn-ochre`, `.scan-pending`. L'ancienne échelle Tailwind (`rounded-sm/md/lg`) n'est PAS redéfinie | KAEL/NOVA (portage visuel) | Redéfinir `rounded-md` aurait modifié silencieusement l'admin et tous les écrans non encore portés | Non |
| 23 | Gradient de fond v3 appliqué à `body` **sauf en thème sombre** (`:root:not([data-theme="dark"])`) | NOVA (portage visuel) | L'admin est verrouillé en dark : les halos ambrés y seraient sales | Non |
| 24 | Typographie v3 : grotesque système en principal (aucun webfont à télécharger), JetBrains Mono + Instrument Serif via `next/font` | NOVA (portage visuel) | Helvetica Neue est une police système : zéro coût réseau pour le corps de texte | Non |
| 25 | `next/image` activé pour le catalogue : `remotePatterns` sur `assets.tcgdex.net` (25 225 visuels) et `res.cloudinary.com` | MILO (portage visuel) | Le repo n'utilisait que des `<img>` bruts, sans optimisation ni dimensionnement | Non |
| 26 | Univers = une VOIX, pas une couleur : `lib/universe-theme.ts` porte eyebrow, interlettrage, tagline et classe de voix (serif italique OP vs mono capitales Pokémon) | KAEL (portage visuel) | C'est ce que fait la maquette `Tanuki Univers` ; réduire à une couleur aurait perdu l'intention | Non |

| 27 | Le handoff Fiche Carte est intégré en REMAPPANT son vocabulaire visuel sur la v3 : `.panel`→`.glass`, `.panel-soft`→`.glass-light`, `rounded-[4px]`→paliers, `var(--ink)`→`var(--color-ink)`, `font-display`→grotesque par défaut. Seuls `.data`, `.surface-shine` et les 3 keyframes ont été ajoutés à `globals.css` | KAEL (intégration handoff) | Le handoff a été produit AVANT la v3 : le reprendre littéralement aurait réintroduit le radius plat à 4 px que CLAUDE.md v3 a explicitement remplacé | Non |
| 28 | `handoff/lib/universe.ts`, `handoff/components/universe/*` et les 3/4 de `globals.additions.css` sont écartés comme doublons de l'architecture maison | RYUU (intégration handoff) | Deux systèmes d'univers concurrents = le piège qui a déjà coûté une session sur ce projet | Oui |

| 29 | **Reset CSS dans `@layer base`** — cause racine de l'écrasement de mise en page du portage v3 : hors layer, `* { margin:0; padding:0 }` bat tous les utilitaires Tailwind (non-layered > layered) | KAEL (conformité maquettes) | `mx-auto`, `px-*`, `p-*`, `gap-*` étaient sans effet SUR TOUT LE SITE depuis l'origine ; le défaut était masqué par le paradigme inline des anciennes pages | Oui |
| 30 | **Conteneur de page = source unique** `.page-shell` / `<PageContainer>` (1360 px, gouttière 20/32/56). Interdiction de réécrire `max-w-[1360px] mx-auto px-…` à la main | KAEL (conformité maquettes) | Chaque section redéclarait sa propre gouttière — c'est le mécanisme de la dérive constatée | Oui |
| 31 | Exceptions v3 (`.font-grotesk :is(h1..h6)`, `.font-grotesk a`) placées dans `@layer base` et non `components` | KAEL (conformité maquettes) | Tailwind élague une règle descendante dont la classe de tête est un utilitaire généré si elle est dans `@layer components` — constaté, pas supposé | Non |

| 32 | Routes d'univers scindées : `/catalogue/<univers>` = landing, `/catalogue/<univers>/series` = index des séries, `/catalogue/<univers>/[set]` = détail. Le segment statique `series` prime sur le dynamique `[set]` | KAEL (Groupe 2) | La maquette distingue clairement landing et index ; l'ancienne route unique mélangeait les deux | Non |
| 33 | Un seul `SetDetail` pour les deux univers | KAEL (Groupe 2) | `Tanuki Set` et `Tanuki Pokemon Set` ont la MÊME anatomie (titre + tri, colonne de filtres collante, grille) — deux composants auraient divergé | Non |
| 34 | Filtres du set portés par l'URL (`?q=&sort=&rarity=&variant=&condition=&stock=`) | KAEL (Groupe 2) | Filtrage fait par la base et non en mémoire, liens partageables, rendu serveur préservé | Non |
| 35 | Les catégories de scellé suivent la taxonomie RÉELLE de `sealed_products.type` (booster/display/etb/tin/coffret/accessoire), pas les libellés du prototype (« UPC », « Blisters », « Starter Decks » n'existent pas en base) | RYUU (Groupe 2) | Règle « aucune donnée en dur » : pas de catégorie inventée qui ne mènerait nulle part | Non |

| 36 | **Espace client = routes, pas onglets.** La maquette `Tanuki Compte` pilote 5 vues par un state local ; on garde les routes existantes et la colonne de nav devient un composant partagé dans `app/compte/layout.tsx` | KAEL (Groupe 3) | Routes déjà en place, partageables, indexables et compatibles avec le garde d'authentification du middleware | Non |
| 37 | **Document d'identité : bucket PRIVÉ `identity-documents`**, chemin `<user_id>/<uuid>.<ext>`. Aucune URL publique ; lecture par URL signée de 120 s générée côté serveur. Policies : dépôt et lecture limités au propriétaire, lecture admin via `is_admin()` | KAEL (Groupe 3) | Le premier segment du chemin porte l'identité du propriétaire : c'est ce que comparent les policies `storage.objects` | Oui |
| 38 | Le fichier ne transite JAMAIS par le client vers le Storage : la route `POST /api/compte/identite` reçoit le formulaire et écrit en service-role | KAEL (Groupe 3) | `authenticated` n'a plus le droit d'écrire le statut d'identité (décision 39) — l'écriture doit donc être serveur | Oui |
| 39 | **Privilèges au niveau COLONNE sur `profiles`** : `REVOKE UPDATE` puis `GRANT UPDATE (full_name, avatar_url)` | KAEL (Groupe 3) | Faille préexistante : RLS ne restreint pas les colonnes, `authenticated` pouvait se passer `role='admin'`, se créditer un `store_credit` et se déclarer `identity_verified` | Oui |
| 40 | **Rachat : réutilisation de la table V2 `buyback_requests`** (items_json porte lot + quantités + estimation + chemins photos), au lieu d'une nouvelle table | KAEL (Groupe 3) | La table existait déjà, orpheline, et correspond exactement au besoin ; il ne lui manquait qu'une policy d'insertion propriétaire | Non |
| 41 | **WTB : table `want_to_buy_requests`** avec référence catalogue OPTIONNELLE (`card_type` + `card_id`) OU `free_text`, contrainte `card_id is not null or free_text is not null` | KAEL (Groupe 3) | Une carte absente du catalogue doit pouvoir être demandée ; une carte présente doit rester joignable par référence pour le matching automatique | Oui |

| 42 | **Radius admin en tokens séparés** : `--radius-admin-sm: 4px` (contrôles, badges, inputs, lignes, panneaux) et `--radius-admin-md: 8px` (grandes surfaces : terminal, modales). L'échelle publique (12/18-20/24-28) ne s'applique JAMAIS à l'admin | KAEL (Groupe 4) | L'admin est un espace de travail dense, pas une vitrine ; la maquette `Tanuki Admin` dessine tout à 4 px. Tokens distincts pour qu'aucun réglage public ne les emporte | Oui |
| 43 | L'habillage admin passe par les classes `.admin-*` de `components.css`, pas écran par écran | KAEL (Groupe 4) | Les 8 écrans partagent ces classes : un seul point d'action les aligne tous sur la référence (même levier que le correctif `@layer base`) | Non |

| 44 | **Source One Piece = Poneglyphe** (`https://tanuki-poneglyph.pages.dev/v1/`), API maison, en remplacement d'OPECards (domaine mort). Le schéma Goriki s'adapte à la source | KAEL (Poneglyphe) | Poneglyphe expose attribut, coût, contre, effet, personnage, affiliations, capacités, version — que l'ancien mapping jetait. Migration 0022 plutôt que perte d'information | Oui |
| 45 | **Seule la version `Standard` est importée** — filtre appliqué dans `lib/opecards.ts`, jamais en aval | KAEL (Poneglyphe) | La source expose toutes les versions (Alternative Art, Version 2, SP…) : 3 467 lignes pour 1 721 Standard. Sans filtre, la clé d'upsert `(set_id, number)` écraserait 50 % des cartes. Vérifié après import : 0 doublon |
| 46 | **Sets « coquilles » écartés sur `card_count === null`**, pas sur une liste d'exclusion | KAEL (Poneglyphe) | 10 des 40 sets sont des coquilles créées par le scraper pour héberger des promos isolées. Un filtre dérivé de la donnée reste juste au prochain scraping ; une liste en dur périmerait |
| 47 | `onepiece_sets.card_count` stocke le **nombre de cartes réellement importées**, pas le `card_count` de la source | KAEL (Poneglyphe) | Le `card_count` de Poneglyphe ne correspond ni au total ni aux Standard (concordant sur 4 sets sur 30) ; or SetGrid s'en sert comme dénominateur de sa barre de progression |

| 48 | **Doctrine motion à signatures nommées**, une par écran, sans empilement — remplace le « max 4 animations » | KAEL (motion upgrade) | Un compteur générique n'oriente rien ; une signature nommée par écran se vérifie et se refuse (« cet écran a déjà la sienne ») | Non |
| 49 | `AtmosphereLayer` monte le canvas en `fixed -z-10` sur le parcours public, **exclu de `/admin` et `/checkout`** | KAEL (motion upgrade) | L'admin est verrouillé en dark (halos parasites) ; au paiement rien ne doit distraire |
| 50 | `UniverseProvider` **dérive l'univers de la route** (`usePathname`) et lève `transitioning` 1,2 s à chaque bascule | KAEL (motion upgrade) | Sans cette dérivation, le canvas n'aurait jamais changé d'état : c'est ce qui rend la transition Home→Univers lisible |
| 51 | Le stagger GSAP REMPLACE l'entrée CSS `--animate-card-rise` de `CardTile` | MILO (motion upgrade) | Deux systèmes de révélation superposés : l'animation CSS du prix jouait derrière un parent encore à opacité 0. « Pas d'empilement » |

| 52 | **La planche de référence est une spécification** : quand sa composition diverge du markup existant, c'est le markup qui saute — pas la planche qui s'adapte | KAEL (refonte globale) | Trois écrans le montrent : la landing « bento » d'univers, la colonne de filtres collante du détail de set et la liste de lignes des scellés n'existent nulle part dans la planche. Les conserver aurait donné une recoloration, pas une refonte |
| 53 | **Dépôt-vente et Rachat deviennent des routes PUBLIQUES** (`/depot-vente`, `/rachat`) ; `/compte/*` garde le versant authentifié | KAEL (refonte globale) | La planche place les deux dans la nav principale. Pointer une entrée de nav vers un mur d'authentification est une impasse. L'estimation est publique, la DEMANDE ferme reste sur `/compte/rachat` avec sa logique KYC intacte |
| 54 | Vitrine dépôt-vente ouverte par **policy RLS sur `status='active'` + GRANT au niveau colonne** (migration 0023) | KAEL (refonte globale) | RLS ne restreint pas les colonnes. `commission_rate` (marge de la maison), `notes` (interne) et `user_id` (identité du déposant) sont retirés du GRANT — même technique que la 0021 sur `profiles` |
| 55 | Le déposant relit ses pièces via la fonction **`SECURITY DEFINER mes_depots()`** (migration 0024), pas en rouvrant `user_id` | KAEL (refonte globale) | Rouvrir la colonne aurait exposé le `user_id` des dépôts de TOUT LE MONDE aux comptes connectés, puisque la policy de vitrine autorise la lecture de toute ligne `active` |
| 56 | Une donnée absente de la base n'est **jamais simulée** : on substitue une donnée réelle de masse visuelle équivalente et on l'écrit dans l'en-tête du fichier | KAEL (refonte globale) | Cotes, sparklines « Marché », visuels de sets et de scellés, numérotation séquentielle de commande, champ Téléphone, bascule Recto/Verso : sept éléments de la planche sans support en base. Les inventer aurait rendu la maquette invérifiable |
| 57 | Les coupes de titre multi-lignes sont **posées dans le JSX** (`<span whitespace-nowrap>` par ligne) | MILO (refonte globale) | Laissé au navigateur, le manifeste du hero passait de 3 à 5 lignes selon la largeur — la signature typographique de la planche s'effondrait |

| 58 | Rachat : **aucune nouvelle table**. `buyback_requests.items_json` reçoit une charge DISCRIMINÉE `{kind:'singles'\|'bulk'}`, et `offer_amount` reste **NULL par construction** à la soumission | KAEL (corrections post-refonte) | La règle « aucun prix avant inspection » cesse d'être une consigne d'interface : elle devient structurelle. Il n'existe plus aucun barème dans le code — le serveur est incapable de calculer un montant, même par erreur |
| 59 | Want to Buy éclaté en **trois surfaces distinctes** : `/want-to-buy` (radar public, lecture seule, sans formulaire), `/compte/want-to-buy` (gestion personnelle), bouton « ♡ Je la cherche » sur une fiche indisponible | KAEL (corrections post-refonte) | Le lien de nav menait à un mur d'authentification. Un radar collectif est une information publique ; une want list est un objet privé. Deux besoins, deux pages — et l'ajout se fait là où l'intention naît, devant une carte qu'on ne peut pas acheter |
| 60 | Le radar est servi par **`want_to_buy_radar()`**, fonction `SECURITY DEFINER` agrégée (migration 0025) | KAEL (corrections post-refonte) | La table reste en lecture propriétaire. Ni `user_id`, ni `max_price`, ni `free_text` ne sortent — avec un compteur à 1, un prix maximum serait nominatif |
| 61 | Le fond ne porte QUE le motif d'univers et le gradient radial : **le réseau de nœuds 9×7 est supprimé** | KAEL (corrections post-refonte) | Dessiné à l'identique sur tous les écrans, ce quadrillage de points et de lignes écrasait les différences de composition d'un écran à l'autre — exactement l'inverse de « chaque écran a sa fonction visuelle » |

| 62 | Le pont admin ⇄ compte est un **affichage conditionnel sur `profiles.role`**, lu par le layout et passé en prop — jamais de liste blanche par e-mail ou UUID | KAEL (pont admin) | Même source que la garde de route `/admin` et le middleware. Un second administrateur voit le lien apparaître dès que son `role` passe à `admin`, sans modification de code ni déploiement. Le lien NAVIGUE : il ne change ni la session, ni le rôle effectif, et n'ouvre rien qui ne soit déjà gardé côté serveur |

| 63 | Le script d'import de stock lit un **classeur Excel via `exceljs`, en devDependency** | KAEL (import stock) | Le script est un outil d'exploitation local, pas du code livré : la surface de production reste inchangée. Écrire un lecteur ZIP/XLSX maison aurait mis la correction des données à la merci d'un bug de parsing |
| 64 | L'import de stock **refuse d'écrire quand deux lignes visent le même listing** au lieu de laisser la dernière gagner | KAEL (import stock) | Dans le fichier réel, les sections « PROMO » de MEW-151 et SCR réutilisent les numéros des cartes de base (`001 Bulbizarre`, puis `001 Bulbizarre Best Buy`, `001 Bulbizarre Costco`). Le matching se faisant sur numéro + variante, un écrasement silencieux aurait corrompu l'inventaire sans laisser de trace |
| 65 | Les compteurs par set du navigateur admin passent par **`admin_sets_overview()`**, agrégée en base et gardée par `is_admin()` | KAEL (navigateur listings) | Compter côté client aurait exigé de rapatrier ~31 000 listings à chaque affichage. La garde est DANS la fonction : elle ne répond rien à un non-admin, indépendamment des policies des tables |
| 66 | L'édition en masse est **repliée dans la vue par set**, `/admin/listings/masse` ne subsiste qu'en redirection | KAEL (navigateur listings) | Le mode séparé faisait choisir un set dans une liste déroulante sans jamais montrer où était le travail. La sélection multiple n'a de sens que posée sur la grille qu'on est en train de lire |

| 67 | Exemplaires multiples : **DEUX index**, pas un choix entre les options A et B — `UNIQUE(card_id, variant_type_id, condition, copy_index)` TOTAL, plus `UNIQUE(card_id, variant_type_id, condition) WHERE price < 1.0` PARTIEL | KAEL (exemplaires) | L'option B seule était écartée par un fait vérifié : un index PARTIEL ne satisfait pas l'inférence `ON CONFLICT (colonnes)` de PostgreSQL, et 5 upserts du code ciblent ces colonnes — la retenir seule cassait TOUS les imports. L'option A seule n'exprimait aucune règle métier et laissait passer cinq lignes pour une commune à 0,10 €. Chaque index couvre ce que l'autre ne peut pas |
| 68 | Le `copy_index` est calculé **en base**, sous `pg_advisory_xact_lock`, via `admin_add_listing_copy()` | KAEL (exemplaires) | `max(copy_index)+1` côté application est une course : deux ajouts simultanés viseraient le même numéro. Le verrou porte sur (carte, variante), donc il ne sérialise que ce qui doit l'être |
| 69 | Les exemplaires sont exposés en boutique comme des **destinations**, pas comme un sélecteur client | KAEL (exemplaires) | Chaque exemplaire a déjà sa propre URL, donc son propre scan et son propre prix. En faire des liens garde la page serveur, rend chaque exemplaire partageable, et surtout maintient le panier correct par construction : le bouton d'achat porte toujours le listing affiché |

| 70 | Galerie des scellés : `image_urls text[]`, et `image_url` devient une colonne **GÉNÉRÉE** valant `image_urls[1]` | KAEL (galerie scellés) | Ni deux colonnes en parallèle (dérive garantie), ni suppression sèche (il faut retoucher tout lecteur, y compris le SQL manuel et les exports). En la rendant dérivée, tout lecteur existant continue de marcher, la dérive devient impossible, et toute écriture sur `image_url` échoue — ce qui force la source de vérité unique |

| 71 | La grille d'un set est clé par **CARTE**, jamais par listing | KAEL (set entier) | `*_cards` contient toujours l'intégralité du set ; partir des listings ferait dépendre l'affichage du stock. Effet secondaire décisif : une carte à deux variantes n'apparaît plus deux fois, et le nombre de tuiles est borné par la taille du set (299 au maximum) au lieu du nombre de lignes de stock — ce qui rend la pagination inutile |
| 72 | Une carte non achetable n'affiche **aucun prix** | KAEL (set entier) | Elle affichait « 0,00 € », ce qui la faisait passer pour gratuite. `price = 0` n'est pas une gratuité, c'est une absence de prix. L'appel à l'action devient « ♡ Je la cherche », et la tuile perd sa card physics : une pièce qu'on ne peut pas acheter ne doit pas se comporter comme une pièce qu'on manipule |

| 73 | Les cartes représentatives d'un set sont choisies par **rareté la moins fréquente DANS CE SET**, pas par une liste ordonnée de raretés | KAEL (tuiles de set) | Il existe 47 libellés de rareté entre les deux univers, et la liste bouge à chaque extension. Le critère retenu est un fait mesurable et auto-entretenu : un set contient une poignée de SEC et des dizaines de communes. Vérifié — le rang 1 d'OP13 et d'EB02 est bien une SEC. Aucune liste à maintenir, aucun univers à traiter à part |
| 74 | Un visuel **décoratif** ne dépend jamais du stock | KAEL (tuiles de set) | Tuiles de set et tuiles de rayon de la home sont de la décoration : les alimenter depuis les listings en vente les vidait dès qu'un set n'avait pas de stock. Les compteurs, eux, restent branchés sur le stock et disent la vérité (« 87 cartes · 0 dispo ») |

| 75 | Le hero de la home met en avant **2 sets Pokémon + 2 sets One Piece**, chaque paire classée dans SON univers, sans compensation croisée | KAEL (hero nouveautés) | La parité est structurelle, pas un objectif de total : si un univers n'a pas deux sets datés, on montre ce qu'il a. Aucun prix n'est affiché — c'est une vitrine de nouveauté, et le stock reste dit honnêtement (« bientôt » quand il est à zéro) |

## Composants produits
| Composant | Path | Agent | Statut |
|---|---|---|---|
| Hero | components/blocks/Hero.tsx | Existant (pré-LOG) | ⚠️ Code mort — bien conçu (responsive, skeletons) mais importé nulle part |
| CardGrid | components/catalogue/CardGrid.tsx | Existant (pré-LOG) | ⚠️ Code mort — idem |
| CardTile | components/catalogue/CardTile.tsx | Existant (pré-LOG) | ⚠️ Code mort — idem |
| LenisProvider | components/providers/LenisProvider.tsx | MILO (motion upgrade) | Actif — smooth scroll, 4 guards (SSR, StrictMode, touch, reduced-motion) |
| AtmosphereLayer | components/atmosphere/AtmosphereLayer.tsx | MILO (motion upgrade) | Actif — **monte enfin** `AtmosphereCanvas`, qui n'était importé nulle part depuis sa création |
| Reveal | components/motion/Reveal.tsx | MILO (motion upgrade) | Actif — cascade GSAP ScrollTrigger sur les enfants directs |
| Magnetic | components/motion/Magnetic.tsx | MILO (motion upgrade) | Actif — attraction du CTA de la home |
| CardCursor | components/motion/CardCursor.tsx | MILO (motion upgrade) | Actif — curseur « VOIR → » sur `[data-card-hover]` |
| app/template.tsx | app/template.tsx | MILO (motion upgrade) | Actif — `AnimatePresence` (JAMAIS dans layout.tsx) |
| BuybackRow | components/admin/BuybackRow.tsx | ZARA (Groupe 4) | Actif — ligne dépliable du back-office rachat : photos par URL signée, proposer un prix, refuser, marquer réglée |
| VerificationRow | components/admin/VerificationRow.tsx | ZARA (Groupe 4) | Actif — enrichi : statut coloré, motif de refus, retour visuel après action |
| AuthPanel | components/auth/AuthPanel.tsx | MILO (Groupe 3) | Actif — bascule Connexion/Créer un compte, validation inline, lien magique et réinitialisation. Remplace LoginForm/RegisterForm |
| CompteNav | components/compte/CompteNav.tsx | MILO (Groupe 3) | Actif — colonne de navigation du compte, dans le layout |
| IdentityUpload | components/compte/IdentityUpload.tsx | ZARA (Groupe 3) | Actif — dépôt du document via la route serveur |
| BuybackForm | components/compte/BuybackForm.tsx | ZARA (Groupe 3) | Actif — soumission d'une demande de rachat |
| WantToBuyForm / WantToBuyList | components/compte/ | ZARA (Groupe 3) | Actifs — recherche catalogue + champ libre, liste et retrait |
| lib/orders/wtb-notify.ts | lib/orders/wtb-notify.ts | ZARA (Groupe 3) | Point d'ancrage des notifications WTB — AUCUN appelant à ce jour, volontairement |
| SetGrid | components/catalogue/SetGrid.tsx | Existant (pré-LOG) | ⚠️ Code mort — idem |
| HeroCarousel | components/ (home) | Existant (pré-LOG) | Actif mais px fixes (h 440px, offset 200px) — cassé mobile |
| Navbar | components/ | Existant (pré-LOG) | Actif — aucun menu mobile/hamburger |
| Footer | components/ | Existant (pré-LOG) | Actif — bug copyright couleur claire en dur (invisible en dark) |
| CartDrawer | components/ | Existant (pré-LOG) | Actif, responsive, aux tokens — bon exemple |
| LoginForm / RegisterForm | components/auth/ | Existant (pré-LOG) | Actifs (`alert()` pour magic link à revoir) |
| Sidebar admin | components/admin/Sidebar.tsx | Existant (pré-LOG) | Actif — 200px fixe, entrée `/admin/depot-vente` désactivée (page inexistante) |
| MassListingTable | components/admin/ | Existant (pré-LOG) | Actif — seul tableau admin avec `overflow-x-auto` |

| AddToCartButton | components/product/AddToCartButton.tsx | ZARA (mission 02) | Actif — CTA fiche produit, validation serveur /api/cart, gère épuisé/désactivé/stock max, ouvre le CartDrawer |
| SiteHeader | components/layout/SiteHeader.tsx | MILO (portage visuel) | Actif — header unique, nav avec onglet actif, compteur panier RÉEL via useCart, menu mobile |
| SiteFooter | components/layout/SiteFooter.tsx | MILO (portage visuel) | Actif — remplace `blocks/Footer` sur tout le parcours public |
| ProductCard | components/catalogue/ProductCard.tsx | MILO (portage visuel) | Actif — carte produit v3, `next/image` + emplacement « scan à venir » |
| UniverseProvider | components/universe/UniverseProvider.tsx | KAEL (portage visuel) | Actif — contexte d'univers + `useUniverse()` |
| AtmosphereCanvas | components/atmosphere/AtmosphereCanvas.tsx | MILO (portage visuel) | Actif — morph îles→grille, neutralisé sous `prefers-reduced-motion` |
| CardTile | components/catalogue/CardTile.tsx | handoff Claude Design, intégré par REX | Actif (dormant) — card physics pilotée par la rareté. Remplace l'ancien CardTile, mêmes props + `index` optionnel. ⚠️ Importé uniquement par `CardGrid`, lui-même non branché : l'interaction n'est visible nulle part tant que le Groupe 2 n'est pas porté |
| CardViewer | components/product/CardViewer.tsx | handoff Claude Design, intégré par REX | Actif — viewer d'inspection 3D (drag/zoom/flip/défauts), utilisé sur fiche produit si prix ≥ 1 € ET scan verso |
| InspectionPanel | components/product/InspectionPanel.tsx | handoff Claude Design, intégré par REX | Actif — rend `null` tant que la donnée d'inspection n'existe pas en base (c'est le cas aujourd'hui) |
| lib/rarity.ts | lib/rarity.ts | handoff Claude Design | Actif — rareté → palier d'interaction (0 calme → 3 chase foil). Repris tel quel, logique pure |
| SetGrid | components/catalogue/SetGrid.tsx | MILO (Groupe 2) | Actif — RÉÉCRIT sur la maquette : barre de progression du stock + « dès X € ». L'ancienne version (logo + nb de cartes) ne correspondait pas |
| CardGrid | components/catalogue/CardGrid.tsx | MILO (Groupe 2) | Actif — enfin branché (dormant depuis l'origine), transmet `index` à CardTile pour l'entrée en cascade |
| SealedRow | components/catalogue/SealedRow.tsx | MILO (Groupe 2) | Actif — ligne produit scellé GÉNÉRIQUE, une seule implémentation pour toutes les catégories |
| UniverseLanding | components/catalogue/UniverseLanding.tsx | MILO (Groupe 2) | Actif — landing d'univers partagée, bento passé en paramètre (4 tuiles OP / 6 Pokémon) |
| SeriesIndexClient | components/catalogue/SeriesIndexClient.tsx | MILO (Groupe 2) | Actif — index des séries groupé par ère, recherche vivante locale |
| SetDetail | components/catalogue/SetDetail.tsx | MILO (Groupe 2) | Actif — détail d'extension, sert les DEUX univers (anatomie identique dans les 2 maquettes) |
| SetFilters | components/catalogue/SetFilters.tsx | MILO (Groupe 2) | Actif — colonne de filtres collante, état porté par l'URL |
| PageContainer | components/layout/PageContainer.tsx | KAEL/MILO (conformité maquettes) | Actif — conteneur 1360 px des 20 maquettes, source unique avec `.page-shell` |
| CheckoutClient | components/cart/CheckoutClient.tsx | MILO (portage visuel) | Actif — 3 blocs + récap sticky, message de minimum de commande |
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
| ✅ RÉSOLU 2026-08-20 — remplacé par Poneglyphe (API maison), 30 sets / 1 721 cartes importés. Historique : API OPECards MORTE, le domaine `api.opecards.fr` ne résolvait plus (DNS, vérifié 06/07/2026). Pipeline durci et « prêt à brancher ». Alternatives sondées : `optcgapi.com` (200, JSON sets/cards, gratuit) et `apitcg.com` (200, multi-TCG, clé API requise) — données EN, pas FR ; `onepiece-cardgame.dev` (403). DÉCISION UTILISATEUR REQUISE avant branchement | RYUU (mission 01) | P1 (si One Piece requis à l'ouverture) | En attente décision utilisateur — cf. 00_ORDONNANCEMENT « décisions ouvertes » |
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
| `lib/types.ts` vide (0 octet) ; `alert()` dans LoginForm et checkout | KAEL (audit) | P3 | 🟠 `lib/types.ts` supprimé (nettoyage 2026-08-19) ; `alert()` de /checkout résolu mission 02 ; reste celui de `LoginForm.tsx:37` — défaut d'UX, pas du code mort |
| Branchement `order-shipped.ts` / `welcome.ts` non tracé jusqu'à un appelant ; `npm run build` jamais exécuté (compilation Next 16 à confirmer) | KAEL (audit) | P3 | 🟠 Partiellement résolu mission 03 — `order-shipped` branché sur la première saisie d'un n° de suivi (`PATCH /api/commandes`) ; `welcome.ts` toujours orphelin. `npm run build` : 0 erreur |
| Historique de migrations NON REJOUABLE : les 6 premières migrations (mars/avril 2026) visent un schéma abandonné (`extensions`, `blog_posts`, `pokemon_listings.variant/condition_id`) remplacé par `001`→`007` en juin. Le dossier est donc une HISTOIRE fidèle, pas un script de reconstruction : `supabase db reset` échouerait | RYUU (mission 03) | P2 | À trier — une baseline squashée exige `supabase db pull` avec le mot de passe Postgres (non disponible en session) |
| Policy `Profiles — lecture publique` : `USING (true)` sur `profiles` → n'importe quel visiteur peut lire tous les emails, `store_credit` et `role` via l'API REST | RYUU (mission 03, hors périmètre) | P1 | ✅ Résolu 2026-08-19 (demande utilisateur, migration `0017`) — remplacée par `USING (auth.uid() = id OR is_admin())`. Vérifié sur `/rest/v1/profiles` : anonyme 0 ligne, client 1 ligne (la sienne) sur 2 profils, admin 2 lignes |
| Les commandes `pending` (checkouts en cours, TTL 35 min) apparaissent dans la liste admin `/admin/commandes` puis disparaissent à l'expiration | RYUU (mission 03) | P3 | À trier — filtrer la liste admin sur `status <> 'pending'` si le bruit gêne |
| Webhook Stripe : l'insert dans `stripe_events` échoue (violation de `stripe_events_order_id_fkey`) quand l'`order_id` de la metadata pointe une commande déjà purgée (session expirée). Le code loggue et poursuit — rien ne casse, mais l'événement n'est pas journalisé et l'idempotence de niveau 1 est perdue pour lui (le verrou d'état de `finalize_paid_order` protège toujours). Correctif : mettre `order_id` à `null` si la commande n'existe plus | REX (nettoyage 2026-08-19) | P3 | À trier — constaté, non corrigé (hors périmètre nettoyage) |
| ⚠️ Le brief du portage visuel décrit comme « déjà en place » un dossier `handoff/` (handoff « Homepage catalogue fiche carte », spec « Bascule d'univers ») et des composants `SiteHeader`/`UniverseProvider`/`universe-theme`/`AtmosphereCanvas`/`CardViewer`/`InspectionPanel`. **Aucun n'existait** : vérifié fichier par fichier. `FONCTIONNALITES-RESTANTES.md` (cité pour les sections WTB/Rachat du Compte) est également introuvable. Seule la fusion de CLAUDE_UPDATE_visuel_v3 dans CLAUDE.md était bien faite. Les composants d'architecture ont donc été CRÉÉS, pas poursuivis ; `CardViewer`/`InspectionPanel` restent à concevoir depuis la maquette faute de spec | RYUU (portage visuel) | P1 | À trier — retrouver le handoff avant de porter la Fiche Carte, sinon il sera réinventé |
| ⚠️ Nom de marque : les 20 maquettes affichent « Tanuki TCG » alors que `SITE_NAME` vaut « Goriki » (Tanuki Corporation étant la société, cf. facture PDF). Le header porté lit `SITE_NAME` — le site affiche donc « Goriki TCG ». Renommer la boutique est une décision commerciale, pas un portage visuel | RYUU (portage visuel) | P2 | En attente décision utilisateur — un seul point de changement (`lib/constants.ts`) |
| Vitrine « Cartes populaires » et grilles catalogue : vides tant que le stock réel n'est pas saisi (29 113 listings à quantity=0 ET price=0). Les écrans portés gèrent l'état vide explicitement, ils ne cassent pas | RYUU (portage visuel) | P1 | Lié au signalement stock — bloquant d'ouverture déjà identifié |
| Bloc « catégories » de la home : la maquette propose « Bulk — lots & communes au poids », fonctionnalité inexistante. Remplacé par « Dépôt-vente », qui a une page réelle | MILO (portage visuel) | P3 | À trier — rétablir « Bulk » le jour où la fonctionnalité existe |
| Checkout : la maquette montre un formulaire d'adresse et un choix de transporteur dans la page. Le flux réel collecte l'adresse et le mode de livraison DANS Stripe (hosted checkout). Les blocs ont été portés en blocs d'information, sans champs morts | KAEL (portage visuel) | P2 | À trier — un formulaire en page exigerait de passer en Embedded Checkout (décision d'archi, hors périmètre habillage) |
| Radius admin : la maquette Admin est en 4px, cohérente avec sa densité d'information. Question posée par le brief, NON tranchée seule | KAEL (portage visuel) | P3 | En attente décision utilisateur — l'admin n'est pas encore porté |
| Relevé d'inspection : AUCUNE colonne en base (vérifié 2026-08-19 — 0 colonne surface/corners/edges/centering/back/defects/inspected_at, 0 table dédiée). `InspectionPanel` est branché sur la fiche produit et rend `null` : il attend la donnée. Structure suggérée par le handoff : JSONB sur les tables de listings, ou table `listing_inspections` | REX (intégration handoff) | P3 | À trier — aucune migration créée dans cette mission (hors périmètre explicite) |
| Le chemin `CardViewer` est actuellement INATTEIGNABLE avec les données réelles : 0 listing a un prix ≥ 1 € et 0 a de `front_photo_url`/`back_photo_url`. Vérifié en semant deux cas de test (12,50 € + verso → viewer ; 0,50 € sans photo → CardFlip), puis restauration | REX (intégration handoff) | P2 | Lié au signalement stock/prix à 0 — se résoudra à la saisie du stock réel |
| `CardTile` (card physics) n'est importé que par `CardGrid`, lui-même branché nulle part : l'interaction rareté→animation n'apparaît sur AUCUN écran tant que le Groupe 2 (catalogue singles) n'est pas porté | REX (intégration handoff) | P3 | À trier — se résoudra au portage du Groupe 2 |
| Résidu de test corrigé : 10 listings portaient `needs_photo = true` depuis les tests de la mission 03 (le trigger `set_needs_photo` ne remet pas le flag à false quand le prix redescend). Remis à `false` — l'admin affichait 10 fausses cartes « à photographier » | REX (intégration handoff) | P3 | ✅ Corrigé. ⚠️ Le trigger est asymétrique par construction : il lève le flag mais ne le baisse jamais sur retour à un prix < 1 € |
| Groupe 2 : **3 des 6 écrans n'ont aucune donnée à afficher** — One Piece est à 0 set / 0 carte (source morte, décision en attente) et `sealed_products` est vide. Landing One Piece, Séries One Piece et Scellés sont donc portés mais rendus en état vide explicite | RYUU (Groupe 2) | P2 | Lié aux décisions One Piece et à la saisie du stock |
| `onepiece_sets` sans colonne `serie_name` — tous les sets One Piece dans une ère « Autres » | REX (Groupe 2) | P3 | ✅ Résolu (migration 0022) : colonne ajoutée, alimentée par `set_type`, et le garde-fou codé en dur de `lib/catalogue/series.ts` retiré. Les 6 séries s'affichent |
| `components/catalogue/FilterPanel.tsx` n'est plus importé par personne depuis la réécriture des pages `[set]` | REX (Groupe 2) | P3 | ✅ Supprimé au Groupe 4 |
| `PokemonCatalogueClient.tsx` / `OnePieceCatalogueClient.tsx` orphelins, hébergeant la dernière `detectSerie` regex | REX (Groupe 2) | P3 | ✅ Supprimés au Groupe 4 — plus aucune occurrence de `detectSerie` dans le code |
| 🔴 **Élévation de privilèges corrigée** : `authenticated` détenait le UPDATE sur TOUTES les colonnes de `profiles`. Combiné à la policy `USING (auth.uid() = id)`, n'importe quel utilisateur connecté pouvait se passer `role='admin'` et se créditer un `store_credit` arbitraire. Corrigé par privilèges de colonne (migration 0021) et vérifié par test | KAEL (Groupe 3) | P0 | ✅ Corrigé — `permission denied for table profiles` sur role/store_credit/identity_verified, `full_name` reste modifiable |
| `FONCTIONNALITES-RESTANTES.md`, cité par le brief du Groupe 3 comme source de spécification du volet B, est INTROUVABLE dans le dépôt (2ᵉ document annoncé et absent après `handoff/`). Le volet B a été construit sur les seules spécifications du brief | RYUU (Groupe 3) | P2 | À trier — vérifier qu'aucune exigence n'a été perdue |
| Aucune table d'adresses : la carte « Adresse de livraison » du compte reprend l'adresse de la dernière commande, et n'offre pas de bouton MODIFIER (la maquette en a un) | MILO (Groupe 3) | P3 | À trier — nécessiterait une table `addresses` et un formulaire |
| Notifications WTB : `lib/orders/wtb-notify.ts` n'est appelé par personne. L'accroche est posée pour l'import et l'édition de stock, mais le déclenchement reste à brancher — et `RESEND_API_KEY` est toujours un placeholder | ZARA (Groupe 3) | P2 | À trier — dépend du branchement dans le moteur de stock |
| `FONCTIONNALITES-RESTANTES.md` annoncé comme « déposé à la racine du repo » au Groupe 4 : TOUJOURS introuvable (3ᵉ signalement). Le backlog original n'a donc jamais pu être confronté au livré — les volets B du Groupe 3 et les enrichissements du Groupe 4 reposent sur les seuls briefs | RYUU (Groupe 4) | P2 | À trier — fournir le fichier pour vérifier qu'aucune exigence n'a été perdue |
| **26 cartes SP ambiguës** signalées par l'audit Poneglyphe : exclues de cet import comme demandé (le filtre `Standard` les écarte de fait). Plus largement, 1 746 lignes non-Standard (Alternative Art, Version 2, Manga, SP…) restent hors catalogue | RYUU (Poneglyphe) | P2 | À trier — traitement séparé si l'utilisateur veut les vendre spécifiquement ; la colonne `version` est en place pour les accueillir sans migration |
| `release_date` reste `null` sur les 30 sets One Piece : aucun scraper Poneglyphe ne l'alimente. Conséquence côté Goriki : l'ordre des ères de l'index des séries n'a pas de critère de récence pour One Piece | RYUU (Poneglyphe) | P3 | À trier — correction attendue côté Poneglyphe, hors périmètre Goriki |
| 454 cartes Standard portent un numéro dont le préfixe ne correspond pas au set qui les héberge (ex. `EB01-001` dans le set `EB02`) : chez Poneglyphe, un « set » est un PRODUIT commercial, pas le set d'origine de la carte. Sans conséquence sur l'unicité, mais le fil d'Ariane affichera un set différent du préfixe du numéro | RYUU (Poneglyphe) | P3 | À trier — comportement de la source, à confirmer comme voulu |
| `onepiece_cards.block_number` non repris : toujours `null` dans l'échantillon inspecté, type réel inconnu | ZARA (Poneglyphe) | P3 | À trier — à ajouter si Poneglyphe l'alimente un jour |
| 🔴 **`AtmosphereCanvas` et `UniverseProvider` n'étaient montés nulle part** depuis leur création au portage visuel (0 importeur) : le morph d'univers n'a jamais tourné sur aucun écran jusqu'au 2026-08-21 | RYUU (motion upgrade) | P1 | ✅ Corrigé — `AtmosphereLayer` les monte dans `layout.tsx`, canvas vérifié au rendu |
| `motion-system` SKILL.md est introuvable (4ᵉ document annoncé et absent, après `handoff/`, `03_ADDENDUM.md` et `FONCTIONNALITES-RESTANTES.md`). Le motion a été construit sur le §6 du skill nextjs-multiagent, qui en résume les règles, plus la spécification du brief | RYUU (motion upgrade) | P2 | À trier — fournir le skill pour vérifier qu'aucune technique n'a été omise |
| Trois dépendances runtime ajoutées : `gsap`, `lenis`, `framer-motion` | MILO (motion upgrade) | P3 | À trier — nommées par le brief ; poids à mesurer avant mise en production |
| Advisories Supabase préexistants : `search_path` mutable sur `update_updated_at` / `handle_new_user` / `set_needs_photo` ; `handle_new_user` et `is_admin` (SECURITY DEFINER) exécutables par `anon`/`authenticated` ; protection « mots de passe compromis » désactivée | RYUU (mission 03) | P2 | À trier — antérieurs à la mission, aucun objet créé en 03 n'est concerné. ⚠️ Depuis la migration `0017`, l'EXECUTE de `is_admin()` par `anon`/`authenticated` est **nécessaire** : la policy SELECT de `profiles` l'évalue avec les droits de l'appelant. Le révoquer casserait la lecture des profils — ne pas « corriger » cet advisory-là |
| Chantiers absents (zéro ligne de code) : cycle dépôt-vente complet (tables `consignment_items`/`buyback_requests` existantes en base mais orphelines, taux unique 15 % sans paliers 30/25/20/15, pas de `gross_amount`/`payout`/`vat_scheme`, pas de rôle déposant), scan de cartes IA, exports Cardmarket/eBay | KAEL (audit) | P2 (post-ouverture possible) | À trier — features V2, pas des bugs |
| ⚠️ `STRIPE_SECRET_KEY` du `.env.local` = placeholder (9 caractères, ni sk_test_ ni sk_live_) → AUCUN appel Stripe ne peut aboutir ; le paiement E2E et la validation « frais de port visibles » sont bloqués tant qu'une vraie clé de TEST (sk_test_) + STRIPE_WEBHOOK_SECRET ne sont pas renseignés | RYUU (mission 02, E2E) | P1 | ✅ Résolu 2026-08-19 — `sk_test_`/`pk_test_`/`whsec_` renseignés (le `whsec_` correspond bien à celui de `stripe listen`, vérifié sans affichage). ⚠️ Des clés **live** avaient d'abord été posées par erreur : signalé et remplacées avant tout test |
| ⚠️ `RESEND_API_KEY` = placeholder (9 caractères, pas de préfixe `re_`) → aucun email ne part (confirmation de commande, expédition). L'échec est capturé et loggé, jamais bloquant pour la commande | RYUU (mission 03) | P2 | En attente d'une vraie clé `re_` — le branchement est fait et testable immédiatement après |
| Session Stripe à total 0 € possible : si `creditToApply === subtotal` ET livraison offerte (≥ 60 €), la Checkout Session n'a plus aucun montant → Stripe refusera la création en mode `payment`. Bug pré-existant rendu atteignable par la gratuité de port | KAEL (spec mission 02) | P2 | ✅ Résolu mission 03 — Stripe court-circuité, commande créée par le même chemin de finalisation. Vérifié : commande 70 € réglée par crédit, total 0 €, sans session Stripe |
| Choix de zone de livraison déclaratif : le client peut cocher « Belgique 5 € » avec une adresse FR (hosted Checkout fixe les options avant l'adresse) — display_name explicites en mitigation ; contrôle a posteriori à envisager | KAEL (spec mission 02) | P3 | Mission 03 (contrôle zone/adresse au webhook) ou passage Embedded Checkout |
| `useCart.addItem` plafonne silencieusement à `maxQuantity` (pas de feedback lors d'un incrément depuis drawer/panier) ; bouton AddToCartButton `disabled` garde `cursor: pointer` | KAEL (spec mission 02) | P3 | Mission 04 (feedback UI) |
| `/checkout` ne revalide pas tout le panier via `/api/cart` avant `/api/stripe/checkout` (la route Stripe revalide en base — non bloquant, UX d'erreur perfectible) ; `/api/cart` en N+1 (1 requête/item) | KAEL (spec mission 02) | P3 | Différé |

| `want_to_buy_requests.status` n'est **pas dérivé du stock** : une demande peut afficher « Trouvée » sans qu'aucun listing ne soit disponible, et « En attente » alors que la pièce est en vente. Constaté à l'œil sur l'écran 8 | RYUU (refonte globale) | P2 | À trancher : soit le statut devient calculé, soit un job le synchronise à l'entrée en stock |
| `auth.users` contient un compte `contact.lassautomat@gmail.com` (créé le 2026-03-16) **sans ligne `profiles`** — antérieur au trigger de création de profil. Toute page de compte planterait ou dégraderait pour ce compte | RYUU (refonte globale) | P2 | Décision utilisateur : créer le profil manquant, ou supprimer le compte s'il est obsolète |
| `sealed_products.image_url` est NULL sur la totalité des lignes : l'écran Scellés n'affiche que des emplacements « visuel à venir ». Aucun visuel produit scellé n'a jamais été importé | RYUU (refonte globale) | P2 | À alimenter à la saisie du stock scellé |
| `*_sets.image_url` ET `*_sets.release_date` sont NULL sur la totalité des sets : le détail de set ne peut afficher ni visuel de boîte ni date de sortie. Contourné par un éventail de cartes réelles du set | RYUU (refonte globale) | P3 | Poneglyphe ne fournit pas ces champs ; TCGdex a un logo de set exploitable si on décide de l'importer |
| ~~`BUYBACK_RATES`~~ | RYUU (refonte globale) | — | ✅ **Supprimé** aux corrections post-refonte : il n'y a plus aucun barème de reprise dans le code, l'estimation instantanée ayant été retirée (décision 58) |
| `BULK_CONTACT_THRESHOLD` (2 000 cartes), `BULK_CATEGORIES` (4 catégories) et `BULK_CONTACT_EMAIL` : **placeholders** du rachat bulk | RYUU (corrections post-refonte) | P2 (avant ouverture du rachat) | `// TODO à valider par l'utilisateur` — le seuil décide à partir de quand un lot sort du formulaire |
| `back_photo_url` reste NULL partout : `CardViewer` (signature motion n° 6, manipulation 3D) demeure **inatteignable en données réelles**. La fiche carte sert `ScanStage` (bande de vignettes + zoom) tant qu'aucun verso n'existe | RYUU (refonte globale) | P3 | Se résoudra à la saisie des scans réels ; le code des deux chemins est en place |

| **Six composants rendus orphelins par la refonte du 2026-08-21**, aucun n'est plus importé : `UniverseLanding` (landing bento remplacée par l'index des sets), `SealedRow` (liste de lignes → grille de tuiles), `WantToBuyList` (remplacé par `WantList` à onglets), `ProductCard` (la home dessine ses vignettes), `SetFilters` (remplacé par `SetToolbar`), `CardFlip` (remplacé par `ScanStage`). Non supprimés : le brief de refonte ne portait pas sur le nettoyage | RYUU (refonte globale) | P3 | Décision utilisateur : `git rm` groupé, ou conservation si un usage futur est prévu |

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

### Session 5 — 2026-08-19 (nettoyage code mort)
Demande : audit puis suppression du code mort avant le portage du nouveau visuel.
Agents actifs : RYUU (orchestration), REX (audit + suppressions).
Produit : `NETTOYAGE.md` (racine du dépôt) — 8 fichiers supprimés (`components/admin/NavItem.tsx` doublon de Sidebar, `lib/types.ts` vide, `lib/emails/welcome.ts` jamais branché, 5 SVG par défaut de create-next-app), la constante `ADMIN_EMAILS` (trompeuse depuis l'unification sur `profiles.role`), 2 paramètres `request` inutilisés, et 4 fonctions SQL orphelines via la migration `0018` (`generate_order_number`, `generate_ticket_number`, `handle_default_address`, `update_updated_at_column` — toutes visant des tables/colonnes disparues ; leur source est conservée dans `NETTOYAGE.md`).
Non supprimé, décision requise : `Hero.tsx`, `CardGrid.tsx`, `CardTile.tsx`, `SetGrid.tsx` (207 lignes) sont bien importés nulle part, MAIS la mission 04 les nomme explicitement comme à rebrancher. À trancher selon que le nouveau visuel remplace ou non ce plan.
Piège évité : `is_admin()` est sans trigger et sans appelant dans le code — mais la policy SELECT de `profiles` l'appelle (migration `0017`). Chaque candidat a donc été confronté aux policies, defaults, contraintes et vues avant suppression.
Validation : `npm run build` 0 erreur · 0 « module not found » dans le log dev · parcours home/catalogue/fiche produit/panier/checkout/login en 200, `/admin` en 307 attendu · 18/18 migrations versionnées (md5 vérifié).
Prochaine étape : inchangée — paiement manuel de bout en bout, vraie clé Resend, décisions tarifs/minimum, puis le portage visuel.

### Session 6 — 2026-08-19 (portage visuel v3 — socle + groupes 0 et 1 partiels)
Demande : porter les 20 écrans Claude Design en Tailwind v4 / React 19, radius à paliers + gradient v3.
Agents actifs : RYUU (orchestration, recon), KAEL (tokens additifs, système d'univers, arbitrages), NOVA (globals.css v3), MILO (header, footer, ProductCard, écrans).
Recon : les composants et le dossier `handoff/` annoncés comme déjà livrés n'existaient pas (voir signalement P1). Le socle a donc été construit de zéro.
Produit :
- Socle : tokens v3 additifs dans `globals.css` (radius sémantiques, `.glass*`, `.btn-ochre`, `.scan-pending`, gradient hors dark), polices JetBrains Mono + Instrument Serif, `next/image` configuré pour TCGdex/Cloudinary.
- Architecture : `lib/universe-theme.ts`, `components/universe/UniverseProvider.tsx`, `components/atmosphere/AtmosphereCanvas.tsx` (morph îles→grille, guard reduced-motion), `components/layout/SiteHeader.tsx` (compteur panier réel, menu mobile) + `SiteFooter.tsx`, `components/catalogue/ProductCard.tsx`.
- Groupe 0 : Accueil (hero, catégories, cartes populaires sur données réelles, dépôt-vente/rachat, badges) et Catalogue (deux univers avec compteurs réels de sets/cartes, bloc scellés).
- Groupe 1 : Panier (vide + rempli, stepper plafonné au stock, récap sticky, seuil de gratuité lu dans `SHIPPING_RATES`), Checkout (3 blocs + récap sticky + message de minimum), Checkout Success (récap réel depuis la commande en base).
- Cohérence : les 12 écrans non encore portés basculent sur `SiteHeader`/`SiteFooter` — plus aucun `blocks/Navbar`.
Validation : `npm run build` 0 erreur · utilitaires v3 vérifiés présents dans le CSS compilé · 10 routes publiques en 200.
NON fait à ce stade : Fiche Carte (Groupe 1 §4, bloquée sur le handoff manquant), Groupes 2 (catalogue singles, séries, sets, landings, displays), 3 (auth, compte) et 4 (admin). Vérification visuelle aux breakpoints non exécutée (aucun runner navigateur installé — contrôle structurel seulement).
Prochaine étape : retrouver le handoff Fiche Carte, trancher le nom de marque, puis Groupe 2.

### Session 7 — 2026-08-19 (intégration du handoff Fiche Carte)
Demande : intégrer 4 fichiers du dossier `handoff/` déposé à la racine (CardTile, CardViewer, InspectionPanel, rarity), en ignorant ses composants d'univers devenus doublons.
Agents actifs : RYUU (recon, arbitrages), KAEL (remappage v3), REX (intégration, tests).
Produit :
- `lib/rarity.ts` repris tel quel (logique pure : rareté → palier d'interaction 0→3).
- `CardTile` remplacé (props identiques + `index`), `CardViewer` et `InspectionPanel` créés — tous trois remappés sur la v3 (verre, radius à paliers, `--color-ink`, grotesque).
- `globals.css` : ajout de `.data`, `.surface-shine` et des 3 keyframes `cardRise`/`revealValue`/`markerIn`. Les 3/4 restants de `globals.additions.css` écartés comme doublons (`.panel`, `--ink*`, `.voice-*`, `--universe-t`, `--font-mono`).
- Fiche produit : bascule `CardViewer` si prix ≥ `PHOTO_PRICE_THRESHOLD` ET `back_photo_url` ET recto disponible, sinon `CardFlip` ; `InspectionPanel` branché en dessous.
- `handoff/` retiré du dépôt (il cassait `tsc` : son `UniverseProvider` importe un `@/lib/universe` non installé). Sauvegarde hors dépôt dans le scratchpad de session.
Corrections vs handoff brut : radius plats 4 px → paliers v3 · `.panel`/`.panel-soft` → `.glass`/`.glass-light` · `var(--ink)` (inexistant) → `var(--color-ink)` · `font-display` (Playfair) → grotesque v3 · `ref={frameRef as never}` → `useRef<HTMLAnchorElement>` correctement typé · rotation auto du viewer désormais neutralisée sous `prefers-reduced-motion` · viewer rendu responsive (330→240 px et 600→460 px sous `sm`) · placeholder « Pas d'image » → motif `scan à venir` de la DA.
Les deux « décisions qui vous appartiennent » du README du handoff (typographie, doctrine d'animation) étaient déjà tranchées par CLAUDE.md v3 : rien à arbitrer.
Validation : `npm run build` 0 erreur · lint 0 erreur sur les 4 fichiers · les deux chemins vérifiés sur données semées puis restaurées (base revenue à 0 listing hors état initial).
Prochaine étape : trancher le nom de marque, puis Groupe 2 (catalogue singles — qui rendra enfin `CardTile` visible).

### Session 8 — 2026-08-19 (conformité stricte aux maquettes — passe systémique)
Demande : le contenu était collé aux bords et le header se chevauchait ; corriger la cause racine plutôt qu'écran par écran.
Agents actifs : RYUU (mesure), KAEL (diagnostic + décisions 29-31), REX/MILO (passe de correction).
Diagnostic (mesuré, pas supposé) : contrairement au constat initial, le conteneur 1360 px ÉTAIT présent dans les écrans portés — mais redéclaré à la main dans chaque section. Le vrai coupable est ailleurs : `styles/globals.css` déclarait `* { margin:0; padding:0 }` HORS `@layer`. En CSS, le non-layered bat tout le layered ; Tailwind v4 émet chaque utilitaire dans `@layer utilities`. Résultat : `mx-auto`, `px-*`, `p-*`, `gap-*` sans effet sur tout le site depuis l'origine. Le défaut restait invisible tant que les pages utilisaient des styles inline (paradigme d'avant la v3) ; le portage v3, premier code à s'appuyer sur les utilitaires, l'a révélé.
Méthode : captures Chrome headless (aucun runner n'était installé — Chrome/Edge sont présents sur la machine) avant/après, à 700/1440/1920 px.
Produit :
- `@layer base` autour du reset et des styles d'éléments de `globals.css` (correctif d'une ligne, effet global).
- `.page-shell` + `<PageContainer>` : source unique du conteneur des maquettes ; les 7 écrans portés y passent, plus aucun `max-w-[1360px]` manuscrit dans `app/` ni `components/`.
- Exceptions v3 dans `@layer base` : titres au grotesque et liens en encre (ocre au survol) dans le périmètre `.font-grotesk`, conformément aux maquettes.
- Fiche produit : conteneur aligné (correction de conteneur seule — son portage visuel reste à faire).
- Règle verrouillée dans CLAUDE.md (§ Structure de page + § piège de cascade) pour les Groupes 2/3/4.
Validation : `npm run build` 0 erreur · captures après conformes à la référence (conteneur centré 1360, gouttière 56 px, header à 16 px du bord avec sa boîte pleine largeur, titres au grotesque).
Prochaine étape : inchangée — trancher le nom de marque, puis Groupe 2.

### Session 9 — 2026-08-19 (portage visuel Groupe 2 — navigation catalogue)
Demande : porter les 6 écrans du Groupe 2 (landings One Piece/Pokémon, séries, détail de set, displays) en appliquant d'emblée la règle de conteneur verrouillée.
Agents actifs : RYUU (audit des références), KAEL (décisions 32-35), MILO/NOVA (composants + écrans).
Audit des deux fichiers jamais lus : `Tanuki Set.dc.html` = « Cartes d'une série » (titre + tri, colonne collante recherche/version/rareté/état/en-stock, grille avec ajout panier en ligne, toast) ; `Tanuki Pokemon Set.dc.html` = « Extension Pokémon », anatomie identique, filtre TYPE au lieu de VERSION. D'où la décision 33 (un seul composant).
Produit :
- Composants : `SetGrid` réécrit (barre de progression + « dès X € »), `CardGrid` branché, `SealedRow` (générique), `UniverseLanding`, `SeriesIndexClient`, `SetDetail`, `SetFilters`, helper `lib/catalogue/series.ts`.
- Écrans : landings Pokémon et One Piece (bento asymétrique conforme aux empreintes 12 colonnes), index des séries des deux univers (groupement par ère data-driven, 18 ères réelles côté Pokémon), détail de set des deux univers, page scellés.
- `CardTile` et `CardGrid`, dormants depuis l'origine et améliorés par le handoff, sont ENFIN visibles : la card physics pilotée par la rareté s'exerce sur la grille d'un set.
- Conteneur : `PageContainer`/`.page-shell` utilisé dès le départ, aucun conteneur manuscrit introduit.
Validation : `npm run build` 0 erreur · 6 routes en 200 · captures Chrome headless comparées aux références (conteneur, gouttière 56 px, radius à paliers, colonne collante, grille).
Prochaine étape : Groupe 3 (Auth, Compte) puis Groupe 4 (Admin) ; trancher le nom de marque ; nettoyer les composants devenus orphelins (voir signalements).

### Session 10 — 2026-08-19 (Groupe 3 : Auth, Compte, et volet fonctionnel B)
Demande : porter Auth et Compte, puis construire vérification d'identité, rachat et Want To Buy.
Agents actifs : RYUU (audit maquettes), KAEL (décisions 36-41 + faille profiles), MILO (Auth, Compte), ZARA (volet B).
Audit de `Tanuki Compte.dc.html` (jamais lu) : titre « Mon compte », colonne collante à 5 onglets (Profil, Commandes, Wishlist, Dépôt-vente V2, Rachat V2), vue Profil = bandeau store credit + carte Profil (nom/e-mail/téléphone) + carte Adresse, vue Commandes = tableau à statut coloré, vue Détail = lignes + « Télécharger la facture PDF », vue Wishlist = grille avec ajout panier et retrait, et un écran vide « bientôt » pour les onglets V2.
Produit :
- Volet A : `AuthPanel` (un écran, deux onglets, validation inline, lien magique, réinitialisation), `/login` et `/register` conservés comme cibles de redirection ; `app/compte/layout.tsx` devient la coquille (titre + `CompteNav` collante), les sous-pages ne rendent plus que leur contenu ; page Profil refaite (avoir, profil, adresse).
- Volet B : migrations 0019 (colonnes KYC + table `want_to_buy_requests` + policy d'insertion rachat), 0020 (bucket privé `identity-documents` + policies), 0021 (privilèges de colonne sur `profiles` + bucket `buyback-photos`) ; pages `/compte/verification`, `/compte/rachat` (contenu rédigé + CTA à 3 états + formulaire), `/compte/want-to-buy` ; routes API dédiées ; vue admin `/admin/verifications` avec URL signée et boutons approuver/rejeter ; `lib/orders/wtb-notify.ts` posé comme accroche.
Validation : `npm run build` 0 erreur · 21/21 migrations versionnées (md5 vérifié) · tests d'isolation : lecture du document refusée à l'anonyme ET à un autre utilisateur, URL publique en 400, propriétaire OK · élévation de privilèges refusée sur role/store_credit/identity_verified, `full_name` toujours modifiable · CTA rachat vérifié dans les 3 états (307 vers login / « Vérifier mon identité » / formulaire) · WTB créé et listé sans vérification d'identité · comptes de test supprimés.
Prochaine étape : Groupe 4 (Admin), trancher le nom de marque, nettoyer les composants orphelins.

### Session 11 — 2026-08-20 (Groupe 4 : Admin — dernier groupe du portage)
Demande : habiller l'admin selon l'identité v3, enrichir Vérifications et Rachat, clore le portage.
Agents actifs : RYUU (audit), KAEL (décisions 42-43), MILO/NOVA (habillage), ZARA (back-offices).
Audit de `Tanuki Admin.dc.html` (jamais lu) : grille `200px 1fr`, sidebar collante pleine hauteur (`rgba(232,225,216,0.03)`, bordure droite `0.1`, logo « Tanuki ADMIN » avec ADMIN en ocre, nav à badges, lien « ← VOIR LA BOUTIQUE » en pied), main en `padding:24px 36px 48px` avec en-tête titre 24px + sous-titre mono 9px/0.14em et bloc e-mail + Déconnexion à droite. Panneaux uniformes `rgba(232,225,216,0.04)` / bordure `0.1` / **radius 4px**. KPI : label mono 9px/0.18em, valeur 26px/600, sous-ligne 12px. Sept vues (dashboard, stats, listings + détail + masse, produits, import, commandes + détail, clients + détail) — toutes déjà présentes dans l'app.
Constat : l'admin existant était nettement plus dense que la référence (titre 13px vs 24px, cellules 11px vs 13px, radius 2px vs 4px, panneaux sur `--surface-1`).
Produit :
- Tokens `--radius-admin-sm/md` et harmonisation des classes `.admin-*` sur les valeurs exactes de la référence : un seul point d'action pour les 8 écrans.
- Sidebar : Vérifications et Rachat sortent de la section V2 et rejoignent Gestion.
- Vérifications enrichie : sections « à traiter » / « historique », statut coloré, motif de refus, retour visuel après action.
- Rachat back-office créé : liste, ligne dépliable (description, estimation client, photos par URL signée), actions proposer un prix / refuser / marquer réglée.
- Nettoyage : les 3 composants orphelins du Groupe 2 supprimés — `detectSerie` disparaît enfin du code.
Validation : `npm run build` 0 erreur · 8 pages admin en 200 · parcours KYC complet (URL signée générée, approbation → `identity_verified=true`) · parcours rachat complet (offre 165,50 € → acceptée → réglée, `payment_type=cash`) · données et comptes de test purgés (1 profil restant, l'admin réel).
Prochaine étape : validation utilisateur de l'ensemble du portage avant commit ; trancher le nom de marque ; saisie du stock réel.

### Session 12 — 2026-08-20 (branchement One Piece sur Poneglyphe)
Demande : remplacer la source OPECards morte par l'API maison Poneglyphe, en adaptant le schéma à la source.
Agents actifs : RYUU (vérification de l'API réelle), KAEL (décisions 44-47 + migration 0022), ZARA (client, route, terminal).
Vérification préalable de l'API (le brief demandait de ne rien supposer) — trois écarts relevés par rapport au brief :
1. `/v1/sets/{id}.json` renvoie un objet PLAT (`set_id, name, set_type, release_date, card_count, cards`), pas `{ set, cards[] }`.
2. OP14-EB04 compte 199 cartes annoncées / 244 réelles, pas 244 comme indiqué au brief.
3. `card_count` ne correspond ni au total ni aux Standard (concordant sur 4 sets / 30) — inutilisable comme compteur, fiable seulement comme marqueur de coquille.
Produit :
- Migration `0022` : `serie_id`/`serie_name` sur `onepiece_sets` ; `attribute`, `cost`, `counter`, `effect`, `trigger_effect`, `character_name`, `affiliations`, `abilities`, `colors` (text[]), `version` sur `onepiece_cards`.
- `lib/opecards.ts` réécrit : absorbe la forme plate, filtre `version === 'Standard'`, écarte les coquilles (`card_count === null`), préfixe les images sur `https://tanuki-poneglyph.pages.dev`, aplatit `colors` pour l'affichage tout en conservant le tableau. Le contrat `OPESet`/`OPECard` est préservé — la route n'a changé que pour PERSISTER les nouveaux champs.
- Terminal admin : plus aucune mention d'OPECards ni de « domaine mort ».
- `lib/catalogue/series.ts` : garde-fou obsolète retiré (il forçait One Piece dans une ère unique).
Validation : dry-run sur 3 sets puis import complet · **30 sets, 1 721 cartes, 1 721 listings, 0 erreur** · 0 carte non-Standard · 0 doublon (set, numéro) · coquille OP14 absente, OP14-EB04 présent · `card_count` = cartes réelles sur les 30 sets · 0 carte sans image · 22/22 migrations versionnées (md5 vérifié) · `npm run build` 0 erreur · comptes de test supprimés.
Prochaine étape : inchangée — validation utilisateur avant commit, nom de marque, saisie du stock.

### Session 13 — 2026-08-21 (motion upgrade)
Demande : débrider le motion system, une signature par écran, identité visuelle inchangée.
Agents actifs : RYUU (diagnostic), KAEL (décisions 48-51), MILO (implémentation).
Diagnostic d'entrée (exigé par le brief) : `AtmosphereCanvas` et `UniverseProvider` **existaient mais n'étaient importés nulle part** — le morph d'univers n'avait jamais tourné. `CardViewer`/`InspectionPanel` sont bien montés mais inatteignables en données réelles (0 listing ≥ 1 € avec verso ; 0 colonne d'inspection). Seule la card physics de `CardTile` était réellement vivante. Aucune dépendance motion installée.
Produit :
- Réparation d'abord : `AtmosphereLayer` monte le canvas, `UniverseProvider` dérive l'univers de la route et expose `transitioning`, `AtmosphereCanvas` reçoit une prop `intensity` qui densifie le réseau pendant la bascule.
- Fond commun : `LenisProvider` avec les 4 guards.
- Home : `Reveal` (GSAP ScrollTrigger) sur les catégories et les badges, `Magnetic` sur « Découvrir les cartes ».
- Catalogue : cascade GSAP sur la grille, reflet au survol pour toutes les raretés (foil sur les chase), curseur « VOIR → ».
- Transition : `app/template.tsx` avec `AnimatePresence`, morph intensifié en parallèle.
- Fiche carte : ombre parallax liée à l'inclinaison + lueur ocre au drag, `will-change` conditionné.
- CLAUDE.md : doctrine remplacée par le tableau des signatures, les 6 guards et les interdits.
Validation : `npm run build` 0 erreur · lint 0 erreur sur `components/motion` · canvas vérifié au rendu (routes/îles sur la home, grille sur Pokémon) · cascade saisie en plein vol sur une capture · `--force-prefers-reduced-motion` : page complète, rien de masqué · plus aucun `will-change` permanent.
Prochaine étape : inchangée — validation utilisateur avant commit, nom de marque, saisie du stock.

### Session 14 — 2026-08-21 (REFONTE GLOBALE sur la planche verrouillée)
Demande : refondre les 10 écrans de `docs/design-reference/reference-planche-globale-10-ecrans.png`, composition prioritaire sur le markup existant, validation par capture desktop et comparaison en six catégories.
Agents actifs : RYUU (pilotage, captures), KAEL (décisions 52-57, migrations 0023-0024), MILO (composition), NOVA (primitives CSS), ZARA (estimateur, écrans de compte).

Contrôle d'entrée : les deux images de référence, **absentes lors de la mission précédente, sont bien déposées** (22 fichiers dans `docs/design-reference/`). Les rangs 1 et 2 de la hiérarchie de références sont donc applicables pour la première fois.

Obstacle majeur : **0 listing vendable en base** (1 721 + 29 639 lignes toutes à `price=0, quantity=0`), et 0 ligne dans `sealed_products`, `consignment_items`, `want_to_buy_requests`, `orders`. Aucun écran produit n'était validable. Un seed de démonstration a été posé sur de VRAIES cartes (noms, réfs, raretés, images du catalogue réel ; seuls prix et quantités fabriqués), puis **intégralement restauré** en fin de mission — contrôle final identique au baseline, `needs_photo` remis à 0 sur les 1 202 lignes que le trigger asymétrique avait levées.

Produit :
- **Socle** : Archivo Black + Inter (Playfair, DM Sans, Instrument Serif supprimées) ; `h1…h6` en `font-weight:400` + `font-synthesis-weight:none` (Archivo Black n'a que le 400) ; header et footer **plats** (la pilule de verre flottante n'existe pas dans la planche) ; primitives `.site-bar`, `.nav-link`, `.pill`, `.field`, `.display-*`, `.hair`, `.corner-tag`, `.status`.
- **Atmosphère** : `AtmosphereCanvas` réécrit autour d'une **rose des vents gravée** (branches bicolores, anneaux, graduations tous les 5°, relèvements). Le réseau de nœuds est conservé en couche secondaire : c'est lui qui porte le morph d'univers (signatures 4 et 5, intactes).
- **10 écrans** recomposés — dont trois qui n'avaient **jamais été portés** : fiche carte (styles inline + vocabulaire sombre), commandes du compte (`<main>` imbriqué dans celui du layout), `SameSetGrid` (`hover:scale-105`, proscrit).
- **Deux routes publiques créées** : `/depot-vente` et `/rachat` (estimateur fonctionnel adossé aux prix de vente réels, taux dans `BUYBACK_RATES`).
- **Migrations 0023 et 0024** appliquées et versionnées, md5 vérifié byte-exact contre le distant.

Bugs trouvés et corrigés en cours de route : filtre PostgREST sur un embed **aliasé** dans l'estimateur (le `ilike` aurait été silencieusement ignoré) ; régression que j'ai moi-même introduite avec la 0023 (le déposant ne lisait plus ses propres dépôts) → corrigée par la 0024 ; seed initial faussé par un `row_number()` évalué **avant** le `LIMIT` (prix à 14 800 €, dates à 316 jours).

Validation : `npm run build` exit 0 · `tsc --noEmit` exit 0 · lint 0 erreur sur les fichiers touchés · 10 captures desktop 1440px, dont 3 authentifiées via pilotage CDP · captures faites sous `prefers-reduced-motion: reduce` (la page doit être complète sans animation) · rendu re-contrôlé sur base VIDE après restauration : composition intacte, états vides explicites.
Prochaine étape : validation utilisateur avant commit. Rien n'est commité.

### Session 15 — 2026-08-22 (corrections post-refonte)
Demande : retirer le quadrillage de fond, différencier réellement l'atmosphère des deux univers, corriger l'architecture d'information de Want to Buy, refondre le flux de rachat.
Agents actifs : RYUU (recette navigateur), KAEL (décisions 58-61, migration 0025), MILO (atmosphère), ZARA (rachat, want to buy).

**Fond.** Le « quadrillage de points et de lignes » venait de la couche réseau d'`AtmosphereCanvas` (9×7 nœuds reliés par des courbes), dessinée à l'identique partout. Supprimée. Le fond ne porte plus que le motif d'univers et le gradient radial de `globals.css`.

**Deux cartographies.** One Piece garde la rose des vents ; Pokémon reçoit une **Pokéball gravée** (sphère, hémisphère appuyé, bande équatoriale, bouton central, arcs de balayage en pointillé) doublée d'un **viseur d'index** (équerres d'angle + réglette graduée). Fondu croisé strict : à `ease = 1`, la rose est à zéro.

Deux vrais bugs trouvés en vérifiant au rendu — pas au build :
- La rose restait visible à ~0,135 d'alpha côté Pokémon : l'ancien facteur `(1 - ease*0.55)` ne l'éteignait jamais.
- **Sous `prefers-reduced-motion`, le canvas n'était peint qu'une seule fois, au montage.** Un changement d'univers ne le repeignait jamais : un utilisateur en mouvement réduit restait bloqué sur la cartographie One Piece, définitivement. Corrigé par un `drawRef` rappelé à chaque changement d'univers. `UniverseProvider` initialise en outre son état **depuis la route dès le premier rendu** — il partait systématiquement sur One Piece avant de basculer en effect, ce qui déclenchait aussi une fausse transition de 1,2 s à chaque arrivée directe sur une page d'univers.

**Want to Buy** — trois surfaces (décision 59). `/want-to-buy` public agrège via `want_to_buy_radar()` : compteurs, filtres par univers, étiquette « N recherches » par carte, statut « En stock → » quand la pièce est disponible. Aucun formulaire. Le bouton « ♡ Je la cherche » apparaît sur toute fiche épuisée.

**Rachat** — refonte complète. L'estimateur instantané est **supprimé**, pas ajusté : il affichait un total recalculé en direct juste au-dessus de la phrase promettant l'inverse. Deux parcours : cascade univers → extension → carte → version avec liste latérale cumulative et quantités ; déclaration bulk par catégories grossières avec seuil de bascule vers le contact direct. Le lot survit à l'aller-retour de connexion (`sessionStorage`).

Effet de bord corrigé au passage : le bouton « Épuisé » restait en ocre plein et se lisait comme le CTA principal, juste au-dessus du vrai bouton d'action.

Validation : `npm run build` exit 0 · `tsc --noEmit` exit 0 · lint 17 erreurs, **toutes préexistantes** (admin, ThemeToggle, CheckoutClient, WantToBuyForm), zéro sur les fichiers touchés · captures Pokémon et One Piece côte à côte : atmosphères distinctes confirmées · parcours rachat **joué en CDP** (One Piece → OP13 → Monkey D. Luffy → Standard, puis une 2ᵉ carte) : la liste latérale cumule, et le contrôle automatique compte **0 occurrence du symbole € et 0 montant sur toute la page** · seuil bulk franchi à 5 120 cartes : le bouton de soumission disparaît, le message de contact le remplace · seed de capture restauré, baseline vérifié identique.
Prochaine étape : validation utilisateur avant commit. Rien n'est commité.

### Session 16 — 2026-08-22 (pont admin ⇄ espace personnel)
Demande : un lien « Administration » dans la nav de `/compte` visible des seuls admins, et le retour « Voir la boutique » côté `/admin`.

Constat d'entrée : le lien retour **existait déjà** en pied de sidebar admin — mais en casse mixte sans mono, alors que `Tanuki Admin.dc.html` le pose en mono capitales espacées de 0,14 em. Aligné plutôt que recréé. (Le brief le nommait `Tanuki_Admin_dc.html` ; le fichier réel s'appelle `Tanuki Admin.dc.html`.)

Produit :
- `app/compte/layout.tsx` lit `profiles.role` et passe `isAdmin` à `CompteNav`.
- `CompteNav` rend une entrée « Administration → » en ocre, isolée par un filet au-dessus de la déconnexion.
- Sidebar admin : lien boutique remis au vocabulaire de la maquette, et ajout d'un second retour « ← Mon compte » pour fermer l'aller-retour (au-delà du livrable littéral, retirable en une ligne).

Recette : **le même compte de test a été joué dans les deux rôles**, sans toucher au code entre les deux — seul `profiles.role` a changé en base.

| | `customer` | `admin` |
|---|---|---|
| Nav `/compte` | 7 entrées, pas d'« Administration » | 8 entrées, « Administration » présente |
| `/admin` | redirigé vers `/` | accessible |
| « Voir la boutique » / « Mon compte » | — | présents |

C'est cette bascule qui prouve l'exigence du second administrateur : l'affichage suit le rôle, rien d'autre.

Validation : `npm run build` exit 0 · `tsc --noEmit` exit 0 · lint 0 erreur sur les trois fichiers touchés · compte de test supprimé, baseline vérifié (2 `auth.users` préexistants, 1 profil, 1 admin).
Prochaine étape : validation utilisateur avant commit. Rien n'est commité.

### Session 17 — 2026-08-22 (import du stock Excel, puis navigateur de listings)

**A. Script d'import des quantités.** `scripts/import-stock-xlsx.ts` — un fichier par bloc, une feuille par set, dry-run par défaut, `--commit` explicite, multi-fichiers, n'écrit QUE `quantity`, ne crée jamais de listing.

Ce que le fichier réel a appris, au-delà du brief :
- La colonne des noms se repère par POSITION (colonne A) et non par en-tête : une feuille porte « x » en A1 au lieu de « Nom ».
- 21 lignes ne sont pas parsables — séparateurs « PROMO » et promos écrites autrement (`BS 049 Zapdos Ex`, `Coxyclaque SVP 133`). Signalées, jamais devinées.
- **Numéros en double dans une même feuille** : après « PROMO », MEW-151 et SCR réutilisent les numéros des cartes de base. Le script détecte le conflit et n'écrit NI l'une NI l'autre ligne (décision 64).
- Les codes de feuille sont les abréviations officielles (`SVI`, `PAL`, `MEW`) là où la base porte les codes TCGdex (`SV01`, `SV02`, `SV03.5`) : 16 feuilles sur 18 sans correspondance. Le rapport propose les sets proches d'après le LIBELLÉ, avec tolérance au pluriel (« Force temporelle » ⇄ « Forces Temporelles »), sans jamais appliquer la suggestion.
- Aucun listing POKEBALL/MASTERBALL n'existe en base : les colonnes correspondantes produisent des signalements, pas des créations.

⚠️ Écart de méthode à ne pas reproduire : le chemin d'écriture a été validé en lançant `--commit` sur un classeur de test fabriqué pour l'occasion — mais visant la VRAIE base. Trois quantités écrites sur SV01, annulées immédiatement (valeur d'avant : 0, valeur après annulation : 0, aucune perte). Le rapport devait être montré à l'utilisateur avant tout `--commit`, quelle que soit la source du classeur.

L'utilisateur a ensuite mené l'import lui-même après avoir aligné ses codes de feuille : **1 121 listings, 3 358 cartes**, prix intacts à 0, One Piece intact.

**B. Navigateur de listings admin.** `/admin/listings` n'affichait que deux compteurs globaux et un bouton « Édition en masse » à l'aveugle.
- Liste des sets par univers, compteurs total / stock / sans prix / sans photo, tri mettant en tête les sets qui demandent une action, filtres et recherche.
- `/admin/listings/set/[universe]/[setId]` : grille dense façon shop — vignette, nom, numéro, variante, rareté, stock et prix éditables en ligne, état, visibilité, lien vers la fiche. Filtres par statut / variante / rareté. Sélection multiple + application d'une valeur commune, DANS la grille.
- `/admin/listings/[id]` devient un vrai formulaire (prix, stock, état, visibilité, scans recto/verso) : l'upload photo existant est conservé et entouré, pas dupliqué.
- Correction d'un défaut latent au passage : le chargement n'avait aucune annulation, une réponse lente pouvait écraser un set chargé après elle.

Constat mis en évidence par l'écran : **les 13 sets avec stock ont 100 % de leurs listings sans prix** — 1 121 pièces non vendables en l'état. C'est le chantier suivant.

Validation : `npm run build` exit 0 · `tsc --noEmit` exit 0 · lint 0 erreur sur les fichiers touchés · parcours joué en CDP sous compte admin de test (liste → SV01 → saisie inline 4,25 € → « 1 ligne enregistrée ») et **vérifié en base**, puis remis à 0 avec `needs_photo` (que le trigger asymétrique avait levé au passage du seuil 1 €). Compte de test supprimé. Migration 0026 versionnée, md5 vérifié byte-exact.
Prochaine étape : validation utilisateur avant commit. Rien n'est commité.

### Session 18 — 2026-08-22 (exemplaires multiples pour les cartes ≥ 1 €)
Demande : lever `UNIQUE(card_id, variant_type_id, condition)` pour que plusieurs pièces physiques d'une même carte, au même état déclaré, puissent coexister avec leur propre scan et leur propre prix — sans toucher au régime bulk.

**Schéma (décision 67).** Le brief proposait A (clé avec `copy_index`) ou B (index partiel). Les deux sont retenues, parce que chacune couvre un angle mort de l'autre. Fait décisif vérifié avant de trancher : un index unique PARTIEL ne satisfait pas l'inférence `ON CONFLICT (colonnes)` de PostgreSQL, et **5 upserts** (`lib/import/pokemon.ts`, `app/api/import/onepiece/route.ts`) ciblent `card_id,variant_type_id,condition` — l'option B seule aurait cassé tous les imports de catalogue. Les 5 sites ont été repointés sur la clé à 4 colonnes, et l'inférence re-testée en SQL (0 doublon créé).

**Garde-fous, vérifiés et non supposés.** Le trigger `set_needs_photo` est `FOR EACH ROW` : chaque exemplaire entre seul dans la file « à photographier », rien à ajouter. Le régime bulk reste à une ligne, garanti par l'index partiel — un doublon à 0,50 € est refusé par la base, pas par une validation applicative.

**Panier / commande (étape 4).** Confirmé, pas supposé : `AddToCartButton` passe `listingId={listing.id}`, `/api/cart` valide `.eq('id', item.listingId)`, `order_items.item_id` porte l'id du listing et `reserve_order_stock` verrouille `where id = r.item_id`. La chaîne était déjà correcte de bout en bout — aucune modification.

**Défaut trouvé dans mon propre code, corrigé (0029).** La 0028 copiait `image_api` depuis le listing source ; un exemplaire créé depuis un autre exemplaire héritait donc d'un champ vide et la fiche produit tombait sur « scan à venir » alors que la carte a un visuel d'éditeur. Le repli se résout désormais sur toute la fratrie, puis sur `*_cards.image_url`.

Validation : test de schéma en SQL (deux Near Mint à 5,00 € et 6,50 € coexistent ; un troisième à 0,50 € refusé ; `needs_photo` levé par exemplaire) · parcours admin joué en CDP sous compte de recette — refus sous 1 € affiché, création réelle à 12,90 € via la RPC, exemplaire n° 3 vérifié en base · fiche produit affichant « 2 exemplaires disponibles — chacun scanné séparément » avec deux prix distincts au même état · non-régression sur une carte bulk : aucun bloc supplémentaire · `npm run build` exit 0 · `tsc --noEmit` exit 0 · lint 0 erreur sur les fichiers touchés · migrations 0027-0029 versionnées, md5 vérifié byte-exact.
Données de recette retirées (0 exemplaire `copy_index > 0` restant, compte supprimé) : le stock importé est intact — 1 121 listings, 3 358 cartes, prix toujours à 0.
Prochaine étape : validation utilisateur avant commit. Rien n'est commité.

### Session 19 — 2026-08-22 (fix : visuel absent sur la fiche d'un produit scellé)
Symptôme : un scellé au `image_url` Cloudinary valide affichait « scan à venir » sur sa fiche publique.

Cause : `app/[slug]/page.tsx` sert DEUX schémas derrière la même route. Les listings de cartes portent `front_photo_url` / `image_api` ; `sealed_products` porte `image_url`. La chaîne de repli s'arrêtait aux deux premiers, donc `frontUrl` valait `null` pour tout scellé — et `cartImageUrl` avec lui, la vignette du panier étant vide elle aussi. Silencieux parce que `getListing` caste en `as unknown as ListingLike`, interface où `image_url` n'était pas déclaré : TypeScript n'avait rien à signaler.

Contrôle d'entrée : console vide sur la page (le « 1 Issue » vu par l'utilisateur était l'avertissement Next.js `scroll-behavior: smooth`, sans rapport) et **zéro `<img>` dans le DOM** — la donnée n'atteignait jamais le composant, ce n'était donc pas un échec de chargement d'image.

Correction : `image_url` déclaré sur `ListingLike` et ajouté en fin de chaîne de repli. Un seul fichier.
Validation : scellé avec visuel → image Cloudinary · scellé sans visuel → placeholder conservé · carte → image TCGdex inchangée · liste des scellés inchangée · `npm run build` exit 0 · lint 0 erreur. Ligne de test supprimée.

### Session 20 — 2026-08-23 (galerie multi-visuels pour les scellés + texte Inspection)

**Galerie (décision 70).** `sealed_products.image_urls text[]` devient la source de vérité ; `image_url` est conservée mais générée depuis `image_urls[1]`. Effet de bord à connaître : elle n'est plus écrivable. Le seul écrivain était le formulaire admin, mais l'API renvoyait le corps tel quel après un `select('*')` — le formulaire aurait donc renvoyé `image_url` et l'enregistrement aurait échoué. Une garde `sansChampsDerives()` l'écarte désormais dans `POST` et `PATCH`, au seul endroit qui écrit.

Admin : le champ « URL image » unique devient une liste (aperçu par ligne, édition, retrait, ajout), avec la mention que le premier visuel sert de vignette. Les URLs vides sont filtrées à l'enregistrement.

Storefront : la galerie réutilise `ScanStage`, le composant des cartes (bande de vignettes + visuel principal + zoom) — aucun nouveau composant. Un scellé à un seul visuel garde l'étiquette « Visuel » au singulier et aucune galerie ne s'affiche.

**Texte Inspection.** Un scellé n'a pas de relevé d'inspection : la boîte n'est jamais ouverte. Le panneau devient « État du produit — Produit scellé d'origine, jamais ouvert. Expédition avec emballage renforcé. » Les cartes gardent mot pour mot leur texte.

Note : la route admin s'appelle `/admin/produits` (le brief la nommait `/admin/scelles` ; le libellé de la sidebar dit « Scellés »).

Nettoyage au passage, dans un fichier déjà ouvert : deux erreurs de lint préexistantes de `app/admin/produits/page.tsx` (`set-state-in-effect`, `no-explicit-any` sur la ligne de tableau) corrigées.

Validation : produit à 3 puis 4 visuels → galerie « Photo 1…4 » en boutique, éditeur de liste en admin, PATCH en **200** (la colonne générée ne bloque rien) · produit ramené à 1 visuel → comportement identique à avant · texte Inspection vérifié sur les deux types de fiche · vignette du catalogue toujours servie par `image_url` dérivée · `npm run build` exit 0 · `tsc --noEmit` exit 0 · lint 0 problème sur les fichiers touchés · migration 0030 versionnée, md5 vérifié byte-exact.
Données de recette retirées (produit revenu à son visuel unique, compte supprimé).

### Session 21 — 2026-08-23 (le catalogue montre le set entier, pas le stock)

**Diagnostic — la cause supposée n'était pas la bonne.** Le brief soupçonnait un filtre `quantity > 0` ou l'absence de LEFT JOIN. Vérifié : la requête ne filtrait PAS sur le stock, et **aucune carte n'est orpheline** (0 carte sans listing dans les deux univers — l'import en crée une par carte). Les cartes n'étaient donc pas perdues par un filtre. Trois causes réelles, mesurées :

1. **`.limit(120)`** sur la requête : SV01 rendait 120 tuiles pour 258 cartes. C'est ça, « on ne voit pas le set entier ».
2. **Aucune distinction de disponibilité** : une carte sans stock ni prix s'affichait exactement comme une carte achetable, avec « 0,00 € » et « ×0 ». Violation directe du garde-fou « aucune carte affichée comme achetable si elle ne l'est pas ».
3. **Grille clé par listing** : une carte à deux variantes apparaissait deux fois (535 lignes pour 258 cartes sur SV01).

**Correction.** La grille part de `*_cards` (décision 71), rattache les listings, et dérive la disponibilité. Deux états dans `CardTile` : disponible (traitement normal, card physics, prix) et indisponible (opacité 0,62, désaturation, aucun prix, « ♡ Je la cherche », pas de physique). Le tri par prix range les indisponibles en fin, quel que soit le sens.

**Pagination : volontairement aucune.** Le plus gros set du catalogue compte 299 cartes (moyenne 113) ; en clé par carte, une seule page suffit, vignettes en `lazy`. La borne à 400 est une sécurité, pas une troncature.

**Liste des sets** — vérifiée, rien à corriger : elle ne filtre pas sur le stock (30 sets One Piece et 194 Pokémon tous atteignables), et les sets sans stock s'affichent avec « Aucune pièce en vente ». Le dévoilement par 9 est de la progressivité, pas un filtre.

Mesures avant / après :

| | avant | après |
|---|---|---|
| SV01 (258 cartes) | 120 tuiles, 120 × « 0,00 € », 0 CTA | 258 tuiles, 0 prix fantôme, 255 CTA |
| EB02 One Piece (87 cartes) | 87 tuiles, 87 × « 0,00 € », 0 CTA | 87 tuiles, 0 prix fantôme, 87 CTA |

Validation : les deux univers capturés · contraste disponible/indisponible éprouvé en chiffrant temporairement 3 cartes SV01 (6,25 / 10,00 / 13,75 €) — les trois ressortent à pleine opacité avec leur prix, les 255 autres restent visibles en retrait — puis prix et `needs_photo` remis à 0 · `npm run build` exit 0 · `tsc --noEmit` exit 0 · lint 0 problème sur `components/catalogue`.
Note : le stock en base est passé à 1 641 listings / 5 789 cartes entre-temps (imports menés par l'utilisateur), non touché.

### Session 22 — 2026-08-23 (tuiles de set et visuels de la home indépendants du stock)

Périmètre volontairement distinct de la session 21 : `SetDetail` (grille de cartes DANS un set) n'a pas été touché, et rend toujours ses 258 tuiles après coup.

**1. Tuiles de set.** Cause confirmée dans `lib/catalogue/series.ts` : le tableau `preview` était construit à partir des listings filtrés `is_active && quantity>0 && price>0`. Sans stock vendable — c'est-à-dire presque partout — la tuile n'avait aucun visuel. Les aperçus viennent désormais de `apercus_de_set()` (migration 0031, décision 73), qui lit le CATALOGUE. Les compteurs restent branchés sur le stock.

**2. Scellés — la moitié du diagnostic du brief était fausse.** `/catalogue/scelles` affichait DÉJÀ correctement la photo : vérifié en HTML (`srcSet` vers `/_next/image`), en testant l'optimiseur (200, PNG de 47 ko) et en capture. Aucun bug de ce côté. Le vrai défaut était sur la home : `img: null` **codé en dur** dans le tableau `RAYONS` de `app/page.tsx`, écrit à une époque où `sealed_products` était vide.

**3. Élargissement assumé.** Les cinq tuiles de rayon de la home tiraient toutes leur visuel du stock vendable, pas seulement celle des scellés. Toutes ont reçu un repli catalogue — corriger la seule tuile nommée au brief aurait laissé les quatre autres vides à côté.

**Non traité volontairement** : l'éventail du hero de la home reste un emplacement hachuré. Il porte une pastille de prix et pointe vers des fiches produit : c'est un bloc qui parle de pièces EN VENTE, pas de la décoration. Le remplir avec des cartes non vendables demanderait de décider ce qu'il annonce — décision à trancher, pas à supposer.

Défaut de libellé attrapé au passage : une tuile sans visuel affichait « Aucune pièce en vente », ce qui était devenu trompeur (le stock est déjà dit par le compteur). Elle dit maintenant « Visuels non importés » — car c'est de ça qu'il s'agit.

Mesures avant / après :

| | avant | après |
|---|---|---|
| Catalogue One Piece (9 tuiles) | 0 visuel, 9 cases « Aucune pièce en vente » | 114 visuels, 0 case vide |
| Catalogue Pokémon (9 tuiles) | 0 visuel | 402 visuels, 1 case sans visuel (set sans image en base) |
| Home, tuiles de rayon | 0 visuel sur 5 | 5 visuels sur 5, dont la vraie photo du booster |

Validation : `npm run build` exit 0 · `tsc --noEmit` exit 0 · lint 0 problème · `SetDetail` non modifié et toujours à 258 tuiles / 258 CTA · migration 0031 versionnée, md5 vérifié byte-exact.
Signalement ouvert : **72 des 200 sets Pokémon n'ont aucune carte avec `image_url` en base** (dont 6 sans aucune carte) — lacune de l'import TCGdex, pas du code. Ces tuiles resteront sans visuel tant que la source n'est pas complétée.

### Session 23 — 2026-08-23 (hero de la home : vitrine des nouveautés)

Le hero affiche désormais les sets les plus récents de chaque univers, à la place de l'emplacement hachuré. Chaque tuile porte la carte la plus rare du set (`apercus_de_set`, même logique que le catalogue), le badge « Nouveau », le mois de sortie, le lien vers le set, et un stock dit tel quel — « bientôt » quand il vaut zéro. Aucun prix : ce bloc ne promet pas de disponibilité.

**Blocage constaté, en amont du code.** `onepiece_sets.release_date` est NULL sur les 30 sets. Vérifié à la source avant de conclure : `https://tanuki-poneglyph.pages.dev/v1/sets.json` **expose bien un champ `release_date`, mais il est `null` sur les 40 sets** qu'elle renvoie. Ce n'est donc pas une omission de notre import — la donnée n'existe pas en amont.

Conséquence : le garde-fou « ne jamais compenser en piochant dans l'autre univers » ne s'applique pas à un cas limite, il s'applique en permanence. Le hero rend aujourd'hui **2 tuiles Pokémon et 0 One Piece**. C'est le comportement spécifié, appliqué fidèlement — pas une dégradation accidentelle. Trois issues possibles, à trancher par l'utilisateur : renseigner `release_date` côté Poneglyphe (le hero se remplit sans toucher au code), accepter un autre signal d'ordre pour One Piece (ce serait inventer une chronologie), ou rester à 2+0 en attendant.

Validation : sélection vérifiée en base — ME05 (2026-07-17) et ME04 (2026-05-22) sont bien les deux plus récents ; les deux liens répondent 200 · `npm run build` exit 0 · `tsc --noEmit` exit 0 · lint 0 problème.
Signalement : `components/home/HeroDeck.tsx` devient orphelin (plus aucun import). Non supprimé — le brief ne portait pas sur le nettoyage.

### Session 24 — 2026-08-23 (hero des nouveautés : reprise de l'éventail, une composition à la fois)

La livraison de la session 23 était **rejetée** : deux tuiles encadrées côte à côte, chacune avec bordure, fond et vignette à plat. C'est le traitement produit interdit par la doctrine (« une carte posée bien à plat au centre d'une vignette est le symptôme de l'ancien layout »), et ça n'était pas ce qui était demandé.

`NouveautesHero.tsx` est réécrit en reprenant l'éventail de `HeroDeck` — pas en le réinterprétant. Valeurs reportées telles quelles : `SLOTS` (x −168 / +172 / +4, rot −15° / +12° / −3°, scale 0,80 / 0,84 / 1), perspective 1600, largeurs `min(272px, 46vw)` en tête et `min(232px, 40vw)` en fond, les deux ombres portées, la parallaxe au pointeur (34 px / 22 px pondérés par `depth`). Plus aucune bordure, aucun encadré, aucun fond de tuile.

**Un seul ajout de style, assumé** : `blur(2.5px)` + `opacity 0.85` sur les deux cartes d'arrière-plan. `HeroDeck` les rendait toutes piquées ; la référence verrouillée `reference-home-goriki.png` montre une carte nette devant deux cartes nettement floues. L'ajout rapproche de la référence, il ne s'en écarte pas.

**Une seule composition visible à la fois**, jamais deux côte à côte : les sets défilent en fondu toutes les 5,2 s, avec repères cliquables. Sous `prefers-reduced-motion`, le défilement est neutralisé et le premier set reste affiché.

**Teinte jaune — mesurée, pas supposée.** Aucun filtre n'était en cause : la chaîne complète d'ancêtres de la carte de tête a été inspectée au rendu (`filter`, `backdrop-filter`, `mix-blend-mode`, `opacity`) — **aucune propriété teintante**. La carte de rang 1 de ME05 et ME04 est une **Méga Hyper Rare** (Méga-Darkrai-ex, Méga-Amphinobi-ex), c'est-à-dire le palier de rareté à fond doré. Mesure PIL sur le visuel source : `me05/120/high.webp` → RGB moyen **(222, 185, 15)**, doré ; `me05/003/high.webp` (témoin du même set) → **(168, 189, 122)**, pas jaune. La teinte EST la carte. Rien à corriger.

**Défaut hérité corrigé au passage.** Les décalages de slot de `HeroDeck` sont en px fixes alors que seules les largeurs clampaient en `vw` : à 390 px l'éventail débordait (bord gauche à −56 px). Les décalages passent par `calc(<valeur>px * var(--eventail, 1))`, où `--eventail` vaut 0,58 / 0,78 / **1 à partir de `lg`**. Les bornes mesurées à 1280 et 1440 px sont **identiques au pixel** avant et après (624→1211 et 722→1309) : le desktop est inchangé, seul le mobile est resserré.

Validation au rendu, pas à l'œil seul : 3 cartes dans le conteneur du hero et 0 ailleurs dans le bloc · classe de l'ancienne tuile encadrée (`rounded-panel-lg transition-colors`) absente du hero · défilement observé ME05 → ME04 → ME05 en mouvement autorisé, **figé** sous `prefers-reduced-motion` · aucun débordement horizontal à 390 / 768 / 1280 / 1440 px · `npm run build` exit 0 · `tsc --noEmit` exit 0 · lint 0 problème.
Signalement toujours ouvert : `components/home/HeroDeck.tsx` reste orphelin — ses valeurs vivent maintenant en double dans `NouveautesHero.tsx`. À fusionner ou supprimer lors d'une mission de nettoyage.

### Session 25 — 2026-08-23 (flèches du hero + mini-éventails sur les tuiles de rayon)

**1. Navigation manuelle du hero.** `NouveautesHero` gagne deux flèches `←` / `→` encadrant les repères de palier, dans le registre sobre des « Voir tout → » du site : glyphe en mono `.data`, pas de bouton plein, pas de pastille. Toute navigation manuelle — flèches comme repères — suspend le défilement pendant `PAUSE_MANUELLE = 12 000` ms, sinon le palier suivant annulait le geste de l'utilisateur 5,2 s plus tard. La pause vaut aussi sous `prefers-reduced-motion` : elle n'y coûte rien puisqu'il n'y a rien à suspendre, et la règle reste la même partout.

**2. Mini-éventails sur les 5 tuiles de rayon.** Aucun nouveau composant : la formule d'éventail déjà en place dans les tuiles de set (`off` × écartement, `off` × rotation, `zIndex: 3 − off`) est reprise à l'échelle de ces tuiles de 132 px. Empilement simple, ni flou ni profondeur 3D — ce n'est pas le hero. La carte de tête **garde exactement** la position et l'inclinaison qu'elle avait (`right: −20px`, `rotate(9deg)`) : les visuels ajoutés viennent derrière elle, donc aucune régression sur ce qui marchait déjà. Le sous-titre passe de `max-w-[62%]` à `56%` pour laisser passer l'éventail élargi.

Sélection des visuels : même logique que partout ailleurs — la carte la plus rare. `apercus_de_set` renvoie 3 rangs par set ; on ne garde désormais que le **`rang = 1`** de chaque set, pour qu'une tuile montre trois cartes prestigieuses de sets DIFFÉRENTS et non trois cartes du même set. Un `Set` de déduplication garantit qu'aucun visuel ne se répète d'une tuile à l'autre — sinon la rangée donnait l'impression d'un seul rayon répété cinq fois.

**Deux manques de données constatés en base, pas contournés.**
- `sealed_products` ne contient **qu'une seule ligne** dans toute la base (1 visuel). La tuile Scellés affiche donc 1 visuel et non 3. Elle en affichera 3 dès que le rayon sera rempli — la requête passe déjà à `.limit(3)`. Compléter avec des cartes à l'unité aurait mis des singles sous une étiquette « Scellés » : refusé.
- `consignment_items` compte **0 dépôt actif**. Le visuel de la tuile Dépôt-vente vient donc du catalogue, pas de la communauté — décoration assumée, comme avant cette mission.

Validation au rendu : flèches présentes et étiquetées · clic suivant ME05 → ME04, clic précédent ME04 → ME05 · **pause tenue** à +11 s (2 paliers écoulés sans changement) puis **reprise** à +19 s · sous `prefers-reduced-motion`, la flèche navigue toujours et l'auto-scroll reste muet · tuiles à **3 / 3 / 1 / 3 / 3 visuels**, tous chargés, **13 visuels distincts** sur l'ensemble de la rangée · aucun débordement horizontal · `npm run build` exit 0 · `tsc --noEmit` exit 0 · lint 0 problème.

Note d'outillage : les sondes CDP écrites via heredoc bash corrompent les échappements (`\n`, `\b` deviennent des caractères de contrôle), ce qui produit de faux négatifs — un test a d'abord conclu à tort que les flèches ne naviguaient pas. Les scripts de recette doivent être écrits en fichier, pas en heredoc.

### Session 26 — 2026-08-23 (filtres scellés/dépôt-vente · pseudo ≠ identité · adresse Stripe)

**1a. Scellés — le filtre par type existait déjà.** Vérifié avant de coder : `app/catalogue/scelles/page.tsx` porte les pilules de type depuis la refonte, adossées à `LABELS` qui couvre exactement les 6 valeurs de la contrainte `sealed_products_type_check` (booster · display · etb · tin · coffret · accessoire). Elles sont invisibles parce qu'un garde `present.length > 1` les masque, et que la base ne contient **qu'un seul produit scellé**. Le garde est juste — proposer « Tous / Boosters » sur un unique type serait du bruit — donc rien n'a été touché. Prouvé en semant deux types supplémentaires : les pilules apparaissent, `?type=coffret` et `?type=display` filtrent correctement. Semis retiré, base revenue à 1 produit.

**1b. Dépôt-vente — le manque était réel.** La page n'avait ni tri ni filtre. Ajout dans la grammaire des autres rayons (pilules sur `searchParams`, page serveur) : tri « Plus récentes / Prix ↓ / Prix ↑ » et filtre d'univers. Le tri part en SQL (`asking_price`, `created_at` sont de vraies colonnes) ; le filtre d'univers ne le PEUT pas — `consignment_items.card_id` ne porte aucun discriminant, c'est la table qui résout la carte qui fait foi. Il s'applique donc après résolution. Les contrôles restent affichés même quand le filtre courant ne ramène rien, sinon on ne pourrait plus revenir à « Tous ». Les compteurs de tête suivent le filtre (vérifié : 003/003 sans filtre → 001/001 en One Piece).

**2. Pseudo public ≠ identité — état trouvé AVANT migration.** `profiles` ne portait qu'un seul champ de nom, `full_name`, et il **servait déjà d'identité** : c'est lui qui est imprimé sur la facture PDF (`/api/invoice/[id]`) et employé comme `customerName` dans les e-mails de commande. Le flux de vérification (mission 10) ne capture, lui, **aucun nom** — seulement un document et un statut. Il n'y avait donc pas un « nom légal » à séparer d'un pseudo : il y avait un champ d'identité utilisé sans étiquette, qu'un utilisateur pouvait remplir d'un pseudo sans savoir qu'il renommait sa facture.

Décision : ne rien renommer et ne déplacer aucune donnée — cela aurait cassé la facturation pour un gain cosmétique. Migration 0032 ajoute `display_name` à côté, avec une contrainte de longueur 2–32, et écrit le rôle de chacun en commentaire de colonne. Le formulaire distingue désormais « Pseudo affiché » et « Nom d'identité », chacun avec sa phrase d'explication, plus un lien vers la vérification.

**Verrou en base, pas dans le formulaire.** Sans lui la séparation serait décorative : un compte vérifié pouvait réécrire son `full_name` en un clic et le document contrôlé ne correspondait plus au nom facturé. Trigger `profiles_verrou_identite`, avec dérogation admin pour corriger une saisie. Le statut validé s'appelle **`'verified'`** et non `'approved'` — vérifié dans la contrainte réelle avant d'écrire, sinon le trigger n'aurait jamais déclenché.

Éprouvé sur un compte jetable (créé puis supprimé, jamais celui du propriétaire) : pseudo modifiable sur compte vérifié **OK** · réécriture du nom d'identité sur compte vérifié **refusée**, valeur restée intacte · pseudo d'un caractère **refusé** par la contrainte · nom d'identité toujours modifiable tant que non vérifié **OK**.

**Aucune ouverture publique.** La RLS de `profiles` (« propriétaire ou admin ») n'est pas touchée. Audit des 43 lectures de `profiles` en code : toutes sont soit filtrées `.eq('id', user.id)`, soit derrière un contrôle de rôle. Le jour où l'attribution publique d'un dépôt sera voulue, elle passera par une fonction SECURITY DEFINER ne renvoyant que `display_name` — ouvrir la table exposerait `email`, `full_name` et `store_credit` du même coup.

**3. Adresse Stripe — déjà en place, vérifiée pour de vrai.** `shipping_address_collection` était **déjà actif** sur la Checkout Session. Le maillon fragile était ailleurs : le webhook lit `session.collected_information.shipping_details.address`, et les types du SDK (stripe 22.2.1, API `2026-05-27.dahlia`) confirment que le `Session.shipping_details` racine **n'existe plus** — `collected_information` est le seul chemin, et c'est bien celui employé. Chaîne complète vérifiée : session → webhook → `finalize` (`p_shipping_address`) → `orders.shipping_address` → facture PDF.

Aller-retour réel en mode test : session créée puis relue chez Stripe → collecte d'adresse **ACTIVE**, pays acceptés `BE FR LU NL DE`, champ `collected_information` présent. Session de recette refermée (`expired`), rien laissé derrière.

Validation : `npm run build` exit 0 · `tsc --noEmit` exit 0 · lint 0 problème · migration 0032 versionnée, md5 vérifié **byte-exact** contre `schema_migrations` (528805bd…) · semis de recette retiré, base revenue à 1 scellé / 0 dépôt / 1 profil.

Signalements ouverts :
- **`allowed_countries` inclut BE, LU, NL, DE** alors que CLAUDE.md pose « Boutique FR uniquement ». Divergence non corrigée : livrer aux pays limitrophes est peut-être voulu, c'est une décision commerciale, pas un bug à trancher seul.
- **`display_name` n'est pas unique.** Sans contrainte d'unicité, deux membres pourraient porter le même pseudo — sans conséquence tant que rien n'est public, à trancher avant toute attribution publique.
- **Migration `20260823162026 add_natural_sort_keys_pokemon_cards`** est présente en base mais absente de `supabase/migrations/` : le dossier local n'est pas au complet. Hors périmètre de ce brief.
- **Un compte `auth.users` de mars 2026 n'a pas de profil** (`contact.lassautomat@gmail.com`). Antérieur à cette mission.

### Session 27 — 2026-08-23 (réconciliation des migrations · switch de variantes · `username` unique)

**1. Repo et base réconciliés.** Comparaison systématique des 35 entrées de `supabase_migrations.schema_migrations` au dossier local, md5 par md5 — et pas seulement des 3 entrées annoncées. Résultat : les 32 fichiers existants étaient tous conformes, exactement 3 manquaient, aucun fichier local n'était orphelin, aucun divergent. Les 3 ont été matérialisés **byte-exact** (`add_pokeball_masterball_variant_types`, `add_mega_evolution_special_variant_types`, `add_natural_sort_keys_pokemon_cards`). Aucun commentaire explicatif ajouté dans ces fichiers : il aurait cassé l'égalité md5 qui EST la garantie du miroir. Nouvel audit : **35 fichiers / 35 entrées / 35 conformes**.

**2. Variantes — diagnostic mené avant toute UI.**

Fiabilité des données, mesurée et non supposée :
| | |
|---|---|
| listings Pokémon | 30 995, dont **30 995 avec `variant_type_id`** (aucun orphelin) |
| cartes à 1 variante | 13 121 |
| cartes à 2 variantes | 8 436 |
| cartes à 3 variantes | 334 |
| types de variantes | 11 (Normale, Reverse, Holo, 1ère édition, 6 Ball) |

**Ce n'était pas une perte de données, c'était un silence d'affichage.** La requête chargeait déjà TOUTES les lignes des cartes visibles (`.in('card_id', …)`) ; c'est le mapping qui n'en retenait qu'une par carte — la moins chère vendable — et laissait tomber les autres sans rien en dire. Le grillage par carte, lui, est un choix assumé de la session 21 (« le catalogue montre le set entier »), à conserver.

**Ce que le switch peut honnêtement changer.** Sur les 8 770 cartes multi-variantes : **14 seulement** ont un `image_api` distinct d'une variante à l'autre — la source ne photographie pas séparément un reverse. **0** ont des prix distincts (0 listing a un prix, tous univers confondus). **1 202** ont des quantités distinctes. Le switch ne promet donc pas un changement d'illustration : il donne accès à la bonne LIGNE de stock et à sa fiche. C'est écrit en tête de `VariantOption`, pour que personne ne le « corrige » plus tard en croyant à un bug.

Mise en œuvre : `CardEntry.variants` porte les versions ordonnées par `sort_order` ; `CardTile` en sélectionne une en état local et en dérive image, prix, état, stock, quantité **et lien**. Le panneau a été restructuré — le cadre et la physique passent sur le `<div>` racine, le `<Link>` ne couvre plus que le contenu — pour que le switch soit un FRÈRE du lien : un `<button>` dans une `<a>` est du HTML invalide et casse la navigation clavier.

Recette au rendu sur SV10 « Rivalités Destinées » : **244 tuiles pour 244 cartes**, 244 numéros distincts — **aucun doublon**, une seule tuile par carte · **165 switchs**, exactement les 165 cartes multi-variantes que la base annonce pour ce set · bascule Normale → Reverse → retour · le clic **ne navigue pas** · **0 bouton imbriqué dans une ancre** · le `href` de la tuile suit la variante affichée (`/f2889ccb…` → `/c07ce9e7…`).

**One Piece intact**, comme demandé : `gereVariantes = universe === 'pokemon'`, tableau vide ailleurs. Vérifié au rendu — 87 tuiles, **0 switch**.

**3. `display_name` → `username`, unique.** « Display » désigne déjà une boîte de boosters sur ce site (`sealed_products.type = 'display'`) : `display_name` s'y lisait « nom du display ». `username` plutôt que `pseudo` parce que toutes les colonnes de `profiles` sont en anglais snake_case — `pseudo` y aurait été la seule française.

Doublons cherchés **avant** de poser la contrainte, en strict ET à la casse près : **aucun** (et aucune valeur renseignée, 1 profil en base). Rien à arbitrer.

L'unicité est **insensible à la casse et aux espaces de bord** (`lower(btrim(username))`) : un index sur la valeur brute aurait laissé coexister « Tanuki » et « tanuki », deux comptes indiscernables à l'œil d'un acheteur — exactement l'usurpation que l'unicité doit empêcher. Index partiel : plusieurs comptes sans pseudo restent possibles. Éprouvé sur deux comptes jetables : A prend « Tanuki », B se voit refuser «  tAnUkI  », et B reste à NULL. Comptes supprimés, base revenue à 1 profil.

Le GRANT UPDATE colonne a survécu au renommage — vérifié : `authenticated` peut écrire `avatar_url`, `full_name`, `username`, et rien d'autre. Le formulaire traduit désormais l'erreur 23505 en « Ce pseudo est déjà pris » plutôt que d'afficher le nom de l'index.

Validation : `npm run build` exit 0 · `tsc --noEmit` exit 0 · lint 0 problème · migration 0033 versionnée, md5 byte-exact (381b9656…) · audit migrations 35/35 · base revenue à la ligne de base après chaque test.

### Session 28 — 2026-08-23 (BG-01 : le fond carte marine ne rendait pas sur One Piece)

**Cause : B, seule.** `OnePieceMapBackground.v3.tsx` n'était référencé nulle part — pas même importé. Le brief supposait « un import non utilisé passe le build sans warning » ; la réalité était plus simple, il n'y avait aucun import. Correction : deux lignes dans `app/catalogue/onepiece/page.tsx` (import + `<OnePieceMapBackground />` dans le JSX). Rien d'autre n'a été touché.

**Causes A et C écartées par la mesure, pas par raisonnement.** `AtmosphereLayer` porte déjà **exactement** la même classe `pointer-events-none fixed inset-0 -z-10` sur cette page, et l'inspection au rendu le donne à 1440×900, `visible=true`. Un `-z-10` s'y peint donc parfaitement : le fond parchemin est posé sur `<body>`, dont l'arrière-plan est propagé au canevas de la page et ne recouvre pas ses propres enfants. Le correctif z-index proposé (`z-0` + `z-10` sur le contenu) aurait donc soigné un mal inexistant, tout en faisant passer la carte AU-DESSUS de la couche atmosphère. **Non appliqué.** Cause C écartée de même : aucun ancêtre de `<main>` ne porte `transform`, `filter`, `backdrop-filter`, `perspective`, `contain` ou `will-change` — Lenis interpole le scroll natif ici, il n'enveloppe rien dans un conteneur transformé.

**⚠️ Conflit à arbitrer — et ce n'est PAS celui que le brief anticipait.**

Le brief attendait deux boussoles. Il y en a **une**. Le `<rect fill={SEA} />` de la ligne 86 est **hors** du groupe `<g opacity={opacity}>` : il est donc opaque à 100 %, quelle que soit la valeur d'`opacity`. Peint après `AtmosphereLayer` (ordre DOM), il **masque intégralement** la rose des vents du système d'univers ET le dégradé parchemin du site, sur toute la surface de cette page.

Mesuré par échantillonnage de pixels, trois états comparés :
| point | Pokémon (témoin) | One Piece + carte | One Piece, carte masquée |
|---|---|---|---|
| 60,95 | rgb(230,220,203) | rgb(226,213,185) | rgb(230,220,203) |
| 1180,250 | rgb(240,237,233) | rgb(226,213,185) | rgb(221,215,206) |
| 1390,120 | rgb(220,214,205) | rgb(238,230,212) | rgb(220,214,205) |

Chaque point revient exactement à sa valeur témoin dès qu'on masque la carte : l'occlusion est démontrée, pas supposée.

Conséquence doctrinale : CLAUDE.md impose deux cartographies distinctes montées sur tout le parcours public, et pose que « le fond ne porte que le motif d'univers et le gradient radial ». En l'état, la carte marine **remplace** le motif d'univers One Piece au lieu de s'y ajouter. Rien n'a été supprimé ni modifié de moi-même : ni la géographie, ni la palette, ni la rose du SVG, ni `opacity = 0.4`, ni `AtmosphereLayer`. **Trois issues possibles, à trancher par RYUU** : rendre le rect de mer transparent ou le passer dans le groupe d'opacité (le fond du site réapparaît sous la carte) ; retirer `AtmosphereLayer` de cette route (la carte devient la cartographie One Piece) ; ou masquer la rose du SVG et garder celle du système.

**Validation mesurée.** Carte visible en sépia pâle derrière la grille · fond **fixe** au scroll (top des deux couches : 0,0 avant et après un scroll de 900 px) · tuiles au premier plan et cliquables (l'élément au centre d'une tuile lui appartient) · aucune modification d'apparence des vignettes · `tsc --noEmit` exit 0 · lint 0 problème · `npm run build` exit 0.

**Sur la lisibilité de « 87 CARTES · 0 DISPO ».** Première mesure fausse de ma part : elle ignorait l'alpha du texte (`rgba(26,22,17,0.6)`) et annonçait 13,83:1. Recalculée avec la composition réelle sur le fond peint : **4,30:1 avec la carte**, contre 4,21:1 sans la carte et 4,24:1 sur Pokémon. La carte ne dégrade donc pas ce texte — elle l'améliore marginalement. En revanche ce libellé est **déjà sous le seuil AA (4,5:1) partout sur le site**, carte ou non : constat site-wide, antérieur à ce brief, non traité ici.

### Session 29 — 2026-08-23 (fond One Piece étendu · pagination 30/50 généralisée)

**1a. Fix du rect de mer.** Le `<rect fill={SEA}>` est passé DANS le groupe `<g opacity={opacity}>`. Hors de lui il était opaque à 100 % quelle que soit la valeur d'`opacity` et recouvrait le parchemin et le dégradé radial du site. Mesure avant/après aux mêmes points : avec la carte opaque, les trois échantillons donnaient tous la même valeur plate `rgb(226,213,185)` ; ils donnent maintenant `rgb(222,207,181)`, `rgb(216,204,182)` et `rgb(227,220,208)` — trois valeurs distinctes, c'est-à-dire le dégradé du site qui transparaît. Ni la géographie, ni la palette, ni la rose, ni `opacity = 0.4` n'ont été touchées.

**1b. Extension par un LAYOUT, pas page par page.** `app/catalogue/onepiece/layout.tsx` monte la carte pour les TROIS routes One Piece — index des sets, séries, détail de set. Le montage direct posé au brief précédent dans `page.tsx` a été retiré (il aurait doublé la carte). Un montage page par page laisserait une route sans motif dès qu'on en ajoute une, alors que l'exclusion d'`AtmosphereLayer`, elle, s'appliquerait quand même : le layout et l'exclusion partagent désormais le même préfixe et ne peuvent pas diverger.

**1c. Double rose évitée.** `/catalogue/onepiece` ajouté à `EXCLUDED` dans `AtmosphereLayer`. Vérifié au rendu sur six routes — les trois One Piece : carte 1 / canvas 0 ; Pokémon, home, dépôt-vente : carte 0 / canvas 1. **Une seule rose partout**, et la couche reste active hors One Piece.

**2. Pagination — le pattern annoncé n'existait pas.** Le brief demandait de reprendre « le pattern déjà construit côté admin/Poneglyphe ce soir ». Recherche exhaustive du dépôt : **aucun composant de pagination, aucun `perPage`/`pageSize`/`PAGE_SIZE`, aucun `localStorage`, nulle part** — ni dans `app/admin/**`, ni ailleurs. Le seul mécanisme approchant était le bouton « Voir tous les sets » de `SetsIndex`, qui déplie tout d'un coup. Rien n'a donc été « repris » : le composant est neuf, écrit dans la grammaire du site (pilules `.pill`, mono `.data`, comme la barre d'outils de set).

**Mémoire par COOKIE, pas `localStorage`.** Ces grilles sont rendues côté serveur : le serveur lit un cookie, pas `localStorage`. Avec `localStorage` chaque arrivée sur une page aurait rendu 30 puis re-rendu à 50 — un clignotement systématique. Priorité : URL (`?par=50`, partageable) > cookie (la mémoire) > défaut 30.

**Un seul composant, deux pilotages.** `<PaginationUrl>` pour les grilles serveur pilotées par l'URL ; `<Pagination>` piloté par callback pour `SetsIndex`, dont les filtres sont en état local et qu'il aurait fallu réécrire pour les porter dans l'URL — hors périmètre, et le garde-fou interdisait de casser les filtres existants. Même rendu visuel dans les deux cas. Le cookie est écrit à un seul endroit et relu via `useSyncExternalStore`, ce qui évite à la fois la divergence d'hydratation et le `setState` dans un effet.

`lib/pagination.ts` a dû être scindé : il importait `next/headers` alors que des composants CLIENTS l'importent. `resoudreParPage` vit désormais dans `lib/pagination.server.ts`.

**Pages où la pagination a été ajoutée** (4 grilles, 6 routes) :
| grille | routes | volume réel |
|---|---|---|
| `SetDetail` | `/catalogue/pokemon/[set]`, `/catalogue/onepiece/[set]` | jusqu'à 299 cartes ; 143 des 200 sets Pokémon dépassent 30, 137 dépassent 50 |
| `SetsIndex` | `/catalogue/pokemon`, `/catalogue/onepiece` | 200 sets Pokémon, 30 One Piece |
| Scellés | `/catalogue/scelles` | 1 produit aujourd'hui — la barre reste masquée sous 30 |
| Dépôt-vente | `/depot-vente` | 0 pièce aujourd'hui — idem |

**Garde-fou tenu : la pagination est la DERNIÈRE opération.** Elle découpe un résultat déjà filtré et déjà trié, jamais l'inverse. Corollaire nécessaire : tout changement de filtre, de tri ou de recherche **remet en page 1** (`next.delete('page')` dans `SetToolbar`, `setPage(1)` dans `SetsIndex`, `page` jamais reporté dans les `qs()` des rayons) — sans quoi filtrer depuis la page 7 d'un set de 299 cartes atterrissait sur une page inexistante. Le choix `par`, lui, est conservé : c'est une préférence d'affichage, pas un filtre.

Recette au rendu (SV10, 244 cartes) : page 1 → 30 tuiles, « 1–30 sur 244 » · page 3 → « 61–90 » · `?par=50` → 50 tuiles · `?par=50&page=5` → 44 tuiles, « 201–244 » · `?page=99` → ramené à la page 9, pas de grille vide · filtre rareté → total 244 → 85, page remise à 1. Mémoire : clic sur « 50 » écrit le cookie, puis un set de l'AUTRE univers ouvert **sans `?par`** s'affiche à 50, et l'index des 194 sets Pokémon aussi. Compteurs de dépôt-vente et libellé de `SetDetail` corrigés pour annoncer la tranche, pas le total.

Validation : `tsc --noEmit` exit 0 · lint 0 problème · `npm run build` exit 0.

Signalement (hors périmètre, non traité) : **le champ de recherche du header poste `q` vers `/catalogue`, qui ne lit pas ce paramètre** — `app/catalogue/page.tsx` n'est qu'une page d'accueil de rayons avec des compteurs. La recherche globale du site ne renvoie donc aucun résultat. Il n'y a pas de page de résultats à paginer parce qu'il n'y a pas de recherche : c'est une fonctionnalité à construire, pas une pagination à ajouter.

### Session 30 — 2026-08-23 (recherche globale : la fonctionnalité derrière le champ du header)

**Le champ existait sur toutes les pages et postait vers `/catalogue`, qui ne lit pas `q`.** Route `/recherche` créée ; `SiteHeader` change d'`action` — une ligne, apparence intacte.

**Accents — le point dur, traité en base.** `unaccent` et `pg_trgm` activées dans le schéma `extensions` (aucune n'était installée ; `fuzzystrmatch` volontairement laissée de côté, aucun besoin établi). Volumes vérifiés avant de coder : **4 111 cartes Pokémon, 157 One Piece et 80 sets** portent un nom accentué.

**Wrapper IMMUTABLE plutôt que colonne maintenue par trigger.** `unaccent()` est STABLE et refusée dans un index ; les deux voies étaient ouvertes. Le wrapper l'emporte parce qu'il **ne peut pas dériver** : c'est Postgres qui calcule l'expression indexée, donc aucun chemin d'écriture — import en masse, MCP — ne peut la contourner. Une colonne aurait demandé cinq triggers, un backfill de 23 843 lignes, et se serait désynchronisée au premier chemin oublié. La dictionnaire est épinglée (`'extensions.unaccent'::regdictionary`) : sans ça, déclarer IMMUTABLE serait faux.

**`search_catalogue(terme, limite)`** — rangs 0 référence exacte / 1 égalité / 2 préfixe / 3 contenu / 4 similarité, et à rang égal **le stock devant**. Fonction STABLE et non SECURITY DEFINER : le catalogue est déjà en lecture publique, elle n'ouvre rien de plus.

**Collision trouvée en base, non supposée : `SV10` est À LA FOIS un code de set (Rivalités Destinées) et un numéro de carte (set SMA).** D'où le code de set au rang 0 et le numéro de carte au rang 1 — sans cette hiérarchie la carte remontait avant le set. `SV10 197`, `sv10-197` et `SV10197` sont traités comme un même besoin via un terme « recollé ».

**⚠️ Défaut que j'ai introduit en 0034, mesuré puis corrigé en 0035.** Le prédicat des cartes portait un OR dont la dernière branche traversait DEUX tables (`s.code || c.number`). Un OR multi-tables ne peut pas devenir condition d'index : le planificateur le dégrade en Join Filter. Plan constaté sur « dracaufeu » : **Seq Scan sur les 21 891 cartes, 21 755 lignes rejetées après jointure, 514 ms** — au-dessus du seuil de 300 ms posé par le brief. Les mêmes prédicats de nom SEULS donnaient **12 ms en Bitmap Index Scan** : l'index et la normalisation étaient bons, c'est la forme de la requête qui les rendait inutilisables. La branche « référence » est devenue un membre UNION ALL amorcé par les sets (200 lignes), et les branches de nom sont redevenues mono-table.

Plan après correction, branche principale : `Bitmap Index Scan on idx_pokemon_cards_nom_trgm` (deux fois) + `idx_pokemon_cards_numero_norm`, **8,6 ms, aucun seq scan sur les cartes**. Fonction complète : **173 ms** contre 514 avant.

Note : la 0034 posait `SET pg_trgm.similarity_threshold = 0.4` sur la fonction. Ce SET n'était accepté que parce que l'extension était créée dans la même transaction ; une fois pg_trgm chargée, le paramètre est refusé au rôle de migration. La 0035 s'en remet au seuil par défaut (0,3), sur la branche floue qui est de toute façon la dernière du classement.

**Page de résultats.** Deux vues sur une seule route : groupée (chaque groupe plafonné à 6) et par type (`?type=`), cette dernière **paginée avec le composant existant**, pas un second. `q` vide ou à moins de 2 caractères : **aucune requête lancée**, invite affichée.

**Piège évité sur les « voir tout ».** Ils pointent vers `/recherche?q=…&type=…`, PAS vers `/catalogue/pokemon?q=…` : `SetsIndex` garde sa recherche en état local et ignore `q` dans l'URL — ce lien aurait été mort, exactement le défaut que cette mission corrige.

**Défaut attrapé à la recette.** La vue groupée rendait les groupes dans l'ordre de déclaration : sur « SV10 », la base classait bien le set en rang 0, mais la page affichait « Cartes Pokémon » au-dessus. Les groupes sont désormais ordonnés par leur meilleur rang — l'affichage suit le classement de la base au lieu de le contredire.

Recette au rendu, les 8 cas du brief plus 2 : `salameche` → Salamèche · `energie obscurite` → Énergie obscurité · `ecarlate` → Écarlate et Violet · `SV10` → **Sets Pokémon en tête, Rivalités Destinées** (2 résultats, pas 244) · `SV10 197` → Motisma, résultat unique · `TG12` → 8 cartes · `dracaufeu` → Dracaufeu · `xyzzy` → état vide avec portes de sortie · `a` et terme vide → invite, aucune requête. Vue par type : 30 vignettes, « 1–30 sur 136 cartes », pagination présente. `action` du formulaire header = `/recherche`.

**« En stock d'abord » prouvé par semis.** 0 listing n'ayant de prix, le critère était juste mais invérifiable. Un prix (12,50 €, qté 2) posé sur un Dracaufeu : il passe en **position 1** devant les autres au même rang. Ligne restaurée à 0.00 / 0 — base revenue à 0 listing avec prix, 1 641 avec stock.

Validation : `tsc --noEmit` exit 0 · lint 0 problème · `npm run build` exit 0 · migrations 0034 et 0035 versionnées, md5 vérifiés **byte-exact** (a89ec61d…, 854b05d9…). Une fonction de service temporaire a servi au dump des fichiers locaux, puis a été supprimée (vérifié : 0 reste).

Signalement : le classement « stock d'abord » restera sans effet visible tant qu'aucun listing n'aura de prix — **0 sur 30 995 aujourd'hui**.

### Session 31 — 2026-08-23 (BG-02 : fond Poké Ball sur les routes Pokémon)

Même patron que #BG-01. `app/catalogue/pokemon/layout.tsx` monte `PokemonBallBackground` pour les TROIS routes — index, séries, détail de set — et `/catalogue/pokemon` rejoint `EXCLUDED` dans `AtmosphereLayer`. Layout et exclusion partagent le même préfixe : ils ne peuvent pas diverger. Aucun montage direct en page, aucun doublon possible.

Le composant portait déjà `z-0` et **aucun rectangle de fond** : les deux pièges du brief étaient évités à la source. Rien n'a été touché dans le SVG — ni géométrie, ni couleurs, ni `opacity = 0.3`, ni `saturation = 0.55`.

**Une différence de mécanisme avec One Piece, assumée mais à connaître.** La carte marine est en `-z-10` et se glisse sous un contenu resté en flux normal. Ce fond-ci est en `z-0` : à cette profondeur, un `fixed` se peint AU-DESSUS du contenu statique, non positionné. Le contenu doit donc remonter — d'où le `relative z-10` posé dans le layout plutôt que dans chaque page. Deux mécanismes font désormais le même travail selon l'univers. À noter que la raison invoquée pour écarter `-z-10` (« invisible sous le parchemin ») avait été **mesurée fausse** en #BG-01 : le parchemin est porté par `<body>`, dont l'arrière-plan est propagé au canevas de la page et ne recouvre pas ses propres enfants. Les deux voies marchent ; on en a maintenant une par univers.

**Anti-doublon : aucun conflit.** Vérifié en code et au rendu — la « Poké Ball décorative préexistante » était `AtmosphereCanvas.drawPokeball()`, c'est-à-dire `AtmosphereLayer` lui-même, désormais exclu de ce préfixe. Le seul autre `<svg>` de ces écrans est la loupe du champ de recherche. Il n'y a donc pas deux Poké Balls à arbitrer : l'ancienne a cédé la place à la nouvelle, exactement comme la rose des vents en #BG-01.

**Conséquence doctrinale à signaler.** Les deux rayons d'univers sont maintenant exclus d'`AtmosphereLayer`. La signature motion n°5 de CLAUDE.md — le morph croisé d'`AtmosphereCanvas` entre rose des vents et Pokéball — ne joue donc plus sur les routes où les univers diffèrent réellement ; le canvas ne subsiste que sur les écrans neutres (home, dépôt-vente, scellés, rachat, compte). Chaque univers a désormais son fond dessiné dédié, plus riche que le canvas. C'est un gain visuel, mais c'est un point de doctrine verrouillée qui a changé : à acter ou à corriger, pas à laisser passer en silence.

Recette au rendu, sept routes : PKM index / séries / détail → **fond Poké Ball 1 (5 balls), carte marine 0, canvas 0** · OP index / détail → **carte marine 1, Poké Ball 0, canvas 0** (inchangées) · home et dépôt-vente → **canvas 1** (couche toujours active hors rayons d'univers). Fond **fixe** au scroll (top 0 → 0 après 1 200 px) · vignettes au premier plan et cliquables · aucun débordement horizontal.

Lisibilité du texte le plus fragile : « 1–30 sur 244 cartes · 0 disponible à l'achat » mesuré avec composition alpha réelle à **4,32:1** sur fond `rgb(232,225,216)`, contre 4,24:1 relevé sur cette même page avant le fond (session 28). Le motif ne dégrade pas ce texte. Il reste sous le seuil AA 4,5:1 — constat site-wide antérieur, hors périmètre.

Validation : `tsc --noEmit` exit 0 (après régénération des types de routes par le build — l'erreur `LayoutRoutes` initiale est un artefact de `.next/types` périmé, déjà rencontré au layout One Piece) · lint 0 problème · `npm run build` exit 0.

Note d'outillage : deux faux négatifs de mes propres sondes CDP sur cette recette — un sélecteur `div` qui attrapait un ANCÊTRE du fond au lieu du conteneur `fixed` (d'où un « il défile » erroné), et un `elementFromPoint` visant hors viewport après scroll. Cibler le conteneur par `getComputedStyle(el).position === 'fixed'` et ne tester que des éléments visibles à l'écran.

### Session 32 — 2026-08-23 (LOGO-01 : validation des visuels de set + affichage du logo)

**Volet 1 — `--cible=cartes|sets|tout`, un seul script, un seul rapport.** `validate-card-images.ts` teste désormais aussi `pokemon_sets.image_url` (logo) et `symbol_url` (symbole). Toute la logique de sûreté est conservée telle quelle : dry-run par défaut, `--apply` obligatoire, seuls 404/403/410 nullifiés, timeout et 5xx classés indéterminés, `SEUIL_ABANDON` actif, écriture par lots, cache d'URL partagé.

Deux points de conception qui ne vont pas de soi :
- **Une requête d'UPDATE par colonne.** Logo et symbole ne peuvent pas être groupés dans le même `update` : un set peut avoir un logo mort et un symbole valide, et écrire `{image_url: null, symbol_url: null}` effacerait le symbole encore bon.
- **Aucun univers exclu en dur.** Le brief demandait de ne pas traiter `onepiece_sets` (0 URL). Plutôt qu'une exclusion codée, le filtre `image_url ou symbol_url non nul` le fait sortir naturellement vide — et le jour où l'import en fournira, il sera testé sans rien changer.

**Rapport dry-run sur les sets — rien à appliquer.** 274 visuels testés (121 logos + 153 symboles), **274 valides, 0 mort, 0 indéterminé, en 2,8 s**. Tous les statuts à 200. `--apply` n'a donc pas lieu d'être et n'a pas été lancé. One Piece : 0 visuel à tester, comme prévu.

Non-régression vérifiée : `--cible=cartes --set=ME05` → 105 cartes testées, 0 visuel de set — comportement historique reproduit à l'identique ; le défaut `tout` sur le même set → 105 + 2 = 107. Compteurs base identiques avant et après le dry-run (121 logos / 153 symboles / 18 472 cartes PKM / 1 721 OP).

**Volet 2 — `SetVisual`, chaîne de repli logo → symbole → cadre.**

Le commentaire d'en-tête de `SetDetail` était devenu FAUX : il justifiait l'éventail de cartes par « `*_sets.image_url` est NULL pour la totalité des sets ». C'était vrai à l'époque du portage, ce ne l'est plus — 121 sets sur 200 ont un logo. Ce brief défait donc une substitution qui n'avait plus lieu d'être. L'éventail des cartes les plus chères en vente est retiré de ce bloc, et la requête `preview` qui l'alimentait avec lui (elle exigeait `price > 0`, donc ne renvoyait rien : aucun listing n'a de prix).

Le logo est l'**état par défaut**, pas l'état « rupture » : l'affichage n'est plus conditionné au stock, le filtre « Disponibles » répond déjà à cette question.

Points d'implémentation :
- **`symbol_url` n'existe que sur `pokemon_sets`.** Le demander à `onepiece_sets` faisait échouer la requête entière — la liste de colonnes est donc construite selon l'univers.
- **Repli au runtime** par `onError`, côté client : la validation serveur réduit le risque d'URL morte, elle ne l'annule pas, le CDN peut tomber après la passe.
- **Pas de plaque de fond.** Les PNG TCGdex sont transparents ; une plaque claire aiderait un logo sombre mais écraserait un logo clair, et l'inverse. Deux `drop-shadow` — un halo clair serré, une ombre portée douce — décollent le visuel du parchemin sans le recouvrir, quelle que soit sa valeur.
- **Le symbole n'est pas agrandi** à la taille du logo : 76 px (92 en `lg`), centré.

Recette des cinq cas, au rendu : ME05 → **LOGO** natif 732×210 · SV10 → **LOGO** natif 604×242 · SMP → **SYMBOLE** 92 px · SVP → **CADRE** · B1 (symbole, 0 carte) → **SYMBOLE**. One Piece EB02, témoin sans visuel → **CADRE**, sans erreur. `object-fit: contain` confirmé calculé sur tous les cas. Lisibilité du logo le plus sombre (ME05 « Nuit Noire ») : pixel le plus sombre `rgb(0,0,0)` contre parchemin `rgb(232,225,216)` → **16,19:1**.

Piège de mesure à noter : ma sonde comparait le ratio de la BOÎTE au ratio natif et annonçait « 60,8 % de déformation » sur B1. C'est faux — `object-contain` letterbox sans étirer ; la métrique mesurait le conteneur, pas l'image peinte. Vérifié à l'œil sur capture : aucun étirement.

**Écart assumé avec le brief, à arbitrer.** Le brief demandait le cadre rayé « inchangé ». J'ai changé son libellé, de « aucune pièce en vente » à « visuel non disponible » : ce bloc ne parle plus du tout de stock, et un set de 220 cartes sans logo aurait affiché un message sur la vente qui n'a plus de rapport avec ce qu'il montre. Le traitement visuel du cadre, lui, est inchangé. Une ligne à revenir si l'ancien libellé était voulu.

Validation : `tsc --noEmit` exit 0 · lint 0 problème · `npm run build` exit 0 · aucune écriture en base.

Signalement : les 79 sets sans logo et 47 sans symbole ne sont pas traités ici — la liste des visuels manquants est un sujet séparé, comme posé par le brief.

### Session 33 — 2026-08-24 (ARCHI-01 : séparation variantes / exemplaires, Pokémon)

**Décision structurelle irréversible sur la table centrale, exécutée après validation du plan.** Migrations 0036 (schéma + données) et 0037 (fonctions).

**Renommage en place plutôt que recréation.** `pokemon_listings` → `pokemon_card_variants`, **clés primaires conservées**. La fiche produit `/[slug]` et le sitemap étant indexés dessus, les 30 995 URL publiques restent valides et pointent désormais sur la variante — le bon objet de catalogue : elle existe pour toutes les lignes et survit aux mouvements de stock.

**Résultat mesuré : 30 995 variantes, 1 641 exemplaires, 0 écart** sur la comparaison couple par couple `(carte, variante, quantité)` menée dans les deux sens contre une sauvegarde logique prise avant migration. Chaque exemplaire pend sur SA variante d'origine — aucun rattachement générique.

**Trois découvertes qui ont changé le plan, toutes vérifiées avant d'écrire :**
- `set_needs_photo` est **partagée avec `onepiece_listings`** : elle est attachée à la nouvelle table, jamais modifiée.
- Sur les six fonctions citant `pokemon_listings`, **trois seulement** avaient besoin d'être réécrites. `reserve_order_stock`, `restock_order` et `finalize_paid_order` adressent par nom de table et par `id`, en ne touchant que `quantity` / `is_active` / `updated_at` — colonnes que la nouvelle table porte toujours. Le pipeline de commande n'a pas été touché, ce qui est la bonne nouvelle de cette migration.
- **Aucune FK ne pointait sur `pokemon_listings`** et `order_items` est vide : aucune casse référentielle.

**Contraintes d'unicité, séparées selon ce que chacune protégeait.** L'UNIQUE total sur 4 colonnes n'était total que pour satisfaire l'inférence `ON CONFLICT` de PostgREST : son héritier est `UNIQUE (card_id, variant_type_id)` sur la variante, qui redevient une vraie clé naturelle. L'index partiel `WHERE price < 1.0` portait la règle bulk et suit l'exemplaire tel quel.

**Verrouillage par champ — approche A validée.** `locked_fields text[]` + trigger `BEFORE UPDATE` par table. Le sens de l'échec est orienté : les verrous s'appliquent TOUJOURS, sauf si la transaction lève `goriki.edition_manuelle`. Un CHECK refuse les noms de champs invalides — un verrou mal orthographié ne protégerait rien, en silence. `locked_fields` n'est lui-même jamais verrouillable, sinon le relâchement serait impossible.

Test décisif passé : nom verrouillé **survit** à l'import · rareté non verrouillée **bien mise à jour** dans le même UPDATE · après relâchement la valeur API **revient** · image manuelle **survit** et l'emporte · nom de champ invalide **refusé**.

**Images : colonne générée, conformément à l'arbitrage.** `image_url` devient `coalesce(image_manuelle, image_api)` sur `pokemon_cards` ET `pokemon_card_variants`. Les 18 fichiers continuent de lire `image_url` : **zéro `coalesce` applicatif**, et la provenance devient structurelle. Contrôle : 0 carte sur 21 891 sert un `image_url` différent d'avant migration.

Conséquence à connaître : `image_url` refuse désormais toute écriture. Deux écrivains ont dû être repointés — `lib/import/pokemon.ts` (écrit `image_api`) et `scripts/validate-card-images.ts`, ce dernier avec une **asymétrie assumée** : `image_api` côté Pokémon, `image_url` côté One Piece, dont la table n'est pas migrée.

**Suppression de variante — `ON DELETE RESTRICT`, jamais de CASCADE.** Fonction `supprimer_variante(variante, cible?)` avec ses trois cas. Éprouvé : variante sans exemplaire supprimée · variante avec stock sans cible **refusée**, stock intact après le refus · avec cible, exemplaires **déplacés et renumérotés** · DELETE direct **bloqué par la FK** · retour à 1 641 exemplaires.

**Volet 3 — chaîne de repli du visuel de variante.** `image_url` de la variante → `image_url` de la carte **avec le label en surimpression** → placeholder. Le niveau 2 concerne **4 286 variantes sur 30 995**, un affichage sur sept : le bandeau est un dégradé encre posé en BAS (le sujet de la carte occupe le haut) et tient sur illustration claire comme sombre, là où une étiquette d'une seule teinte disparaîtrait sur l'une des deux. Composant `VariantVisual` pour les surfaces neuves ; sur `CardTile` le bandeau est ajouté sans toucher à la parallaxe existante.

**Adaptation applicative.** Un module `lib/catalogue/variantes.ts` absorbe la différence de schéma entre les deux univers et rend une forme unique, pour que `SetDetail` n'ait pas à connaître deux modèles. Fichiers repointés : `SetDetail`, `series.ts`, `[slug]`, `page.tsx` (home), `api/catalogue`, `sitemap`, `wishlist`, les deux `want-to-buy`, `import/pokemon.ts`, `import-stock-xlsx.ts`, `validate-card-images.ts`, `CardTile`.

Point sensible traité : **ce qu'on met au panier est un EXEMPLAIRE**, pas la variante — c'est lui que le checkout réserve et décrémente. L'URL porte la variante, le panier porte l'exemplaire.

Validation : `tsc --noEmit` exit 0 · lint 0 erreur sur les fichiers touchés · `npm run build` exit 0 · `search_catalogue` rend les **8 cas de recette à l'identique** · API PostgREST après `NOTIFY pgrst` : 30 995 / 1 641 / 21 891 · rendu sans erreur sur home, index PKM, détail SV10 (30 tuiles, 27 switchs), détail OP témoin, recherche, dépôt-vente, rachat, panier, scellés, want-to-buy, catalogue · `/api/catalogue` renvoie 1 641 résultats paginés.

**Signalements ouverts :**
- **`app/api/listings/route.ts` est cassé pour Pokémon** — il lit `card_id`, `variant_type_id` et `image_api` sur l'exemplaire. C'est l'API de l'écran d'ADMINISTRATION, que le brief place explicitement hors périmètre (« il viendra après, sur le nouveau schéma »). Non touché, à traiter dans ce brief-là.
- Les tables `_sauvegarde_archi01_listings` et `_sauvegarde_archi01_cards` sont **conservées** le temps de ta validation. Elles sont dans `public` : RLS activée et droits révoqués pour `anon`/`authenticated` — sans quoi PostgREST les aurait exposées. À supprimer sur ton feu vert.
- `pokemon_variant_types.set_id` reste NULL sur les 11 types : `variantes_autorisees()` et son trigger sont en place mais laissent tout passer tant qu'aucun set n'est scopé. La saisie est le travail de nettoyage à venir.
- Le lint du dépôt entier remonte **12 erreurs préexistantes** dans des fichiers jamais touchés par cette mission (`admin/clients`, `admin/commandes`, `cart/*`, `HeroCarousel`) — `no-explicit-any` et `set-state-in-effect`. Révélées parce que j'ai linté tout le dépôt pour la première fois ; antérieures à ARCHI-01.

### Session 34 — 2026-08-24 (ADMIN-01 : écrans de nettoyage du catalogue Pokémon)

Deux écrans neufs — `/admin/catalogue` (200 sets) et `/admin/catalogue/[setId]` (cartes d'un set) — plus les actions serveur. Migrations 0038 et 0039.

**Aucun style introduit.** Tout est bâti sur le système admin existant : `.admin-table`, `.admin-row`, `.admin-cell`, `.admin-col-heads`, `.admin-kpi-*`, `.admin-mini-input`, `.ab-*`. La contrainte était explicite et elle a été tenue — aucune règle CSS ajoutée, aucun token créé.

**Tout passe par des RPC, jamais par un `.update()` direct.** Le trigger de verrou refuse toute écriture sur un champ verrouillé sauf si la transaction lève `goriki.edition_manuelle` — ce qu'une requête PostgREST ne peut pas faire, chacune vivant dans sa propre transaction. Les RPC le lèvent en interne. La garde `is_admin()` est dans chaque fonction ; l'action serveur la double pour rendre une erreur lisible, mais c'est celle de la base qui compte.

**⚠️ Défaut de sécurité trouvé et corrigé dans ma propre 0038 (migration 0039).** `set_config(..., is_local => true)` porte sur la TRANSACTION, pas sur l'appel. Une fois qu'une RPC avait levé le drapeau, **tout écrit ultérieur dans la même transaction contournait les verrous**. Révélé par le test : appeler `admin_corriger_carte` puis, dans la même transaction, un UPDATE simulant l'import — l'UPDATE passait et écrasait la correction. En production PostgREST isole chaque requête, donc le trou ne s'ouvrait pas par ce chemin ; mais un futur script ou un batch groupant plusieurs opérations aurait fait sauter des verrous en silence. Chaque RPC repose désormais le drapeau à `off` avant de rendre la main. Re-testé : le verrou tient **dans la transaction même de la RPC**, et un champ non verrouillé y reste modifiable.

**Deuxième correction d'un défaut de conception, celui de la 0036.** J'y avais prévu de restreindre les types de variantes par `pokemon_variant_types.set_id`. C'est un piège : les 11 types sont GLOBAUX et partagés — poser un `set_id` sur la ligne « REVERSE » l'aurait retirée de tous les autres sets, et les 30 995 variantes existantes pointent sur ces lignes. Remplacé par une table d'autorisation `pokemon_set_variant_types` : elle restreint sans rien déplacer, et un set sans ligne garde les 11 types. `admin_definir_types_set` **refuse** une restriction qui exclurait des variantes déjà saisies, plutôt que de mettre la base dans un état que son propre contrôle rejette.

**Ce qui rend l'outil utilisable, dans l'ordre du brief.** Densité : une carte = une ligne, les variantes se déplient sous la ligne et non dans une colonne — à 299 lignes, une colonne de plus coûte une lecture. Clavier : Entrée valide, **Tab enregistre AVANT de céder le focus**, Échap annule la saisie. Sans rupture : `useTransition` + `revalidatePath`, ni rechargement ni perte de position. Avancement : jauge par set et trois compteurs globaux visibles en permanence. Annulation : un « ↶ » rend la valeur d'avant la dernière correction.

L'ordre par défaut de l'écran 1 est **chronologique ascendant** — l'ordre de travail annoncé — et le filtre par défaut est « à faire » : en rouvrant l'écran on veut la prochaine tâche, pas un inventaire.

**Honnêteté sur l'état d'un champ.** Le brief demandait « valeur API, valeur corrigée, verrouillé ou non ». Le modèle retenu en ARCHI-01 (approche A, une seule colonne) ne conserve PAS la valeur d'origine après correction : l'API reprend la main au ré-import après relâchement. L'écran affiche donc ce qui est vrai — « corrigé » (✎, ocre) ou « api » (gris) — sans prétendre montrer une valeur qu'on n'a plus. Pour les IMAGES c'est différent : `image_api` et `image_manuelle` coexistent, et la vignette dit laquelle est servie.

**Visuel de variante.** `uploadVariantVisual` → `Goriki/pokemon/variantes`, puis `admin_poser_visuel_variante` qui écrit dans `image_manuelle`. Jamais `image_api` : la colonne `image_url` étant générée en `coalesce(image_manuelle, image_api)`, la pose l'emporte immédiatement et survit à un import complet, l'import n'écrivant que la source API.

**Suppression de variante.** L'écran tente d'abord la suppression franche ; si la base refuse pour cause de stock, l'erreur est affichée **et** le choix d'une variante cible est proposé. Rien n'est détruit en silence — 1 641 exemplaires sont concernés.

Tests RPC (session admin simulée) : avancement lisible → **200 sets** · correction écrite ET verrouillée · **import ne peut plus écraser** · relâchement rend le champ à l'API · champ hors liste blanche **refusé** · restriction excluant des variantes saisies **refusée** · restriction cohérente acceptée · liste vide = 11 types globaux · base revenue à sa ligne de base (0 carte divergente, 0 verrou résiduel, 30 995 variantes, 1 641 exemplaires).

Garde de route vérifiée : `/admin/catalogue` non authentifié → **307**.

Volumétrie du cas le plus lourd, chargé d'un coup et sans pagination : SWSHP, **299 cartes / 299 variantes**, et ME02.5 avec **295 cartes / 484 variantes / 93 exemplaires**.

Validation : `tsc --noEmit` exit 0 · lint 0 problème sur les fichiers touchés · `npm run build` exit 0.

Signalements :
- **`app/api/listings/route.ts` reste cassé pour Pokémon** (signalé en session 33). Il sert l'ancien écran `/admin/listings`, distinct de celui-ci. À reprendre sur le nouveau schéma.
- Les deux tables `_sauvegarde_archi01_*` sont **toujours en place**, RLS active et droits révoqués. À supprimer sur ton feu vert.
- La correction du drapeau (0039) vaut aussi pour toute RPC future qui lèverait `goriki.edition_manuelle` : le reposer avant de rendre la main est désormais la règle.

### Session 35 — 2026-08-24 (ADMIN-01 v2 : écrans catalogue sur les patrons PonéglypheAPI)

La v2 remplace la direction visuelle de la v1. Les écrans de la session 34 (bâtis sur la DA `.admin-*`, comme le brief v1 l'exigeait) sont **retirés** au profit des six patrons PonéglypheAPI. `CatalogueSets.tsx`, `CatalogueCartes.tsx`, `ChampCorrigeable.tsx` et la route `[setId]` supprimés — pas laissés orphelins.

**Chiffres du brief vérifiés en base avant de coder, tous exacts** : 200 sets, dont **178 complets**, **15 avec des cartes manquantes (796 au total)** et **7 avec un surplus de sous-blocs (337)**. Les quinze codes et les quinze écarts annoncés correspondent un à un (B1 −226, JUMBO −160, B2 −155, B1A −69…), de même que les sept positifs (+30 sur SWSH9/10/11/12, +70 sur SWSH12.5, +122 sur SWSH4.5, +25 sur CEL25).

**La distinction des deux natures d'écart est structurelle, pas cosmétique.** `etatDeLEcart()` rend `complet` / `manquant` / `sous-blocs`, et la colonne ÉTAT les peint différemment : rouge pour un manque réel, gris pour un surplus de sous-blocs annoté « +N sous-blocs ». Peindre les deux pareil ferait crier au loup sur sept sets sains — et une colonne d'alerte qui se trompe cesse d'être lue, c'est-à-dire qu'on perd l'outil le plus utile de l'écran.

**Les six patrons, transposés :**
1. Navigation numérotée `01 / ÉDITEUR` · `02 / SETS`, compteurs permanents **21 891 cartes · 200 sets · 30 995 variantes**. Pas de rubrique CLEANUP, non demandée ; le tableau de bord général reste à `/admin`.
2. Vue sets : table dense, colonnes SET · NOM · SÉRIE · SORTIE · BASE/ATTENDU · ÉTAT, tri chronologique croissant, facettes d'état en compteurs.
3. Compteur de verrous en ligne (`6🔒`) sur le nom du set — une quantité vérifiable, meilleure qu'un pourcentage.
4. Panneau latéral : la liste reste en place derrière. Bloc CONTENU RÉEL en tête, puis les champs, **chacun avec un texte d'aide décrivant sa conséquence** — « Le changer casse les liens déjà partagés » plutôt qu'une définition.
5. Vue éditeur en trois colonnes : sets numérotés `01…200` avec `n / attendu` et cadenas · grille avec facettes **en compteurs affichés, pas en menus** · éditeur de carte à droite, badge VERROUILLÉE accompagné de sa conséquence en clair.
6. Actions groupées : ajouter/supprimer une variante, poser un visuel, relâcher un champ, enregistrer. Pagination via le composant existant, avec son sélecteur par page.

Les compteurs de facettes sont calculés sur le **set entier**, jamais sur la page affichée : sinon ils ne diraient plus rien de l'anomalie cherchée — voir « REVERSE 44 » sur un set de 120 est précisément ce qui révèle qu'il en manque.

**DA scopée.** Un bloc `.pgl-*` ajouté dans `styles/components.css`, sous le même `@layer components`, avec ses propres variables (`#09090e`, `#c8f060`, mono, capitales). Il ne touche à aucune classe `.admin-*` : le reste du dashboard garde sa direction. C'est la seule extension de style de cette mission.

**Point technique du brief traité en premier : `app/api/listings/route.ts` réparé, pas retiré.** Il sert l'écran de STOCK ET PRIX, distinct du nettoyage de catalogue, donc toujours utile. Sa branche Pokémon passe par `pokemon_card_variants` (l'exemplaire n'a plus `card_id`, `variant_type_id` ni `image_api`), le tri par `referencedTable`, et `copiesOf` regroupe désormais par `variant_id`. La branche One Piece est inchangée, son schéma n'ayant pas bougé.

Migration 0040 : `admin_pokemon_sets_nettoyage()` expose désormais `locked_fields` et non plus seulement leur nombre — le panneau doit savoir QUEL champ porte le cadenas pour proposer son relâchement au bon endroit.

Validation : `tsc --noEmit` exit 0 · lint **0 problème** sur tous les fichiers touchés · `npm run build` exit 0 · gardes de route vérifiées, `/admin/catalogue` et `/admin/catalogue/editeur` renvoient **307** sans session admin.

Signalement : les tables `_sauvegarde_archi01_*` sont **toujours en place** (RLS active, droits révoqués), en attente de ton feu vert pour suppression. C'est le troisième rappel.

### Session 36 — 2026-08-24 (ADMIN-02 : cinq défauts sur les écrans catalogue)

**Chiffres du brief vérifiés en base avant correction, tous exacts** : 121 sets avec logo / 38 symbole seul / 41 sans rien · cartes 18 473 complètes / 3 404 sans aucun visuel / **14 partielles**, 4 286 variantes sans visuel. Les 14 cartes partielles listées au brief correspondent une à une (11 sur ME02.5, 2 sur SV08.5, 1 sur SV10.5W), toutes à 3 variantes dont 1 sans visuel.

**1. Défilement — cause structurelle identifiée et supprimée.** `.pgl` portait un `min-height` à l'intérieur d'un `<main>` de hauteur indéfinie : ni l'un ni l'autre ne portait franchement le défilement, d'où la molette inerte avant clic. `.pgl` a désormais une hauteur **définie** (`calc(100vh - 52px)`), en colonne flex, et le défilement est confié à un `.pgl-scroll` explicite (`flex: 1; min-height: 0; overflow-y: auto`), focalisable (`tabIndex={0}`) pour que flèches, Page suiv., Début et Fin fonctionnent. `overscroll-behavior: contain` évite de quitter l'outil en molettant une liste arrivée en butée. Les trois colonnes de la vue éditeur passent sur le même mécanisme : leur `minHeight: 0` manquant était la raison pour laquelle elles n'étaient jamais de vrais scrollers.

**2. Présence d'un logo, visible par ligne.** Colonne étroite `VISUEL` avec un glyphe — `◆` logo, `◇` symbole seul, `·` rien — et son `title`. Pas de vignette dans la table, qui aurait détruit la densité. Facette `SANS LOGO 79` ajoutée au bandeau à côté de `CARTES MANQUANTES 15` et `SOUS-BLOCS 7`. Traitement volontairement neutre, sans rouge : les 17 sets qui portent du stock ont tous leur logo, l'indicateur sert à savoir quoi aller chercher, pas à alarmer — le rouge reste réservé aux cartes réellement manquantes.

Les deux colonnes `image_url` / `symbol_url` sont lues **à part** dans la page (200 lignes, deux colonnes) plutôt qu'ajoutées à la RPC d'agrégation : le schéma et les RPC étaient hors périmètre.

**3. Panneau — voie retenue : la table se CONTRACTE.** Deux gabarits de colonnes ; panneau ouvert, on abandonne `NOM` puis `SÉRIE`, jamais `BASE / ATTENDU` ni `ÉTAT`. Raison : ce sont les deux colonnes qui justifient l'écran, et le `CODE` qui reste suffit à identifier la ligne. L'autre voie — affiner le panneau — aurait rendu illisibles les textes d'aide, qui sont précisément ce qui évite les fausses manœuvres.

**4. État de visuel par carte, trois cas.** `visuelDeLaCarte()` rend `complet` / `partiel` / `aucun`. La vignette porte `◐` orange pour le partiel et `○` rouge pour l'absence totale ; rien pour le cas complet, qui est la norme. Facette `VISUEL` avec ses trois compteurs — **c'est elle qui rend les 14 cartes partielles atteignables** : 14 sur 21 891 est invisible à l'œil nu et ne serait jamais trouvé autrement. Carte ouverte, chaque variante annonce désormais explicitement sa provenance : « visuel manuel » (l'import ne l'écrase pas), « visuel api » (un import peut le remplacer), ou « sans visuel ».

**5. Coquille.** La source contenait bien l'espace ; c'est un repli de ligne JSX qui l'avalait. Rendu explicite par `{' '}`, ce qui la met à l'abri d'un reformatage.

Validation : `tsc --noEmit` exit 0 · lint 0 problème sur les fichiers touchés · `npm run build` exit 0 · gardes de route toujours à 307.

Note d'outillage, troisième occurrence : les remplacements multi-lignes passés en `node -e` dans bash se font corrompre par l'échappement (attributs JSX déquotés, backticks et `·` mangés). Il a fallu réparer `VueEditeur.tsx` deux fois. **Pour toute édition JSX multi-ligne, passer par l'outil d'édition, jamais par un script shell.**

Réserve inchangée depuis la session 35 : je n'ai pas de session admin authentifiée dans le navigateur de test, donc **le rendu réel de ces cinq correctifs n'est pas vérifié à l'écran**. Types, lint, build et gardes le sont. Le point 1 en particulier est un raisonnement structurel sur la cause — à confirmer à l'usage.

### Session 37 — 2026-08-03 → ADMIN-03 (grille au niveau variante + cause réelle du défilement)

**1. Défilement — cause trouvée, et ce n'était aucun des correctifs précédents.**

`LenisProvider` est monté dans le layout RACINE, avec `smoothWheel: true` et **aucune exclusion de route**. Il enveloppe `{children}`, donc `/admin` aussi. Lenis pose un écouteur `wheel` sur `window`, appelle `preventDefault()` et pilote lui-même `window.scrollTo` : **aucun conteneur interne en `overflow: auto` ne reçoit jamais la molette**. D'où l'obligation d'attraper la barre de défilement.

Mécanisme confirmé à la mesure, pas déduit : `DOMDebugger.getEventListeners` sur `window` d'une page publique remonte 4 écouteurs `wheel`, dont **un non-passif** — précisément celui qui peut `preventDefault()`.

Les deux correctifs précédents (`min-height: 0`, `.pgl-scroll` focalisable) étaient corrects mais traitaient une cause secondaire. Ils n'avaient aucune chance d'aboutir tant que Lenis mangeait l'événement en amont.

**Correction, alignée sur la doctrine existante.** CLAUDE.md réserve Lenis au « fond commun de toute page PUBLIQUE », et `AtmosphereLayer` exclut déjà `/admin` pour une raison de même nature. `LenisProvider` reçoit donc son cinquième guard : `EXCLUS = ['/admin']`, avec `pathname` en dépendance de l'effet — entrer dans l'admin DÉTRUIT l'instance, en sortir la recrée. Sans cette dépendance, le lissage survivrait à la navigation et continuerait d'avaler la molette.

Second volet : la vue SETS n'a plus de conteneur défilant du tout — c'est le DOCUMENT qui porte le défilement, donc la molette agit depuis n'importe quel point de la page, bandeau de facettes compris. `.pgl` garde un `min-height` pour que le fond sombre remplisse l'écran, ce qui ne crée aucun piège puisque plus rien n'est en `overflow: hidden`. La vue ÉDITEUR conserve ses trois colonnes indépendantes via `.pgl-fixe` : là, le défilement séparé est le but, et il fonctionne maintenant que Lenis ne l'intercepte plus.

Non-régression vérifiée : Lenis reste **actif sur toutes les pages publiques** (classe `lenis` présente sur `<html>` en home, catalogue et login).

**2. La grille passe au niveau VARIANTE — c'était le point de fond, mal compris jusqu'ici.**

Les deux briefs précédents avaient ajouté des indicateurs SUR LA CARTE disant si ses variantes avaient un visuel. Ce n'était pas la demande. L'unité de travail est la variante : une Normale et une Reverse sont deux objets distincts — visuel propre, verrou propre, existence propre. Une carte n'est qu'un regroupement.

`VueEditeur` est réécrite autour d'une liste APLATIE carte → variantes. Un set typique passe de 120 vignettes à 168. Chaque vignette porte le visuel de la variante, le numéro, le nom, **le type de variante en clair**, et l'état de verrou. Le rattachement entre sœurs se lit au numéro commun suivi de `·N`, sans qu'aucune ne soit subordonnée à l'autre.

Répartition vérifiée en base avant de coder, conforme au brief : Normale 17 237, Reverse 7 017, Holo 6 051, 1ère édition 676, Pokéball 8, Ball Copain 2, Ball Love 2, Ball Sombre 1, Ball Rapide 1, Masterball 0, Ball Rocket 0.

**C'est ce que ça permet qui compte** : lire « NORMALE 120 · REVERSE 44 » sur un set de 120 cartes et voir immédiatement qu'il manque 76 Reverse. Une grille par carte, si bien instrumentée soit-elle, ne montre jamais ça.

**Deux portées distinguées sans ambiguïté dans l'éditeur.** « Cette variante » — visuel, suppression, sœurs, ajout. « La carte entière » — nom, numéro, rareté, type, catégorie, attribut, avec un avertissement explicite : corriger le nom depuis la Reverse le change aussi sur ses N autres variantes, et le message de confirmation le rappelle après coup.

Les sœurs d'une carte sont atteignables depuis l'éditeur sans repasser par la grille, chacune signalant si elle est sans visuel.

Validation : `tsc --noEmit` exit 0 · lint 0 problème · `npm run build` exit 0 · pages publiques à 200 · Lenis actif côté public, désactivé sur `/admin`.

Réserve : le rendu des écrans admin reste non vérifié à l'œil, faute de session authentifiée dans le navigateur de test. La cause du défilement, elle, est cette fois **mesurée** et non plus supposée.

### Session 38 — 2026-08-24 → BG-03 (fond d'univers sur la fiche de carte)

**Le trou était structurel, pas un oubli.** Les fonds étaient montés sur `app/catalogue/pokemon/layout.tsx` et son homologue One Piece, qui couvrent index, séries et détail de set. La fiche produit, elle, n'est sous aucun de ces préfixes : depuis ARCHI-01 elle est indexée sur l'id de la variante, **à la racine** (`/{uuid}`, 30 995 routes Pokémon + les listings One Piece + les scellés). Aucun layout de préfixe ne pouvait l'atteindre, et le raisonnement par préfixe d'`AtmosphereLayer` non plus.

**Trois schémas répondent à la même forme d'URL** — variante Pokémon, listing One Piece, produit scellé — et le chemin ne dit pas lequel. Seule la base tranche. D'où la forme retenue.

**1. `app/[slug]/layout.tsx`** résout le slug et monte le fond correspondant : Poké Ball, carte marine, ou `AtmosphereBackdrop` pour un scellé — qui n'a pas de cartographie à lui et ne devait pas se retrouver nu. Montage en layout uniquement, jamais dans la page : le patron des deux rayons est respecté à la lettre.

**2. `getListing` extraite dans `lib/catalogue/fiche.ts`, mémoïsée par `cache()`.** Le layout doit connaître l'univers avant de choisir, donc il résout le même slug que la page et que `generateMetadata`. La déduplication de React fait qu'un seul aller-retour Supabase les sert tous les trois — **le montage du fond ne coûte pas une requête, il en supprime une** : `generateMetadata` + page en faisaient deux avant. Sur la route la plus fréquentée du site, ce n'est pas un détail.

**3. `AtmosphereLayer` scindée en deux.** `AtmosphereBackdrop` (le canvas, sans filtrage) et `AtmosphereLayer` (le filtrage par route, monté dans le layout racine). L'exclusion par préfixe reste inchangée pour les rayons ; s'y ajoute un test sur la **forme** de la route fiche (`/{uuid}` en segment unique), puisqu'il n'y a pas de préfixe à exclure. Les autres routes racine — `/panier`, `/login`, `/recherche`… — sont des segments statiques que Next fait gagner sur `[slug]` et qu'aucun UUID n'imite.

**`relative z-10` sur le contenu de la fiche**, comme sur le layout Pokémon. Il est indispensable au motif Poké Ball, en `z-0` : à cette profondeur un `fixed` se peindrait au-dessus d'un contenu resté en flux normal. La carte marine, en `-z-10`, passerait sans — le même conteneur pour les deux évite d'avoir à se souvenir laquelle est laquelle. Divergence de profondeur entre les deux fonds **laissée telle quelle** : elle est validée et documentée dans le layout Pokémon depuis BG-01.

**Vérification faite sur le serveur de production local, page par page, en comptant les instances dans le HTML rendu** (hors charge utile RSC, qui répète les mêmes chaînes) :

| Route | Poké Ball | Carte marine | Canvas | `relative z-10` |
|---|---|---|---|---|
| fiche Pokémon `/{uuid}` | **1** | 0 | 0 | 1 |
| fiche One Piece `/{uuid}` | 0 | **1** | 0 | 1 |
| fiche scellé `/{uuid}` | 0 | 0 | **1** | 1 |
| `/catalogue/pokemon`, `/series`, `/[set]` | **1** | 0 | 0 | 1 |
| `/catalogue/onepiece`, `/series`, `/[set]` | 0 | **1** | 0 | 0 |
| `/`, `/catalogue`, `/catalogue/scelles`, `/recherche`, `/panier` | 0 | 0 | **1** | 0 |

Aucune route d'univers ne reste nue, aucune page ne porte deux fonds, et le canvas ne coexiste jamais avec un motif dessiné. Les fonds sont en `fixed` : ils ne défilent pas.

**Signalement de lisibilité — le fond Poké Ball passe sous AA sur le texte secondaire de la colonne d'achat.** Rien changé, comme demandé.

Mesure, sur un écran de 1440 px : le `preserveAspectRatio="slice"` place la balle bleue (cx 628, r 118) autour de x ≈ 1397 avec un rayon de 277 px, donc **sa bande noire traverse la colonne de droite**, qui va jusqu'à x = 1344. Sous cette bande — `#2c2823` à 30 %, par-dessus le parchemin et son dégradé radial sombre à 7 % qui est justement centré au même endroit — le contraste du `text-ink-70` en 13 px tombe de **5,5:1 à 4,0:1**, sous le seuil AA de 4,5. Concerné : la ligne de disponibilité, les lignes de la fiche technique (`Type`, `Attribut`, `Version`…) et les eyebrows. Le grand visuel, lui, est à l'abri : `ScanStage` et `InspectionPanel` sont en `.glass` (crème à 50 %, `blur(20px)`), qui neutralise le motif.

Côté One Piece, même calcul, aucun problème : la teinte la plus sombre de la carte est `#a38a5e` à 40 %, ce qui laisse le même texte à 4,7:1.

Trois issues possibles si tu veux corriger, aucune appliquée : baisser l'opacité du fond Poké Ball **sur la seule fiche** (le composant prend déjà une prop `opacity`) ; poser un `.glass-light` derrière la colonne d'achat, ce qui la rapprocherait des panneaux voisins ; ou décaler la géométrie pour vider le quart haut-droit. La première est la moins invasive, mais elle rompt l'uniformité d'opacité entre les écrans — d'où le signalement plutôt que la décision.

**Conséquence assumée, à connaître.** Un UUID inconnu (`/{uuid}` sans ligne en base) rend un 404 **sans aucun fond** : `notFound()` court-circuite le layout du segment, et `AtmosphereLayer` s'est déjà retirée sur la forme de la route. La page 404 s'affiche donc sur le parchemin nu. C'est le prix du retrait sans clignotement sur les 30 995 pages réelles — l'alternative (faire remonter l'information du serveur au canvas côté client) aurait fait apparaître puis disparaître le canvas à l'hydratation, sur la page la plus vue du site. Réparable par un `app/[slug]/not-found.tsx`, ce qui suppose d'écrire une page 404 propre au segment : hors périmètre de ce brief.

Validation : `tsc --noEmit` exit 0 · `npm run build` exit 0 · lint **0 problème sur les quatre fichiers touchés** (`app/[slug]/layout.tsx`, `app/[slug]/page.tsx`, `lib/catalogue/fiche.ts`, `components/atmosphere/AtmosphereLayer.tsx`). Le dépôt porte par ailleurs 13 erreurs et 6 avertissements de lint **préexistants**, tous dans des fichiers non touchés ici (`hooks/useCart.ts`, `components/cart/*`, `components/ui/ThemeToggle.tsx`, écrans admin…) — dette antérieure à ce brief, non traitée.

### Session 37 bis — 2026-08-24 (correctif du guard Lenis : dépendance sur la frontière, pas sur le chemin)

Le guard livré plus haut mettait `pathname` en dépendance de l'effet. Conséquence non voulue : l'instance Lenis était **détruite et reconstruite à chaque navigation**, y compris publique → publique. Le lissage repartait de zéro à chaque page — ce qui se ressent comme une transition brutale.

Corrigé : l'effet dépend d'un booléen dérivé `estAdmin = EXCLUS.some(p => pathname.startsWith(p))`. L'instance n'est donc touchée qu'au **franchissement réel de la frontière** — détruite en entrant dans `/admin`, recréée en sortant. Une navigation publique → publique ne la touche plus.

**Mesuré, et le test a été prouvé discriminant.** Un `MutationObserver` compte les mutations de l'attribut `class` de `<html>` pendant une navigation côté client — `destroy()` retire la classe `lenis`, `new Lenis()` la remet, une recréation laisse donc une trace :

| dépendance de l'effet | mutations pendant `/` → `/catalogue/pokemon` |
|---|---|
| `[pathname]` (version livrée) | **2** — destruction puis recréation |
| `[estAdmin]` (corrigée) | **0** — instance conservée |

La version fautive a été remise en place le temps de la mesure, puis le correctif restauré : un test qui passe ne vaut que s'il sait échouer.

Validation : `tsc --noEmit` exit 0 · lint 0 problème · `npm run build` exit 0.

### Session 38 — 2026-08-24 (refonte complète du back-office, d'un seul bloc)

Source : `docs/design-reference/Goriki Admin.dc (2).html` — noter que le nom réel du fichier diffère de celui du brief (`Goriki_Admin_dc__2_.html`). Périmètre : toutes les routes `/admin`. Hors périmètre et non touchés : site public, schéma de base, RPC existantes, fonds décoratifs.

**Ce qui a été construit.** `styles/admin.css` porte le système `gk-*` traduit de la maquette (`#09090e` / `#c8f060`), et remplace les deux vocabulaires antérieurs `.admin-*` et `.pgl-*`. `app/admin/layout.tsx` charge les quatre polices de la maquette **scopées à l'admin** (Bebas Neue, DM Mono, DM Serif Display, Instrument Sans — elles ne partent pas sur les pages publiques), lit les compteurs réels et monte le rail. `components/admin/Rail.tsx` : trois groupes numérotés, onze destinations, badges alimentés par la base et non écrits en dur. `components/admin/Topbar.tsx` : sourcil chiffré + titre Bebas + action.

Onze écrans vérifiés au rendu, pas seulement au build.

**Décision — les jetons du site public sont réécrits DANS `.gk`, pas remplacés fichier par fichier.** Une quinzaine d'écrans référençaient encore `--amber`, `--muted`, `--surface-1` en style inline, et 39 badges portaient la famille `.ab-*` avec l'ambre public codé en dur : c'est ce qui faisait ressortir en orange la pastille active des commandes au milieu d'un écran passé au vert-citron. Les redéfinir sur `.gk` fait tout basculer d'un coup, laisse le site public intact, et concentre en un seul endroit le point où les deux palettes se rencontrent. Même raisonnement pour les ascenseurs : `globals.css` peint le pouce en ambre plein, corrigé dans `.gk` (`@layer components` passe après `@layer base`, l'emport est acquis sans course à la spécificité) plutôt que dans le fichier public.

**Défaut introduit par ma propre migration en masse, trouvé et corrigé.** La conversion `admin-* → gk-*` avait renommé `--radius-admin-sm` **jusque dans ses usages** sans son point de définition : `--radius-gk-sm` était référencé onze fois et défini nulle part, donc onze `border-radius` retombaient silencieusement à zéro. Un build vert ne le voit pas — une variable CSS absente ne casse rien, elle s'évapore.

**`.gk-main` passe en `overflow-y: auto`, et non `hidden`.** Un écran qui oublierait son conteneur `.gk-corps` serait autrement tronqué en silence, sans même une barre pour s'en apercevoir. Corollaire : `.gk-corps` n'est plus un scroller mais un simple conteneur à padding, et les trois colonnes de l'éditeur ont leur classe propre `.gk-colonne` — elles avaient hérité de `.gk-corps` à la migration, avec son padding de page qui n'a aucun sens sur une colonne.

**Les quatorze en-têtes d'écran restent en JSX, rendues collantes par CSS.** Leur titre est souvent une expression (un nom de client, un set précédé de son lien de retour) : les convertir en props de `<Topbar>` aurait demandé quatorze chirurgies JSX pour un résultat identique à l'écran. `.gk-entete-ecran` est donc `position: sticky` calquée sur `.gk-topbar`, avec des marges négatives pour que le filet traverse toute la largeur. L'ordre visuel titre/sourcil est inversé par `column-reverse` sous un `:has()` qui cible le cas exact « titre suivi du sourcil, et rien d'autre » — deux écrans glissent un lien de retour avant le titre et gardent leur ordre naturel.

**Un champ de recherche mort a été câblé plutôt que supprimé.** Celui de la topbar postait `?q=` vers `/admin/catalogue`, page qui ne lisait pas `searchParams` : il ne filtrait rien, à dix centimètres du filtre du panneau qui, lui, fonctionne. `/admin/catalogue` lit désormais `?q=` et en amorce le filtre (`qInitial`), et le champ est retiré de l'écran catalogue lui-même — un écran qui porte déjà son filtre n'en reçoit pas un second.

**Mesures au rendu** (Chrome headless, cookie de session admin temporaire créé puis supprimé — 0 compte résiduel) :

| vérification | résultat |
|---|---|
| onze écrans | rail présent, titre en Bebas Neue, **0 classe `admin-*` restante**, aucun contenu injoignable |
| molette — corps de page, colonne des sets, grille centrale | **+480 px** pour 4 crans dans les trois cas (événements `Input.dispatchMouseEvent` réels, pas un `scrollTop =`) |
| Lenis sur `/admin` | aucune classe `lenis` sur `<html>` |
| `?q=rocket` sur le catalogue | **1 ligne** (Team Rocket) au lieu de 200 ; **un seul** champ de recherche, sur le dashboard |
| visuels de variantes | 60 `img`, URL TCGdex correcte, 12 chargées en 9 s — **lenteur réseau du headless, pas un défaut** : les vignettes vides des captures ne sont pas un bug |

Trois requêtes `count exact` supprimées de l'éditeur de variantes : leur résultat était destructuré puis jeté à chaque ouverture.

Validation : `tsc --noEmit` exit 0 · `npm run build` exit 0 · lint **0 avertissement** sur le périmètre. Restent **8 erreurs `no-explicit-any` préexistantes** dans `admin/clients` et `admin/commandes`, antérieures à ce brief et non traitées.

**Signalements ouverts.**
- `components/admin/AdminHeader.tsx` n'est plus référencé nulle part : le rail et la topbar l'ont remplacé. Non supprimé — arbitrage RYUU.
- Rappel, quatrième signalement : `_sauvegarde_archi01_listings` et `_sauvegarde_archi01_cards` sont toujours en base, en attente du feu vert pour être supprimées.

### Session 39 — 2026-08-24 (#MOTION-01 — transitions : la lenteur d'abord, la douceur ensuite)

Retour d'usage : « déjà que c'est lent parfois, en plus c'est brutal ». **Les deux symptômes n'en faisaient qu'un.**

**Étape 1 — mesures avant, build de PRODUCTION, cibles réelles.** Sonde Chrome headless : `t1` = premier changement visible à l'écran après le clic, `t2` = contenu de destination présent ET pleinement opaque (l'opacité compte : un contenu présent depuis 300 ms mais retenu invisible par une animation aurait échappé à une mesure de simple présence DOM).

| navigation | `t1` premier signe | `t2` contenu visible | `t2 − t1` |
|---|---|---|---|
| accueil → catalogue Pokémon | 1505 ms | 1507 ms | **3 ms** |
| catalogue → fiche de set | 2078 ms | 2079 ms | **1 ms** |
| fiche de set → fiche de carte | 1004 ms | 1004 ms | **0 ms** |

Lecture : de 1 à 2 secondes pendant lesquelles **rien ne bouge à l'écran**, puis tout apparaît d'un bloc, déjà opaque. Le « lent » et le « brutal » étaient la même absence — aucun état d'attente, aucune apparition.

Décomposition : plancher d'un aller-retour Supabase depuis cette machine ≈ **300 ms** ; les 8 requêtes de l'accueil en parallèle ≈ 923 ms ; payloads RSC de navigation 416 à 1173 ms. `/[slug]` est `ƒ` — les 30 995 fiches sont rendues à chaque requête, `createClient()` faisant `await cookies()`.

**Trois causes trouvées, dont deux contre-intuitives.**

1. **Zéro `loading.tsx` sur tout le site.** Next attend le rendu serveur complet avant de remplacer l'écran.
2. **Le préchargement tournait à vide.** L'accueil déclenchait **26 requêtes RSC**… et la navigation prenait quand même 1505 ms. Deux raisons, confirmées par la doc de la version installée : `staleTimes.dynamic` vaut **0 par défaut depuis Next 15** (payload jeté à l'arrivée), et pour une route dynamique le préchargement ne descend que « to the nearest segment with a `loading.js` boundary » — sans frontière, il n'y avait rien à précharger. Le site payait le préchargement en requêtes serveur sans jamais en toucher le bénéfice.
3. **`app/template.tsx` n'animait RIEN.** Son `<AnimatePresence mode="wait" initial={false}>` était neutralisé par sa propre nature : un `template.tsx` est remonté à chaque navigation, donc l'`AnimatePresence` aussi — il ne voyait jamais d'enfant sortir, se montait à neuf avec un enfant en premier montage, que `initial={false}` avait précisément pour effet de ne pas animer. Les deux réglages s'annulaient. Mesuré image par image : aucun état intermédiaire entre le clic et l'arrivée. **Le second piège du brief — l'animation de sortie qui retarde — n'existait donc pas ici**, il n'y avait aucune animation du tout.

**Étape 2 — la lenteur.** Quatre `loading.tsx` (catalogue, les deux segments `[set]`, la fiche produit) sur deux squelettes partagés, aux proportions reprises des composants réels pour que le contenu se pose SUR le squelette au lieu de le déplacer ; `experimental.staleTimes: { dynamic: 30 }`.

Détail qui a coûté une passe de mesure : **une frontière ne se déclenche que sur le segment qui CHANGE.** `app/catalogue/loading.tsx` ne servait pas `catalogue → set`, le segment `/catalogue` ne bougeant pas. Elle a dû descendre au niveau de `[set]`.

**Étape 3 — la douceur.** Un seul mécanisme, en CSS : `main:not(.gk-main) { animation: apparition-page 176ms }` dans `@layer base`. Placé sur `main` et non dans un wrapper, il couvre les DEUX moments — arrivée du squelette, puis remplacement par le contenu réel — qui sont deux sous-arbres distincts avec chacun son `<main>`. Un wrapper au-dessus n'aurait vu passer que le premier. `:not(.gk-main)` n'est pas décoratif : le back-office rend lui aussi `<main className="gk-main">`. `app/template.tsx` est conservé et vidé : son rôle est désormais d'être remonté, ce qui garantit un `<main>` neuf donc le rejeu de l'animation.

**Un quatrième défaut, trouvé en cours de route.** Depuis une liste défilée à 1600 px, cliquer une carte ouvrait sa fiche **à 1118 px** — au milieu du contenu, la carte hors écran. Ce n'est pas un bug de Next mais son comportement documenté (« maintain scroll position […] as long as the Page is visible in the viewport »). Deux hypothèses ont été testées et **rejetées avant** d'écrire le correctif : ce n'était pas Lenis (position identique avec le lissage désactivé), ce n'était pas `scroll-behavior: smooth` (position identique en le forçant à `auto`). Les corriger aurait été traiter deux innocents. Correctif dans `LenisProvider`, qui possède la couche défilement : remise en haut au changement de `pathname`, via `lenis.scrollTo` quand il tourne — écrire `scrollTop` sous ses pieds l'aurait laissé avec une position périmée, rattrapée au premier cran de molette, soit un ressaut. Retour arrière et premier rendu explicitement exclus.

**Mesures après**, mêmes cibles, même sonde :

| navigation | `t1` avant | `t1` après | `t2` avant | `t2` après |
|---|---|---|---|---|
| accueil → catalogue Pokémon | 1505 ms | **4 ms** | 1507 ms | **600 ms** |
| catalogue → fiche de set | 2078 ms | **13 ms** | 2079 ms | **684 ms** |
| fiche de set → fiche de carte | 1004 ms | **8 ms** | 1004 ms | **612 ms** |

Le retour visuel passe de 1 à 2 secondes à moins de 15 ms. `t2` inclut désormais les 176 ms d'apparition, alors qu'il ne mesurait avant qu'un basculement sec.

**Validations.** Animation lue via `getAnimations()` — l'API du navigateur, pas la feuille de style : `apparition-page`, durée **176 ms**, opacité 0 → 0,81 à 40 ms → 1. Sous `prefers-reduced-motion: reduce`, même animation à **0,01 ms**, opacité 1 dès 40 ms : le test discrimine. Défilement vérifié **dans les deux modes** — arrivée à 0 sans ressaut (min = max = 0), retour arrière restitué à 1600 px. `tsc --noEmit` exit 0 · `npm run build` exit 0 · lint **0 problème sur les 7 fichiers du brief**.

**Signalements.**
- **View Transitions est disponible** sur cette version (`experimental.viewTransition`, Next 16.2.9), mais expérimental des deux côtés — le drapeau Next et le `<ViewTransition>` de React. La solution CSS retenue tient déjà les contraintes (≤ 300 ms, extinction sous reduced-motion, aucune attente ajoutée) sans dépendre de deux API instables. Non adopté : arbitrage RYUU.
- **Contrepartie de `staleTimes.dynamic: 30`** : un retour arrière dans les 30 s réaffiche stock et prix tels qu'ils étaient au premier passage.
- **Levier non tiré, le plus gros restant** : les 30 995 fiches restent rendues à chaque requête parce que `createClient()` fait `await cookies()`. Les rendre cachables suppose un client Supabase sans cookie pour les lectures publiques du catalogue — chantier réel, à cadrer séparément.

### Session 40 — 2026-08-24 (fiche carte : rangée des variantes + cause du « NaN € » et du placeholder)

**Diagnostic — les deux défauts de « Du même set » avaient UNE seule racine.**

La requête Pokémon renvoyait `image_url` et un **tableau** `pokemon_listings`. Le composant `SameSetGrid`, lui, lisait `front_photo_url ?? image_api` et un scalaire `price` — les champs du schéma **One Piece**. Côté Pokémon, aucun de ces trois champs n'existe dans la réponse :

| ce que la requête rend | ce que le composant lisait | résultat à l'écran |
|---|---|---|
| `image_url` (renseigné sur 25 508 variantes / 29 210) | `front_photo_url` → `undefined`, `image_api` → `undefined` | placeholder rayé sur **toutes** les vignettes |
| `pokemon_listings: []` (tableau) | `price` → `undefined` | `formatPrice(undefined)` → **« NaN € »** |

C'est la migration ARCHI-01 qui a déplacé Pokémon vers `pokemon_card_variants` sans mettre à jour le contrat du composant. **TypeScript aurait attrapé les deux** : il ne l'a pas fait parce que l'appel était écrit `listings={sameSet as never}`. Le cast est la cause première — pas les noms de champs, mais ce qui a laissé passer leur divergence jusqu'en production, build vert compris.

Correctif de fond plutôt que de surface : `SameSetGrid` est remplacé par `RangeeCartes`, qui expose un type `Vignette` explicite et **ne connaît plus aucun schéma de base**. Les deux univers sont normalisés côté page. Plus de cast à l'appel.

Confirmé en base au passage : **1 641 listings Pokémon, aucun avec un prix > 0**. Le « NaN » n'était donc pas un défaut de calcul, et le « 0,00 € » qu'on aurait obtenu en le « corrigeant » naïvement aurait été tout aussi faux.

**Vocabulaire de prix, généralisé.** Deux fonctions dans `lib/utils.ts`, portant la règle déjà actée (« un prix à 0 est une absence de prix ») :
- `prixDepuis` → « Épuisé » ou « **À partir de** X,XX € », pour une vignette de CARTE, qui peut avoir plusieurs exemplaires à des prix différents ;
- `prixOuEpuise` → « Épuisé » ou le montant, pour une pièce unique (scellé, exemplaire déjà choisi).

Appliquées sur **11 sites** : fiche produit (grand prix), tuiles d'accueil, carte en inspection, dépôt-vente, wishlist, scellés (tuile et ligne), `CardTile`, `ProductCard`, `InspectionPanel`, `HeroDeck`. `formatPrice` garde un filet — non-fini → « — » — explicitement documenté comme filet et non comme politique d'affichage.

Effet de bord traité : quatre écrans affichaient dès lors « Épuisé » **deux fois** (le prix + un badge voisin). Le badge ne s'affiche plus que lorsqu'il ajoute quelque chose — une pièce chiffrée mais sans stock. Sur la fiche, le sous-titre passe de « Épuisé pour le moment » à « Aucun exemplaire en vente pour le moment » : il explique au lieu de répéter.

**Note — la fiche principale affichait « 0,00 € »** sur les 29 210 cartes, le brief la croyant correcte. Corrigée en même temps, c'était le même défaut.

**Nouvelle rangée « Existe aussi dans cette variante »**, placée AVANT « Du même set ». Elle réemploie `chargerVariantes` — la fonction qui alimente déjà le switch de variantes des tuiles de catalogue — plutôt que d'en écrire une seconde : deux définitions concurrentes de « qu'est-ce qu'une variante » auraient divergé. Le libellé de VARIANTE y tient la ligne principale, le nom de la carte étant identique sur toute la rangée.

**Validations au rendu**, build de production, DOM réel :

| vérification | résultat |
|---|---|
| carte à 2 variantes (Coxyclaque) | rangée **présente**, 1 vignette → `/1400724a…` (l'autre variante), image TCGdex réelle, « #10 · Reverse » |
| carte à 1 variante (Branette) | rangée **absente** — le test discrimine |
| « Du même set » | 12 vignettes, **0 placeholder**, images TCGdex réelles, noms corrects |
| balayage de 11 routes publiques | **0 « NaN »**, **0 « 0,00 € »** |
| branche « À partir de » | deux prix semés (24,90 € et 12,50 €) → affichage **« À partir de 12,50 € »**, donc le plus bas et non le premier |
| fiche principale avec un vrai prix | 12,50 € en tête, les deux exemplaires listés, panier actif, 0 NaN |

Données de test retirées : 1 643 → **1 641 listings, 0 avec prix > 0**, état initial retrouvé.

`tsc --noEmit` exit 0 · `npm run build` exit 0 · lint 0 erreur sur le périmètre.

**Deux pièges de mesure notés, tous deux des faux positifs de mes propres sondes.** Chercher « 0,00 » en sous-chaîne signalait le seul produit réellement chiffré du site (« **1**0,00 € ») ; et lire le HTML brut par `curl` fait tomber sur le payload RSC, pas sur le DOM rendu — les deux vérifications ont dû être refaites sur `innerText`.

**Signalement.** La rangée « du même set » côté One Piece ne filtre plus `is_active`/`quantity` : elle montre désormais toutes les cartes du set, vendables ou non, comme le fait déjà Pokémon. C'est un alignement délibéré — deux univers, un seul comportement — mais c'est un changement de comportement visible : arbitrage RYUU si le filtrage doit revenir.

### Session 41 — 2026-08-24 (étiquette de variante : sur le visuel, et sur les tuiles)

**Aucune classe nouvelle.** La planche a déjà `.corner-tag` — « étiquette posée SUR le visuel produit » — en service pour DÉPÔT, ÉPUISÉ et NOUVEAU : 8 px, mono, encre à 88 %, rien de coloré. C'est elle qui est réemployée aux trois endroits, plutôt qu'un badge de plus.

**1. Fiche carte.** Le libellé de variante quitte la colonne de texte pour le visuel. Il y était une pastille parmi l'état et « Scan réel » — noyé entre deux caractéristiques de l'objet vendu, alors qu'il est ce qui distingue cette fiche d'une autre par ailleurs identique. Les deux autres pastilles restent : elles qualifient bien la pièce, pas son identité.

Détail d'ancrage qui comptait : le scan est en `object-contain w-auto`, sa boîte réelle dépend donc du visuel. L'étiquette est posée dans un conteneur `relative` ajusté à l'image ; l'accrocher au panneau de verre l'aurait mise dans la marge, **à côté** de la carte au lieu d'être dessus.

`CardViewer` reçoit la même prop, mais l'étiquette y est posée sur la SCÈNE et non sur la carte : celle-ci pivote en 3D, une étiquette embarquée se retrouverait en miroir au verso. Ce composant reste inatteignable en production (`back_photo_url` NULL partout) — le badge y est pour qu'il n'ait pas à être redécouvert le jour où un verso arrive.

**2. Tuiles « Du même set ».** Deux variantes d'une même carte s'y suivaient avec le MÊME visuel, le MÊME nom et le MÊME numéro : la rangée avait l'air de bégayer, et le doublon apparent se lisait comme un bug. Le libellé est ajouté en `.corner-tag` sur le visuel — à l'endroit même où l'œil compare, donc avant le texte. La requête resélectionne `*_variant_types(label)`, que la réécriture de la session précédente avait laissé tomber.

**Harmonisation faite au passage.** La rangée « Existe aussi dans cette variante » portait le libellé de variante sur sa ligne de TEXTE (choix de la session 40, où elle était seule). Deux rangées voisines désignant la même notion de deux façons différentes se liraient comme deux notions : le libellé passe donc à l'étiquette dans les deux, et la ligne de texte porte le nom de la carte dans les deux.

**Validations au rendu**, build de production, positions mesurées et non supposées :

| vérification | résultat |
|---|---|
| position du badge | **dans la boîte de l'image**, 8 px du bord gauche, 8 px du bas |
| discrétion | badge de **19 px de haut sur une photo de 320 px** de large — une étiquette, pas un bandeau |
| pastille de variante dans le texte | **absente** (ne restent que « Recto » et « Zoom », les contrôles de `ScanStage`) |
| « du même set », set EX5 | 12 tuiles, **0 sans libellé** |
| cas décisif — paires de même nom | « Jirachi » → **Reverse / Holo**, « Mackogneur » → **Normale / Holo** : distinguables |
| One Piece | fiche 200, badges présents, 0 NaN — la jointure `!inner` sur `onepiece_variant_types` tient |

Le premier set testé (Coxyclaque) ne contenait **aucune paire dans ses 12 premières tuiles** : la vérification y aurait été verte sans rien prouver. Un second set a été cherché en base spécifiquement pour exercer le cas — c'est celui-là qui valide.

`tsc --noEmit` exit 0 · `npm run build` exit 0 · lint 0 erreur.

**Signalement.** La fiche technique du bas de page affiche toujours une ligne « VERSION : Holo ». Elle préexiste et relève d'un autre registre — un relevé, pas une pastille — donc conservée. À dire si le doublon d'information gêne.

### Session 42 — 2026-08-26 (fiche carte : la fiche technique passe en colonne gauche)

Le bloc Type / Attribut / Version pendait sous le panneau Inspection, prolongeant la colonne d'achat de ~190 px pendant que toute la moitié gauche restait vide sous la photo.

**La grille passe à DEUX LIGNES, pas à trois colonnes.** La colonne d'achat occupe les deux lignes (`lg:row-span-2`), la gauche porte le visuel en haut et la fiche technique en dessous (`lg:col-start-1 lg:row-start-2`). Le badge de variante sur la photo n'est pas touché.

**L'ordre du DOM est choisi pour le MOBILE, pas pour le desktop.** En une seule colonne, les enfants de grille s'empilent dans l'ordre d'écriture. Écrire la fiche technique avant la colonne d'achat aurait donné la même mise en page desktop — et poussé le prix et le bouton d'achat sous trois lignes de caractéristiques sur téléphone. Le placement explicite ne sert que le desktop ; le mobile suit le DOM, resté dans l'ordre de lecture utile. Vérifié au rendu : photo → contrôles → prix → Inspection → fiche technique.

**Mesures**, build de production, fiche Tropius ME05 #001 :

| | avant | après |
|---|---|---|
| bas de la colonne gauche | 677 px | 840 px |
| bas de la colonne droite | 869 px | 685 px |
| écart entre les deux | **192 px** (droite plus longue) | **155 px** (gauche plus longue) |
| fiche technique en colonne gauche | non | **oui** |
| hauteur totale de la page | 2 376 px | 2 346 px |
| mobile — colonnes empilées | oui | oui, ordre de lecture conservé |

**Deux faux positifs de sonde, corrigés en cours de route.** La première version cherchait « une grille à exactement deux enfants » : elle ne trouvait plus rien dès que la fiche technique est devenue un troisième élément de grille. La seconde mesurait le bas des BOÎTES : la colonne d'achat étant en `row-span-2`, sa boîte s'étire jusqu'au bas de la grille et l'écart tombait à `0 px` — un « parfait » entièrement faux. La mesure ne retient plus que les FEUILLES porteuses de contenu. L'état d'avant a été reconstitué et remesuré avec la métrique corrigée, pour que les deux colonnes du tableau soient comparables.

**Résultat honnête : le déséquilibre est réduit, pas supprimé — et il a changé de côté.** 155 px sur une colonne de ~700 px. La différence perçue tient surtout à la nature du vide : il était à gauche sous la photo, à côté de trois lignes de texte flottantes ; il est maintenant à droite, sous le panneau Inspection, dont le bloc de verre ferme visuellement la colonne.

**Signalement — la vraie cause de la longueur de page n'est pas celle-ci.** La rangée « Existe aussi dans cette variante » rend UNE vignette dans une grille de six colonnes : ~370 px de hauteur pour une seule carte, dont cinq sixièmes de vide horizontal. Sur les 2 346 px de la page, c'est le poste le plus coûteux. Hors périmètre de ce brief — à cadrer si la longueur reste gênante.

### Session 43 — 2026-08-26 (refonte de la fiche produit : versions, CTA, engagements)

**Deux vérifications AVANT d'écrire la moindre ligne, comme le brief l'imposait. Les deux ont changé ce qui a été livré.**

**1. Comment reconnaître une pièce de dépôt-vente ?** Résultat contraire à ce qu'on aurait supposé : `pokemon_listings` et `onepiece_listings` ne portent **aucune** colonne de dépôt — ni vendeur, ni propriétaire, ni drapeau ; un exemplaire ne sait pas d'où il vient. `consignment_items` est une table à part, **sans clé étrangère** sur `card_id` ni `variant_type_id` : elle ne déclare même pas son univers (c'est la table de cartes qui répond qui fait office de discriminant, patron déjà établi par `/depot-vente`). Le seul rapprochement possible est donc le couple **(carte, type de variante)** — précisément la clé de cette fiche. Vérifié aussi que `SELECT` sur `variant_type_id` est bien accordé à `anon`, sinon le filtre serait tombé côté visiteur. La table est **vide en production** : le test est donc faux partout, ce qui est le comportement voulu.

**2. Quelles sont les vraies politiques commerciales ?** Le dépôt ne contient **aucune page de CGV, aucun délai d'expédition annoncé, aucune politique de retour**. Le texte de la maquette — « Envoi sous 24h, satisfait ou remboursé 14 jours » — n'a donc **pas** été repris : un engagement affiché est opposable, et rien ne le soutenait. Le paragraphe livré ne reprend que ce que la boutique affirme déjà ailleurs, mot pour mot : les trois garanties du hero et la ligne du pied de page.

**Ce qui a été construit.**

- **« Autres versions de cette carte »** (`components/product/AutresVersions.tsx`), colonne de gauche, sous les contrôles. Liste **verticale** et non grille : ce qui distingue ces lignes n'est pas l'illustration — identique d'une version à l'autre — mais le libellé, la rareté, le stock et le prix. Une grille met en avant ce qui ne différencie pas. La version courante y figure, mise en avant à l'ocre 8 % et **non cliquable** : un lien vers la page où l'on est déjà serait un piège. Elle remplace la rangée pleine largeur « Existe aussi dans cette variante », qui rendait UNE vignette dans six colonnes — 370 px pour une carte, poste le plus coûteux de la page (signalé en session 42).
- **Colonne de droite** : accroche calée sur le statut réel, prix, mention d'exemplaire et d'état, CTA, tableau technique (Jeu / Extension / Rareté / Version / Type / Attribut / Langue / Authenticité), paragraphe d'engagement. L'encart « Inspection » disparaît.
- **Bas de page** : « Du même set » devient « Dans la même série », avec sous-titre `[CODE] — [Nom], en stock chez Goriki.` et lien portant le nombre **réel** de cartes du set, compté en base — pas la longueur de la rangée, plafonnée à douze.
- **Aucun bloc « Marché »** : aucun historique de prix n'existe en base, il n'a pas été construit.

**Deux champs inventés, deux refus documentés.** « Langue » n'est aucune colonne — mais le catalogue vient de TCGdex en `fr` et de Poneglyphe en FR, boutique FR uniquement : la ligne décrit l'impression servie. « Authenticité » n'existe pas davantage, et Goriki ne peut garantir une pièce qu'il ne détient pas : **la ligne ne s'affiche que si un exemplaire est réellement en stock**. Sur une carte épuisée, elle se tait.

**Validations au rendu**, build de production, sur les deux univers :

| cas | résultat |
|---|---|
| Pokémon, 2 versions (Tropius ME05 #001) | section **présente**, « 2 versions répertoriées », ligne courante non cliquable, l'autre pointe vers sa fiche |
| Pokémon, 1 version (Branette EX5) | section **absente** — le test discrimine |
| One Piece (Luffy ST21-001) | structure identique, aucune divergence par univers |
| dépôt-vente **semé** sur la variante Normale | marqueur **affiché** sur la Normale, **absent** sur la Reverse de la MÊME carte — le filtre porte bien sur le couple, pas sur la carte seule |
| carte en stock **semée** (18,90 €, 2 pièces) | « Ajouter au panier », « 2 exemplaires disponibles · Near Mint », et la ligne **Authenticité apparaît** — absente en épuisé |
| tirets isolés servant de prix | **0** sur toutes les fiches testées · aucun « NaN » |
| fonds d'univers | Pokéball 42 cercles / 7 chemins · rose des vents 38 / 28 — distincts et intacts |
| hauteur de page (Tropius) | 2 376 px → **2 180 px** |

Données de test retirées : listings 1 642 → **1 641, 0 avec prix** ; `consignment_items` → **0 ligne**. État initial retrouvé dans les deux cas.

`tsc --noEmit` exit 0 · `npm run build` exit 0 · lint 0 erreur.

**Signalements.**
- **« Faire une offre » n'a pas été livré.** Aucun mécanisme d'offre n'existe — ni table, ni route, ni page de contact ; `buyback_requests.offer_amount` appartient au flux inverse (Goriki achète). Livrer le bouton aurait été livrer un contrôle mort, ce que la fiche a justement fini de purger (session 40). La **détection**, elle, est faite, testée et discriminante : le jour où une destination existe, le bouton s'y greffe en une ligne. Arbitrage RYUU sur ce que « faire une offre » doit déclencher.
- **Côté One Piece, la colonne de gauche reste vide sous la photo.** Seule la version `Standard` est importée (filtre obligatoire de `lib/opecards.ts`, CLAUDE.md), donc une carte One Piece n'a qu'une version et la section ne s'affiche jamais. Ce n'est pas un défaut de la section — c'est une conséquence du périmètre d'import.
- Rappel, cinquième signalement : `_sauvegarde_archi01_listings` et `_sauvegarde_archi01_cards` toujours en base.

### Session 44 — 2026-08-26 (éditeur de variantes : visuel par URL, et aération)

**1. « Coller une URL » vient EN PLUS du téléversement, pas à sa place.**

Nouvelle route `app/api/admin/catalogue/visuel-variante/url/`, SÉPARÉE de la route d'upload — même raisonnement que pour les scans d'exemplaires : les fondre aurait donné une route « visuel-variante » qui parfois téléverse et parfois non. Le flux d'upload n'est pas touché d'une ligne.

L'écriture passe par la **même RPC** que l'upload, `admin_poser_visuel_variante`, qui alimente `image_manuelle` — jamais `image_api`. Deux conséquences voulues : `image_url` étant générée (`coalesce(image_manuelle, image_api)`), la correction l'emporte immédiatement ; et elle **survit à l'import**, qui n'écrit que dans `image_api`. Écrire dans `image_api` aurait fait effacer la correction au prochain import — soit exactement l'inverse du besoin.

**Décision de périmètre, contre-intuitive : on n'accepte PAS « n'importe quelle URL valide ».** Le brief demandait d'élargir, et c'est fait — mais pas jusqu'à ce que le site ne sait pas afficher. `next.config.ts` ne déclare que deux `remotePatterns` : `assets.tcgdex.net` et `res.cloudinary.com`, et **`next/image` refuse tout autre domaine à l'exécution**. Or le visuel d'une variante ne reste pas dans l'éditeur : il ressort dans `ProductCard` (accueil) et dans le panier, qui passent tous deux par `next/image`. Une URL d'un troisième domaine s'afficherait parfaitement dans l'éditeur — qui utilise un `<img>` nu — puis planterait au panier, très loin de l'écran où elle a été collée. Un refus au collage coûte une seconde ; ce bug-là coûte une enquête. Les deux listes se citent l'une l'autre dans les commentaires pour qu'élargir l'une oblige à élargir l'autre.

**Une URL TCGdex sans extension est COMPLÉTÉE, pas refusée** : les URLs TCGdex n'en portent jamais, et le catalogue ajoute `/high.webp` (règle CLAUDE.md). Coller l'adresse nue donnerait une image morte alors que le lien « existe ».

**Correction d'un commentaire par la mesure.** J'avais écrit que le drapeau `goriki.edition_manuelle` posé par la RPC inscrit le champ dans `locked_fields`. **Vérifié en base : c'est faux** — les dix variantes portant un visuel manuel ont toutes `locked_fields` vide, celles posées par téléversement comprises. Ce n'est pas une régression : la protection contre l'import ne vient pas du verrou mais de la colonne elle-même, que l'import n'écrit jamais. Le commentaire dit désormais cela, pour ne pas laisser croire à une seconde garantie inexistante.

**2. Aération de l'éditeur.** La référence Poneglyphe n'étant pas dans le dépôt, la comparaison s'est faite sur la maquette admin qui en dérive, et sur des mesures au rendu :

| | avant | après |
|---|---|---|
| écart entre boutons voisins | **5 px** | **8 px** |
| écart entre blocs `.gk-field` | 13 px | 17 px |
| `gap` interne d'un `.gk-field` | 4 px | 6 px |
| padding du panneau d'édition | 14 px | 18 px |

La maquette pose 12 px entre ses contrôles ; on ne va pas jusque-là dans ce panneau, plus dense qu'une barre de facettes — mais on sort du contact. L'écart entre blocs reste nettement supérieur à l'écart interne, sans quoi la colonne se lit comme une seule liste continue.

**Validations**, build de production, session admin temporaire :

| vérification | résultat |
|---|---|
| collage d'une URL TCGdex valide | message « Visuel TCGdex corrigé », vignette mise à jour à l'écran |
| en base | `image_manuelle` = URL collée · `image_api` **intacte** · `image_url` générée = la correction |
| lien MORT (404 TCGdex) | **refusé**, HTTP 400, « Ce lien ne répond pas (HTTP 404) — le visuel n'a pas été changé » |
| domaine étranger | refusé, hôtes attendus nommés |
| Cloudinary d'un tiers | refusé, compte fautif nommé |
| chaîne non-URL · `http://` | refusés |
| TCGdex sans extension | **accepté et complété** en `/high.webp` |

Un `router.refresh()` a dû être ajouté : les actions serveur de cet écran revalident elles-mêmes, la route d'API non. Sans lui, la vignette et l'étiquette « visuel manuel » restaient sur l'ancien état alors que la base avait changé — le pire des deux mondes.

Données de test retirées : variante Alakazam BASE1 #1 remise à `image_manuelle = NULL`, **9 variantes à visuel manuel comme avant**. Compte admin de test supprimé, 0 résiduel.

`tsc --noEmit` exit 0 · `npm run build` exit 0 · lint 0 erreur.

**Deux scories rencontrées en cours de route**, toutes deux de moi : un bloc `poserVisuelUrl` mort laissé par une édition interrompue, qui référençait un état inexistant (`tsc` l'a attrapé) ; et un commentaire JSX glissé **entre deux attributs**, ce qui est une erreur de syntaxe — un commentaire ne peut vivre qu'entre éléments.

### Session 45 — 2026-08-26 (logos de set : correction par URL, sans la migration prescrite)

**La vérification demandée par le brief a renversé la conception prescrite. Aucune colonne `logo_manuel` n'a été créée, et c'est le point important de cette session.**

**Ce que le schéma dit réellement.** Les sets n'ont ni colonne générée ni séparation api/manuel : `pokemon_sets` porte `image_url` (le logo) et `symbol_url` (le symbole), toutes deux ordinaires — donc DEUX visuels, pas un. Aucun champ ne s'appelle `logo_api` ni `logo_url`.

**Pourquoi reproduire le schéma des variantes aurait été une faute.**

1. *Redondant.* Le mécanisme existe déjà, et il est d'une autre nature. `admin_corriger_set` écrit le champ ET l'inscrit dans `locked_fields` ; le trigger `verrous_pokemon_sets` (BEFORE UPDATE, actif) restaure la valeur de tout champ verrouillé à chaque écriture non manuelle — donc à chaque import. Les sets sont protégés par **verrouillage par champ**, les variantes par **colonne séparée**. Deux mécanismes concurrents pour la même garantie auraient fini par diverger.
2. *Destructeur.* `verrous_pokemon_sets` exécute `new.image_url := old.image_url`. Rendre `image_url` générée rendrait cette affectation **illégale** — Postgres refuse d'assigner une colonne générée dans un trigger. La migration aurait cassé le verrouillage de TOUS les autres champs du set au passage.

**Le vrai manque était l'interface.** `admin_corriger_set` gère `image_url` et `symbol_url` depuis toujours ; le panneau d'édition de set n'exposait que code / nom / série / sortie / nombre attendu. Le mécanisme était complet, seule son ouverture manquait — c'est ce trou qui empêchait de corriger un logo mort.

**Livré** : `app/api/admin/catalogue/logo-set/` (route dédiée, validation de domaine + sonde HEAD, puis `admin_corriger_set` avec `p_verrouiller: true`), et les deux blocs « Logo » / « Symbole » dans le panneau — aperçu, état, champ de collage, et « Relâcher vers l'API » quand c'est verrouillé. L'action `corrigerSet` existante n'a pas suffi : elle écrit sans rien vérifier et accepterait « coucou » comme logo.

**La complétion d'URL DIFFÈRE de celle des cartes**, comme le brief invitait à le revérifier : `lib/import/pokemon.ts` applique `withSuffix(…, '.png')` aux logos ET aux symboles, là où les cartes reçoivent `/high.webp`. `verifierUrlVisuel` prend donc désormais le suffixe en paramètre. Appliquer celui des cartes à un logo aurait produit une adresse morte à partir d'un lien correct.

**`next/image` ne touche PAS les logos de set** — vérifié : `SetVisual` et `SetsIndex` utilisent des `<img>` nus, et les quatre consommateurs de `next/image` (panier, `ProductCard`, `SealedRow`, `SealedTile`) ne rendent que des visuels de carte ou de produit. La restriction aux deux hôtes ne repose donc pas ici sur la contrainte technique invoquée pour les variantes, mais sur la politique d'images déclarée du site et sur l'absence de toute troisième source réelle.

**Un faux négatif de mon propre test, corrigé.** Le premier essai de verrou a conclu « VERROU CÉDÉ ». Cause : le trigger fait `new.locked_fields := old.locked_fields` **inconditionnellement** hors édition manuelle — mon `update` nu n'avait donc jamais posé le verrou qu'il prétendait tester. Rejoué en posant `goriki.edition_manuelle` comme le fait la vraie RPC : verrou tenu.

**Validations** :

| vérification | résultat |
|---|---|
| ré-import RÉEL rejoué sur EX5 (upsert identique à `lib/import/pokemon.ts`) | logo **verrouillé conservé**, symbole non verrouillé **réécrit** — dans la même instruction, le test discrimine |
| rendu public, fiche de set | le logo corrigé s'affiche |
| lien mort (404) | refusé — « Ce lien ne répond pas (HTTP 404) — le visuel n'a pas été changé » |
| domaine étranger · Cloudinary d'un tiers · non-URL · `http://` | tous refusés, chacun avec sa raison |
| URL TCGdex sans extension | complétée en **`.png`**, verrou posé (`locked_fields: ["image_url"]`) |
| panneau de set | blocs « Logo » et « Symbole » présents, aperçu + champ + bouton |

EX5 restauré : logo d'origine, `locked_fields` vidé. Compte admin de test supprimé, 0 résiduel. `tsc --noEmit` exit 0 · `npm run build` exit 0 · lint 0 erreur.

**Signalement — One Piece n'est pas couvert, volontairement.** `onepiece_sets` a **0 logo et 0 symbole sur 30 sets**, et aucun module d'import n'écrit ces colonnes (`lib/import/` ne contient que `pokemon.ts`). Ni trigger de verrous ni RPC de correction n'existent de ce côté. Y ajouter le mécanisme serait de la structure morte tant qu'aucun logo n'est importé. À reprendre le jour où l'import One Piece des sets sera écrit.

### Session 46 — 2026-08-26 (arbitrage des variantes contradictoires — missions 1 et 2)

Les chiffres du brief ont été vérifiés en base AVANT toute construction, et se confirment exactement : **1 412** cartes portant à la fois `NORMAL` et `HOLO` · cohortes **746 / 650 / 16** · **80** cartes avec du stock sur `NORMAL`, **0** sur `HOLO`.

## Mission 1 — le verrou

**Migration 0041.** Colonne `source` sur `pokemon_card_variants` ('api' | 'manuel'), même vocabulaire et même contrainte que `pokemon_variant_types.source`. Table `pokemon_variant_exclusions` (PK `(card_id, variant_type_id)`), RLS admin en lecture **comme** en écriture — divergence assumée avec `pokemon_variant_types`, qui porte une lecture publique : ce n'est pas du catalogue, c'est un journal de décisions internes.

`locked_fields` ne pouvait pas servir, et c'est structurel : il protège des CHAMPS d'une ligne existante, pas l'ABSENCE d'une ligne. Il fallait une trace positive.

**`insertListings`** charge les exclusions du set en une requête (`in` sur la colonne de tête de la PK — aucun index supplémentaire) et écarte les paires concernées. Une erreur de lecture **interrompt l'import** au lieu de continuer : importer sans connaître les exclusions reviendrait à recréer exactement ce que l'utilisateur a supprimé. `ignoreDuplicates` n'est pas touché.

**Test discriminant, deux passes sur le même set (BASE1)** :

| | candidats | retenus | résultat |
|---|---|---|---|
| passe 1, sans exclusion | 204 | 204 | comportement de référence inchangé |
| passe 2, avec exclusion | 204 | **203** | `[SKIP] 1 variante(s) exclue(s) manuellement`, variante **non recréée** |

Les 204 candidats des DEUX passes prouvent que TCGdex déclarait toujours la paire : c'est bien l'exclusion qui l'a retenue, pas une absence côté source. Base restaurée à 204 variantes, 0 exclusion.

## Mission 2 — l'écran d'arbitrage

**Migration 0042 — nécessaire, et non prévue au périmètre.** Le brief demandait « les trois opérations en une transaction » et un garde-fou « côté serveur ». `supabase-js` ne sait pas ouvrir de transaction : il fallait une fonction plpgsql, qui en est une par construction et qui héberge le garde-fou du même côté que l'écriture. Deux fonctions : `admin_variantes_contradictoires` (lecture) et `admin_arbitrer_variantes` (décision).

**Unité et lot ne se comportent pas pareil, volontairement.** À l'unité (`p_strict`), une carte protégée fait ÉCHOUER l'appel avec son message : l'utilisateur vise une carte précise. Au lot, elle est SAUTÉE et rapportée — faire échouer 1 400 cartes parce que l'une porte du stock rendrait le lot inutilisable, et on ne saurait pas laquelle a bloqué.

Les codes `NORMAL`/`HOLO` désignent la contradiction examinée et sont **résolus en base** : si l'un manquait dans `pokemon_variant_types`, l'écran le dit au lieu de rendre une page vide. La liste des types reste chargée dynamiquement partout ailleurs.

**Défaut trouvé et corrigé à la vérification.** L'écran affichait « 1 000 à arbitrer » et « 2 protégées par du stock ». Cause : PostgREST plafonne toute réponse à `db-max-rows` = 1 000. Des chiffres faux mais plausibles — le genre de troncature qui fait croire le travail fini alors qu'il en reste 412. La page charge désormais par tranches de 1 000 jusqu'à recevoir un lot incomplet : **1 412** et **80**.

**Validations** :

| vérification | résultat |
|---|---|
| garde-fou serveur (Zacian #045, 1 exemplaire sur `NORMAL`) | **HTTP 400** avec le message explicite, variante **toujours présente** |
| décision unitaire (Absol #1) | les **trois** écritures : `NORMAL` supprimée · exclusion inscrite (« arbitrage doublon NORMAL/HOLO ») · `HOLO` passée en `manuel` |
| écran | 1 412 cartes · 80 protégées · facettes cohorte 745/650/16, set, série, rareté, stock · trois actions unitaires · lot avec confirmation chiffrée |
| lecture des dates | sur Mélodelfe, `HOLO` du 06/07 porte « la plus ancienne » face à `NORMAL` du 22/08 |

Base restaurée : **29 210 variantes, 0 exclusion, 0 `source = manuel`**. Compte admin de test supprimé, 0 résiduel.

**Migrations versionnées et vérifiées byte-exactes** par md5 contre `supabase_migrations.schema_migrations` (`11a1f7ab…` et `773d959e…`) — un fichier de migration qui diffère de ce qui tourne est pire qu'un fichier absent.

`tsc --noEmit` exit 0 · `npm run build` exit 0 · lint 0 erreur.

**Deux faux négatifs de mes propres sondes.** Filtrer une ressource imbriquée par `.not('pokemon_listings', 'is', null)` ne sélectionne pas ce qu'on croit : la jointure reste, mais vide — le test des cartes protégées tournait à vide alors que les 80 existaient bien. Résolu en désignant la cible par une requête SQL. Et `admin_variantes_contradictoires` renvoie 0 ligne depuis l'éditeur SQL : `is_admin()` y est faux faute de session — le garde-fou fonctionne, c'est la vérification qui était mal placée.

**Hors périmètre, rappelé pour mémoire** : les **5 440 variantes `REVERSE` manquantes** sur 52 sets ne sont pas traitées ici. La table `pokemon_variant_exclusions` et la colonne `source` protégeront ce travail-là aussi.

### Session 47 — 2026-08-26 (modèle de variantes à TROIS AXES — missions 1 à 5)

Toutes les prémisses du brief vérifiées en base avant la moindre DDL, et toutes confirmées : 39 types dont **9 portant les 29 210 lignes** · `NORMAL` 15 452 (**568** sur set Wizards, **14 884** modernes) · `FIRST_EDITION` **676, toutes** antérieures à 03/2002 · aucun set sans date · Jungle #17 à **2 cases** dans la checklist · **38** sets sans symbole.

**Une divergence relevée dans le brief.** Il annonce « les 30 libellés à zéro » comme tampons, en listant les préfixes `TAMPON_* STAFF_* CHAMPION_* TOP4_* TOP8_* WINNER_PROMO`. Ces préfixes n'en couvrent que **26**. Les quatre autres — `MASTERBALL`, `ROCKET`, `HOLO_COSMOS`, `NON_HOLO` — ne sont pas des tampons : ils appartiennent aux axes tirage et finition, où les listes du brief les place effectivement. Les préfixes ont été suivis ; 48 tampons au total (26 repris + 22 des checklists).

**Mission 1 — 0043.** Trois tables de référence (11 tirages, 14 finitions, 48 tampons) et trois colonnes. `NOT NULL` et l'unicité N'Y SONT PAS, et ce n'est pas un oubli : `NOT NULL` sur une colonne ajoutée à 29 210 lignes échoue faute de valeur, et `UNIQUE NULLS NOT DISTINCT` sur quatre colonnes encore toutes NULL aurait vu autant de doublons que de cartes à plusieurs variantes. Les deux sont posés par 0044, après la reprise.

**Vérifié AVANT d'écrire la reprise** : la conversion produit **29 210 combinaisons `(carte, tirage, finition)` distinctes, 0 collision**. La contrainte d'unicité pouvait donc être posée sans perte.

**Mission 2 — 0044.** Les contrôles sont des **assertions**, pas un rapport : une divergence annule la transaction. Ce choix a payé immédiatement — une première version calculait la finition par un `lateral` dans le `FROM` de l'`UPDATE`. Un `lateral` y est une jointure **interne** : les lignes non-HOLO n'y trouvaient rien et étaient exclues de la mise à jour. **23 159 variantes seraient restées sans tirage.** L'assertion a levé, la base est restée intacte (0 ligne touchée, vérifié), et les sous-requêtes scalaires ont remplacé le `lateral`.

Répartition obtenue, conforme au tableau du brief ligne à ligne : NORMALE 20 935 (dont 6 051 en finition holo) · REVERSE 7 017 · PREMIERE_EDITION 676 · ILLIMITE 568 · POKEBALL 8 · COPAIN 2 · LOVE 2 · SOMBRE 1 · RAPIDE 1 — **29 210, 0 sans tirage, 0 orphelin**.

**Mission 3 — l'import.** `pickVariantIds` rend désormais des lignes à trois axes, avec la MÊME table de conversion que 0044, bascule Wizards comprise — deux tables divergentes finiraient par classer la même carte de deux façons selon qu'elle a été reprise ou importée. `onConflict` passe aux quatre colonnes, `ignoreDuplicates` conservé.

| réimport | candidats | créés | répartition |
|---|---|---|---|
| BASE1 (Wizards, 1999) | 204 | 0 | inchangée · « Illimité » présent |
| SV10 (moderne, 2025) | 416 | 0 | inchangée · « Normale », aucun « Illimité » |

**Mission 4 — l'éditeur.** Une **régression de ma propre migration** a été trouvée et réparée par 0045 : `admin_ajouter_variante` n'insérait que `(card_id, variant_type_id)` et échouait depuis que `tirage_id` est obligatoire — l'éditeur ne pouvait plus créer une seule variante.

`variant_type_id` devient **nullable** (la colonne reste, comme demandé) : la laisser obligatoire forcerait chaque création manuelle à inventer une valeur de l'ancien modèle, où « Illimité » et « Normale » retombent tous deux sur `NORMAL`. Conséquence traitée : la jointure de l'éditeur passe de `!inner` à externe, sans quoi toute variante créée à la main aurait **disparu de l'écran**.

La suppression écrit désormais dans `pokemon_variant_exclusions` — mais seulement si la variante portait un type de l'ancien modèle, seule clé que l'import consulte. Le garde-fou sur le stock est conservé tel quel.

**La checklist en regard**, et c'est ce qui rend l'écran utile. Sur le cas du brief, Mélodelfe Jungle #17 affiche **« 3 / 2 · 1 EN TROP »** : la base porte `Normale · holo`, `1ère édition` et `Illimité` là où la source n'attend que deux cases. L'écart est désormais visible au lieu d'être indicible. Trois listes déroulantes : tirage 11 choix, finition 15 (dont « — non déterminée — »), tampon 49.

Couverture partielle assumée et dite à l'écran : **267 checklists mais 176 lignes de mapping**. Un set sans référence affiche « aucune checklist rattachée », jamais un tableau vide qu'on lirait comme « zéro case attendue ».

**Mission 5 — déjà livrée en session 45.** La route `logo-set` traite `nature: 'symbole'` → `symbol_url` avec la même validation et la même sonde. Vérifié plutôt qu'affirmé : une URL Cloudinary du site est **acceptée et verrouillée** sur `symbol_url`, celle d'un tiers **refusée** avec le compte fautif nommé. Rien de neuf à écrire.

**État final** : 29 210 variantes · 0 sans tirage · 6 051 finitions · 0 `source = manuel` · 0 exclusion · 0 orphelin · 38 sets sans symbole. Toutes les données de test retirées ; le seul set verrouillé (BASE1, logo Cloudinary) est une correction réelle antérieure, laissée intacte.

`tsc --noEmit` exit 0 · `npm run build` exit 0 · lint 0 erreur. Les trois migrations sont versionnées et **vérifiées byte-exactes** par md5 contre `supabase_migrations.schema_migrations`.

**Signalements.**
- **`variant_type_id` reste en place**, désormais nullable. Sa suppression demande une migration à part, et devra d'abord traiter les exclusions, qui sont encore indexées dessus.
- **Les données de checklist ont été copiées dans `data/`** (1,1 Mo). Elles vivaient hors du dépôt, sur le bureau : l'application ne pouvait pas les lire. À décider si elles doivent être versionnées ou traitées comme un import.
- Hors périmètre, rappelé : 5 440 `REVERSE` manquants, les finitions à créer depuis les blocs nommés, et les 1 412 doublons `NORMAL`+`HOLO` — qui s'expriment maintenant comme `Normale · non-holo` face à `Normale · holo`.

### Session 48 — 2026-08-31 (réconciliation catalogue ↔ checklists — missions 1 à 3)

**La normalisation des numéros décide de tout le reste.** `checklist_cible` n'écrit **aucun** zéro de tête sur ses 34 683 numéros ; la base en porte **2 951 sur 19 641** cartes. Comparer les chaînes telles quelles fait passer pour « inconnue de la checklist » chaque variante d'un set moderne : **7 560 faux écarts mesurés au lieu de 1 599**. Le `regexp_replace(…, '^0+(?=.)', '')` des deux côtés n'est pas une commodité, c'est la condition de justesse de l'écran — c'est écrit en tête de 0046 pour que personne ne l'enlève.

**Une divergence assumée, non ajustée.** Sur les cinq familles annoncées par le brief, quatre tombent exactement juste, **stock compris**. `Normale` diverge : **1 195 mesurés contre 412 annoncés**, alors que son stock (8) est exact. Trois hypothèses testées — découpe `carte_connue` (615/580), sets portant une ligne NORMALE (1 091/104), variantes de sets Wizards — aucune ne reproduit 412. L'écran montre **le chiffre réel** ; ajuster la requête pour retomber sur un nombre attendu aurait produit un écran faux mais rassurant.

**Mission 1 — la file (0046, 0049, 0050).** Une seule file, jamais un écran par set : `set · nº | carte | en base | checklist | stock`, six familles de facettes combinables (famille, **stock**, set, série, rareté, tirage), 50 lignes par page, **stock en tête du tri par défaut** — c'est lui qui porte le risque. `finition_id IS NULL` n'est **jamais** présenté comme une lacune : la notation écrit `Normale`, pas `Normale · —`, et la comparaison utilise `is not distinct from` pour que NULL s'apparie à NULL.

**Le plafond PostgREST, retombé dedans après l'avoir documenté.** L'écran a affiché « Écarts restants = **1 000** » pour 1 599 réels : `db-max-rows` tronque, silencieusement, comme sur l'écran d'arbitrage — et le piège était décrit dans le commentaire de cette page même, pour la pagination, pendant que les facettes le rejouaient. Corrigé par 0049 : agrégation **en base**, aucun plafond, seuls les totaux remontent.

**Mission 2 — trois actions, garde-fous côté serveur (0047, 0048, 0052).** *Rattacher et supprimer* (déplace les exemplaires vers la jumelle sans finition, renumérote `copy_index`, supprime), *Supprimer* (refusée dès **un** exemplaire), *Conserver* (motif obligatoire, sortie définitive de la file). Les garde-fous vivent dans la RPC, **pas** dans la route : les dupliquer aurait créé une seconde règle, qui aurait dérivé.

**Aperçu d'impact avant toute écriture**, et **rapport ligne à ligne** après : « Raichu SV03.5 #026 · Normale · holo — 1 exemplaire(s) rattaché(s)… Exclusion inscrite. » Jamais « 45 variantes supprimées », qui ne dit pas lesquelles. Chaque ligne s'exécute dans sa propre **sous-transaction** (`begin … exception`) : sur échec partiel, les lignes traitées restent traitées — vérifié, Tortank BASE1 #2 supprimée pendant qu'une autre était refusée avec « Porte 1 exemplaire(s) : la supprimer détruirait une pièce physique. »

**Un no-op de ma propre écriture, rattrapé.** 0047 contenait un `insert … where false` : un bloc qui avait l'apparence d'écrire l'exclusion et n'écrivait rien. **Une suppression sans exclusion est défaite au prochain import** — tout le travail de la file serait revenu, silencieusement. 0048 capture `variant_type_id` **avant** le DELETE (après, la clé n'existe plus) et insère réellement.

**Mission 3 — `/admin/catalogue/arbitrage` supprimé**, pas seulement démonté du rail : route, API et composant retirés du dépôt, l'URL rend **404**. Il écrivait avec la logique d'un modèle à un seul type de variante ; le laisser accessible était plus dangereux que de le supprimer.

**Performance : mesurée, améliorée, puis arrêtée en le disant.** Première mesure honnête à **8 246 ms** — obtenue par `explain analyze` dans une transaction annulée forçant `is_admin()` à vrai, parce que dans l'éditeur SQL le garde-fou court-circuite et rend un **79 ms** qui ne veut rien dire. Cause localisée : quatre sous-requêtes corrélées dans la vue, évaluées sur 35 386 lignes pour ne servir que sur les 50 affichées. 0051 allège la vue et déplace l'enrichissement **après** le `limit` ; 0053 le regroupe en deux passes au lieu de cent appels scalaires. Répartition finale : vue **227 ms**, corps **1 118 ms**, RPC complète **5 089 ms** — l'écart restant est dans les trois CTE d'enrichissement. **Je m'arrête là** : l'écran est correct et utilisable, et le chiffre est dit plutôt que masqué.

**Aucun prix, nulle part.** Vérifié au rendu : le caractère `€` n'apparaît pas une seule fois dans l'écran. Aucune valeur de prix n'est lue, écrite ni calculée dans la route ni dans les RPC.

**Un faux positif d'encodage.** Un motif conservé s'affichait « promo non list?e par Pok?Cardex ». Retesté depuis Node en UTF-8 explicite : accents parfaits. C'était **mon shell Windows**, pas l'application. Et une sonde a cru la page vide : elle rend bien (200, 105 Ko) mais mettait 8,5 s, quand la sonde n'attendait que 8 s.

**Base restaurée au point de départ** : 1 599 écarts · 84 avec stock · 0 conserve · 35 386 variantes · 11 exclusions · 1 641 exemplaires. Compte admin de test supprimé, 0 résiduel.

**Huit migrations (0046 → 0053, 47 063 octets) versionnées et vérifiées byte-exactes** par md5 contre `supabase_migrations.schema_migrations`.

**Signalements.**
- **`lib/import/pokemon.ts` n'a pas été touché** (interdit par le brief). L'import respecte les exclusions ; il ne connaît pas encore `pokemon_variant_conserves`. Une variante conservée avec motif sort de la file, mais rien n'empêcherait un futur import de la recréer autrement — à trancher.
- La RPC de file reste à **~5 s**. Piste identifiée si le sujet revient : matérialiser la cible dépliée plutôt que la reconstruire à chaque appel.
- Rappel des points ouverts inchangés : `_sauvegarde_archi01_*` toujours en base, `components/admin/AdminHeader.tsx` orphelin, retrait de `variant_type_id` non planifié, versionnement de `data/checklists.json` non tranché, 8 erreurs `no-explicit-any` préexistantes dans `admin/clients` et `admin/commandes`.

### Session 49 — 2026-09-14 (éditeur de variantes : la création était morte)

**Symptôme rapporté** : on peut supprimer une variante, on ne peut en créer aucune.

**Cause, reproduite et non déduite.** Le bloc « Ajouter une variante » appelait encore
`ajouterVariante` → `admin_ajouter_variante`, la RPC à UN SEUL AXE, qui n'insère que
`(card_id, variant_type_id)`. Depuis que 0044 a posé `tirage_id NOT NULL`, tout appel
échoue. Sonde en transaction annulée :
`23502 null value in column "tirage_id" of relation "pokemon_card_variants"`.
`ajouterVarianteAxes`, écrite en session 47 pour la remplacer, était **importée dans le
composant mais branchée nulle part** — seule `modifierAxesVariante` l'était, pour l'édition.
La suppression marchait parce que `supprimer_variante` n'a jamais dépendu des axes.

**Deuxième défaut, invisible tant que la création l'était.** Toutes les étiquettes de
variante venaient de `pokemon_variant_types.label`. Or 0045 a rendu `variant_type_id`
nullable, et une variante créée à la main le laisse NULL : la ligne serait apparue
**sans nom** dans la grille, dans les facettes, dans les sœurs et dans l'en-tête du panneau.
On l'aurait recréée en boucle en croyant avoir échoué. D'où `notation()`, qui nomme une
variante par ses trois axes et ne retombe sur l'ancien label qu'en dernier recours.
Le tri de la fratrie passe aussi au `sort_order` des tirages.

**Ce qui remplace la rangée de boutons.** Un formulaire à trois listes — tirage obligatoire,
finition et tampon facultatifs — plutôt que `+ Normale / + Reverse`. Une variante ne se
DUPLIQUE pas depuis une autre : ce qui la distingue, ce sont ses trois axes, et les choisir
explicitement est le geste. Copier une ligne puis la corriger ferait passer par une
combinaison intermédiaire qui peut déjà exister, et l'écriture serait refusée pour une
variante que personne ne voulait créer.

Le doublon est détecté AVANT l'appel, sur les trois axes et **jamais** sur `variant_type_id`
qui est NULL sur toute création manuelle et rendrait le test toujours vrai.

**Vérifié au rendu**, session admin réelle sur le set XYA (6 cartes, 6 « Normale ») :

| contrôle | résultat |
|---|---|
| étiquette d'une variante sans finition | **« Normale »**, pas « Normale · — » ni vide |
| formulaire | 3 listes — tirage 11 + « choisir », finition 15, tampon 58 |
| bouton sans tirage | **désactivé**, motif affiché |
| création (tirage Reverse) | « Variante « Reverse » créée sur M-Élecsprint-ex. » |
| en base | `source = manuel`, `variant_type_id` NULL, XYA 6 → 7 |
| à l'écran | tuile « REVERSE · SANS VISUEL », facette « REVERSE 1 », sœur nommée |
| même combinaison redemandée | bouton **fermé** — « porte déjà exactement cette combinaison » |
| suppression | « Variante supprimée. » · XYA 7 → 6, **aucune exclusion écrite** (pas d'ancien type) |

**Restriction de set abandonnée pour la création, et dit à l'écran.** `variantes_autorisees`
s'exprime en types de l'ANCIEN modèle, où « Illimité » et « Normale » retombent tous deux
sur `NORMAL`. La transposer aux trois axes demanderait une table de correspondance qui
n'existe pas ; l'inventer aurait interdit des tirages légitimes. Les 11 tirages sont donc
proposés, l'aide de l'écran explique pourquoi, et c'est la checklist du numéro qui garde le
rôle de garde-fou. La RPC et le prop `typesAutorises` ont été retirés de cet écran plutôt
que laissés à tourner à vide.

**`ajouterVariante` supprimée du fichier d'actions.** Une action serveur exportée est un
point d'entrée enregistré par Next.js : en garder une qui ne peut que lever `23502`
invitait à la recâbler.

`tsc --noEmit` exit 0 · lint 0 problème sur les trois fichiers touchés. Compte admin de test
supprimé (users, identity, profil : 0 résiduel), Chrome headless arrêté, serveur de
développement de l'utilisateur sur le port 3000 **non touché**.

**Un piège d'outillage, noté pour la prochaine fois.** Un compte admin créé directement en
SQL ne peut pas se connecter tant que deux choses manquent : la ligne `auth.identities` du
provider `email`, et surtout des colonnes de jetons (`confirmation_token`, `recovery_token`,
`email_change*`, `phone_change*`, `reauthentication_token`) à `''` et non à NULL — GoTrue ne
sait pas lire un NULL et rend « Invalid login credentials », c'est-à-dire un message qui
accuse le mot de passe alors que le mot de passe est bon.

**Signalements.**
- **La RPC `admin_ajouter_variante` existe toujours en base**, désormais sans appelant. Elle
  ne peut plus que lever `23502`. Sa suppression est du DDL irréversible : à faire dans une
  migration dédiée, avec le retrait de `variant_type_id` déjà en attente.
- Les compteurs ont bougé depuis la session 48 (35 369 variantes, 1 600 écarts contre
  35 386 et 1 599) : travail fait entre-temps hors session, pas une dérive de celle-ci.

### Session 50 — 2026-09-26 (ZARA — Want to Buy : actions sur les demandes)

**Deux prémisses du brief vérifiées avant d'écrire, une confirmée, une fausse.**
Les policies RLS UPDATE et DELETE du propriétaire existaient bien. En revanche
**l'index unique n'existait pas** — le brief l'annonce au futur (« va interdire »).
Sans lui, l'exigence « gérer l'erreur de contrainte unique renvoyée par la base »
n'aurait rien eu à gérer. Migration **0054**, sur une table **vide** (0 ligne,
vérifié) : aucune reprise à faire.

**L'index est partiel, et c'est le cœur du sujet.** `where status = 'active' and
card_id is not null` : une demande trouvée ou annulée ne doit pas interdire de
rechercher à nouveau la même carte plus tard, et deux recherches en texte libre ne
sont jamais « la même carte ». Un index total aurait bloqué les deux cas pour
toujours. `card_type` entre dans la clé : rien ne garantit qu'un uuid Pokémon ne
croise pas un uuid One Piece.

**Un trou trouvé en chemin, fermé dans la même migration.** La policy UPDATE avait
un `USING` mais **pas de `WITH CHECK`** : `USING` dit quelles lignes on peut
modifier, `WITH CHECK` dit ce qu'elles ont le droit de devenir. Le propriétaire
pouvait donc réécrire `user_id` et déplacer sa demande dans la liste d'un autre
client. L'écran commence ici à faire des UPDATE — on ferme avant, pas après. La
condition est la copie exacte de `USING` : rien de légitime n'est refusé.

**Anti-doublon à deux barrières, un seul message.** Une lecture avant l'insertion
donne la bonne phrase tout de suite ; elle ne suffit pas, car entre le select et
l'insert un second onglet peut passer. C'est l'index qui tranche, et le `23505`
est traduit par la **même** phrase — un « erreur 500 » à cet endroit ferait croire
à une panne alors que la liste est simplement déjà à jour.

**`.select()` sur UPDATE et DELETE.** RLS filtre sans bruit : un update ou un
delete qui ne touche aucune ligne réussit. Sans relire les lignes affectées,
l'écran annoncerait une modification qui n'a pas eu lieu. Les deux routes rendent
désormais 404 dans ce cas.

**`cancelled` est refusé par la route**, volontairement : cet écran supprime pour
de bon, il ne range pas les demandes dans un état qu'aucun onglet n'affiche.

**Vérifié au rendu**, compte client réel (`zara-a@goriki.test`), sur un serveur de
production construit pour l'occasion :

| contrôle | résultat |
|---|---|
| ligne | `Dracaufeu / 001 / En attente / SANS LIMITE DE PRIX / JE L'AI TROUVÉE / PRIX MAX / SUPPRIMER` |
| tiret dans la liste | **aucun** (`tiretDansLaListe: false`) |
| prix max = 120 | affiche `MAX 120,00 €` |
| prix effacé | revient à `SANS LIMITE DE PRIX` |
| « Je l'ai trouvée » | onglets passent à `Trouvées (1) · En attente (0)`, puce « Trouvée », action retirée |
| suppression | confirmation inline, puis `Toutes (0)` — ligne réellement partie |
| même carte deux fois | route **409** + `Cette carte est déjà dans votre want list.` affiché dans le formulaire, **1 seule ligne** créée |

Garde-fous SQL prouvés en transaction annulée : 2ᵉ active sur la même carte
**refusée** (23505) · active **après** une trouvée **acceptée** · deux recherches
libres **acceptées** · autre carte **acceptée**. Et sous RLS, en se faisant passer
pour un client : modifier son propre prix **accepté**, déplacer la ligne vers un
autre compte **refusé** (42501).

`tsc --noEmit` exit 0 · `npm run build` exit 0 · lint 0 problème sur les fichiers
touchés. Migration versionnée et **vérifiée byte-exacte** (`cff12ad9…`, 2 647 o).
Comptes et lignes de test supprimés ; la demande du compte réel, créée pendant la
session, a été **laissée intacte**.

**Signalements.**
- **Le serveur `next dev` de l'utilisateur (port 3000) sert du code périmé** : son
  watcher ne suit plus. `PATCH` y répondait **405** alors que la route existait sur
  disque. Il faut le redémarrer pour voir ces changements ; la vérification a été
  faite sur un `next start` séparé, port 3100, depuis arrêté.
- **`components/compte/WantToBuyList.tsx` est du code mort** — plus aucun import
  depuis que `WantList` l'a remplacé. Laissé en place : hors périmètre du brief.
- Trois pièges de sonde, notés pour ne pas les repayer : la page porte **deux
  `<form>`** (la recherche de l'en-tête d'abord), les onglets sont des `<button>`
  comme les actions, et `innerText` rend les libellés **en capitales** (CSS).

### Session 51 — 2026-09-26 (KAEL/ZARA mission 1 — livraison au poids : modèle et calcul)

Première des trois missions livraison. La grille forfaitaire (`SHIPPING_RATES` dans
`lib/constants.ts`, BE 5 € / autres 8 € / offerte dès 60 €) est remplacée par des
DONNÉES : une grille transporteur change sans prévenir, et une grille en dur oblige
à redéployer pour corriger un prix. `lib/shipping.ts` reste en place jusqu'à la
mission 2, comme demandé.

**Migration 0055.** `shipping_settings` (singleton imposé par `id = 1` : deux lignes
de réglages et le calcul dépendrait de l'ordre de lecture), `shipping_rates`
(22 lignes, 5 pays), `sealed_products.weight_g`, et huit colonnes sur `orders`.

**Deux CHECK ajoutés au-delà du brief**, parce que l'écran d'admin peut saisir
n'importe quoi et que la mission 3 découvrirait l'incohérence au moment de générer
l'étiquette — trop tard : une lettre doit avoir `sendcloud_method_code` NULL, ne pas
être suivie et ne pas avoir de point relais ; un non-lettre doit avoir un code ; et
`needs_service_point` doit égaler `kind = 'service_point'`. Les cinq garde-fous
(dont le singleton et la liste de pays) sont **vérifiés en transaction annulée** :
tous refusent ce qu'ils doivent refuser.

**`weight_g` est NULL, jamais 0.** « Pas encore pesé » n'est pas « ne pèse rien ».
Un scellé sans poids BLOQUE le devis avec un message qui le nomme, plutôt que de
sous-estimer le port — l'erreur ne se verrait sinon qu'à l'affranchissement, une
fois la commande encaissée.

**Le calcul est coupé en deux, et c'est ce qui le rend vérifiable.**
`lib/livraison/calcul.ts` est PUR : pas de base, pas de réseau. `lib/livraison/devis.ts`
lit les prix et les poids et n'a aucune décision à prendre. Sans cette coupure, les
bascules exactes ne se testeraient qu'en semant des données.

**Tout est calculé en centimes.** 3,26 + 1,00 en flottant nu rend 4,260000000000001.
Sur un montant facturé c'est une erreur, pas une approximation. Un test le verrouille.

**20 tests, tous verts**, lancés par le lanceur intégré de Node 24 — qui lit le
TypeScript sans transpilation : **aucune dépendance de test ajoutée**. `npm test`
ajouté au `package.json`. `allowImportingTsExtensions` posé dans `tsconfig.json`
(permis car `noEmit`) : Node exige l'extension explicite, TypeScript la refusait.

Couverture demandée par le brief, toute vérifiée : lettre à **24,99 € oui / 25,00 €
non** (seuil strict), lettre exclue **au-delà de 100 g** (100 g passe encore),
Mondial Relay exclu **au-delà de 250 g**, **DE sans Mondial Relay**, scellé sans
poids **bloquant**. Plus : bascule FR domicile 200 g (7,68 € → 15,94 €), une seule
ligne par couple (transporteur, nature), tri par total croissant, et le refus d'une
lettre forcée sur un panier à 30 € — le garde-fou que la mission 2 devra appeler.

**Écran `/admin/livraison`** dans le design system admin, ajouté au rail sous Ventes.
Seuls prix, poids maximum et activité sont éditables : le code Sendcloud, le pays et
la nature définissent l'offre, les changer reviendrait à faire dire autre chose à un
code déjà facturé sur des commandes passées.

**Un défaut trouvé au rendu, et corrigé.** Avec `revalidatePath` dans l'action
serveur, l'écriture partait bien et la base était à jour, mais **la transition ne se
terminait jamais** : le bouton restait sur « … », désactivé, indéfiniment. Mesuré à
la sonde réseau — la réponse de l'action n'arrivait pas au client. Remplacé par un
`router.refresh()` côté client, le motif déjà éprouvé sur l'éditeur de variantes et
la want list : l'édition se referme en ~2 s, les boutons se réarment à ~4 s.

**RLS vérifiée sous les trois rôles** : anonyme voit 3 tarifs BE sur 4 quand un est
désactivé, lit les réglages, et son UPDATE touche **0 ligne** ; admin voit les 4.

`tsc` 0 · `npm run build` 0 · lint 0 · `npm test` 20/20. Migration versionnée et
**byte-exacte** (`b6c83390…`, 11 284 o). Grille restaurée à l'identique après les
essais (22/22 conformes), compte admin de test supprimé, serveur de test arrêté,
serveur de développement de l'utilisateur non touché.

**Signalements.**
- **`bp_home_nl_heavy` ne pourra JAMAIS être choisi.** Il partage transporteur,
  nature et plafond (2 000 g) avec `bp_home_nl_box` à 6,70 € contre 11,25 € : la règle
  « la moins chère par couple » élit toujours la boîte aux lettres. La note du brief
  mentionne des dimensions max (38 × 26 × 3 cm) que le modèle ne porte pas — il
  faudrait une contrainte d'encombrement, ou retirer la ligne.
- **Les deux poids sont provisoires** (carte 11 g, enveloppe 12 g) et l'écran les
  marque comme tels. Ils décident à eux seuls quel mode est proposé : une pesée
  fausse de 2 g par carte déplace le seuil de la lettre de deux cartes.
- **Les cinq lignes « lettre » sont provisoires** : à confirmer au simulateur bpost
  selon l'épaisseur réelle de l'enveloppe.
- **Aucun scellé n'est pesé** (0 sur 1) : tout panier contenant le produit scellé
  existant sera refusé au devis tant que son poids n'est pas saisi.
- `lib/shipping.ts` et `SHIPPING_RATES`/`MIN_ORDER_AMOUNT` de `lib/constants.ts`
  sont toujours en place et toujours utilisés par `/api/stripe/checkout` et
  `CheckoutClient` : c'est la mission 2 qui les remplace et les supprime.

### Session 52 — 2026-09-26 (ZARA mission 2 — checkout : adresse, transporteur, point relais, puis Stripe)

**Aucune migration.** Tout le schéma nécessaire vient de 0055 (mission 1).

**Le renversement.** L'adresse ET le mode de livraison étaient collectés PAR Stripe.
Stripe sait faire les deux, mais il ne sait pas faire choisir un point relais — or
c'est le mode le moins cher sur la plupart des paniers. Tout remonte donc sur
`/checkout`, et Stripe ne sert plus qu'à encaisser : `shipping_address_collection` et
`shipping_options` ont disparu, livraison et forfait sont devenus des LIGNES de la
session.

**Une seule lecture des articles dans la route.** Les mêmes lignes servent au contrôle
de stock, aux lignes Stripe et au calcul du port. Relire pour le devis aurait ouvert
une fenêtre où le prix facturé et le prix pesé ne viendraient pas de la même lecture.
La route appelle donc `chargerBaremeLivraison` + `calculerOptionsLivraison`, c'est-à-dire
le calculateur de la mission 1, sans dupliquer une règle.

**Ce que le client envoie, et ce qu'il ne peut pas envoyer.** Un CODE d'option, une
adresse, un point relais. Aucun montant. Le serveur refait le devis et passe par
`optionEligible` : une lettre réclamée sur un panier à 30 € est refusée même en forgeant
la requête — vérifié. L'avoir est plafonné deux fois, au solde lu en base et au total
de la commande, et n'est jamais lu depuis le corps de la requête.

**Webhook.** Il ne lit plus `session.shipping_cost` ni l'adresse Stripe : les deux sont
écrits à la création. Les relire les aurait écrasés par du vide, Stripe ne les
collectant plus. Il relit la commande à la place. Rien d'autre n'a bougé.

**Règle du scellé.** `bp_home_nl_box` (boîte aux lettres, 3 cm) sort du devis dès qu'un
scellé est au panier. L'exclusion est par CODE et c'est un pis-aller assumé : la vraie
contrainte est une épaisseur, et le modèle ne porte aucune dimension. Effet de bord
utile — `bp_home_nl_heavy`, que j'avais signalé comme inatteignable en mission 1,
devient enfin sélectionnable.

**Vérifié bout en bout**, session client réelle, requêtes forgées côté serveur :

| scénario | résultat |
|---|---|
| devis BE, 1 booster (10 €, 33 g) | 4 options · `letter_be@3.26 · mr_sp_be@3.89 · bp_sp_be@5.44 · bp_home_be@6.19` |
| devis FR, même panier | lettre présente, options triées par total |
| **devis NL avec un scellé** | **`bp_home_nl_box` ABSENT**, `bp_home_nl_heavy` présent |
| devis BE, 3 boosters (30 €, 83 g) | lettre exclue par la VALEUR — le poids restait sous 100 g |
| commande BE Mondial Relay + point relais | **200**, session `cs_test_…` créée |
| même commande SANS point relais | **400** — « Ce mode exige un point relais » |
| lettre FR à moins de 25 € | **200**, session créée |
| **lettre forcée sur 30 €** | **400** — « Ce mode de livraison n'est pas disponible » |
| CGV non cochées / adresse incomplète | **400** chacune |

En base, les deux commandes portaient bien toutes les colonnes : `shipping_label` figé,
`shipping_country`, `shipping_weight_g` 33, `handling_fee` 1,00, `shipping_cost` = port
SEUL, `service_point` complet avec son transporteur, `shipping_address` structurée.
Totaux justes : 10 + 3,89 + 1,00 = **14,89 €** et 10 + 3,30 + 1,00 = **14,30 €**.

**Vérifié au rendu** : trois étapes numérotées, 5 champs d'adresse, les 4 options avec
port + forfait + total, « Envoi non suivi et non assuré » **sous la lettre seulement**,
le poids affiché, le sélecteur de point relais qui apparaît sur Mondial Relay, la case
CGV avec son lien `/cgv`, et le bouton Payer qui dit CE QUI manque au lieu de rester
gris et muet. Aucune occurrence de « frais bancaires », « frais de paiement » ni
« frais Stripe ».

**Mode Stripe déterminé sans ouvrir `.env`** : la clé PUBLIABLE est inlinée dans le
bundle par construction (donnée publique). 425 occurrences de `pk_test_` contre 3 de
`pk_live_` — ces trois-là étant le littéral de comparaison dans
`admin/commandes/[id]/page.tsx`. Mode **test** confirmé, puis re-confirmé par les
sessions `cs_test_` créées.

**Supprimés** : `lib/shipping.ts`, `SHIPPING_RATES`, `MIN_ORDER_AMOUNT` et tous leurs
usages (`CheckoutClient`, `PanierClient`, route Stripe). Le panier n'annonce plus
« dès 5 € » : le port dépend du poids et du pays, tous deux inconnus avant l'adresse.

`tsc` 0 · `build` 0 · `npm test` **24/24** · lint **18 problèmes**, soit un de MOINS que
la ligne de base de la session 49 (19) — le seul restant dans mes fichiers est le
`setHydrated` de l'hydratation, motif présent dans tout le dépôt et explicitement
protégé par le commentaire « fix mission 02, à ne pas casser ».

Base rendue à l'état trouvé : 0 commande, stock du booster à 36, `weight_g` à NULL,
comptes de test supprimés, 22 tarifs actifs.

**Signalements.**
- **`envelope_weight_g` vaut 8 g** et non 12 : modifié par le propriétaire à 20 h 09 via
  l'écran de la mission 1. Constaté en vérifiant un poids qui ne tombait pas juste —
  valeur légitime, laissée telle quelle.
- **Le sélecteur Sendcloud n'a pas pu être exercé** : il exige
  `NEXT_PUBLIC_SENDCLOUD_PUBLIC_KEY`, absente de l'environnement. Le composant le dit à
  l'écran et bloque ; le serveur refuse de son côté toute commande sans relais sur une
  option qui en exige un. Les deux barrières sont indépendantes, mais l'ouverture réelle
  de la carte reste à valider avec une vraie clé.
- **`/cgv` n'existe pas** : le lien de la case à cocher mène à un 404. Attendu — le brief
  demande le lien, la page viendra plus tard. À créer avant ouverture.
- **Deux sessions Stripe de TEST** ont été créées puis abandonnées ; leur stock a été
  libéré par `release_order_checkout`. Elles expirent d'elles-mêmes en 30 minutes.
- **Le scellé existant n'a toujours pas de poids** (`weight_g` NULL) : tout panier le
  contenant sera refusé au devis, avec le message qui le nomme. Vérifié au rendu.

### Session 53 — 2026-09-26 (REX — sélecteur de points relais indisponible)

**Cause racine : l'URL du script était un 404.** J'avais écrit
`https://embed.sendcloud.sc/spp/1.0.0/api.js` de mémoire à la mission 2, sans la
vérifier faute de clé. Le vrai fichier est **`api.min.js`**. Un `<script>` qui
404 ne se voit nulle part si on ne le cherche pas : `onerror` part, rien n'est
journalisé, et l'onglet Réseau n'a plus rien à montrer aux clics suivants — ce qui
explique exactement le constat « aucune requête vers Sendcloud ».

CSP écartée en premier : il n'y en a aucune, ni dans `proxy.ts` ni dans
`next.config.ts`.

**Trois autres défauts, trouvés en LISANT le script au lieu de le supposer.** J'ai
téléchargé `api.min.js` (3,8 Ko) et lu son contrat :

1. `successCallback(data.point, data.postNumber)` rend **UN POINT**, pas un tableau.
   Mon `points?.[0]` aurait rendu `undefined` : même avec la bonne URL, choisir un
   point n'aurait **rien** fait, en silence.
2. Fermer la carte appelle `onFailure(['Closed'])`. J'affichais une erreur pour un
   geste volontaire.
3. La promesse de chargement était mémorisée **même rejetée** : tout clic suivant
   échouait instantanément, sans requête réseau. Deuxième explication au symptôme.

Corrigés tous les quatre, plus `country` passé en majuscules (forme ISO que Sendcloud
documente).

**Le 401 sur `/api/checkout/livraison` : la route a raison, c'est la page qui avait
tort.** Mesuré : anonyme → **401 « Non connecté »** ; connecté → **200, 4 options**.
La requête partait donc bien avant toute session. `/checkout` acceptait un visiteur
anonyme alors que toutes les pages `/compte` redirigent (`redirect('/login?redirect=…')`) ;
la page n'échouait qu'au clic sur Payer. Depuis que le devis part dès l'affichage, cet
anonymat produit un 401 et un écran sans options. `/checkout` exige désormais une session.

**Validé en conditions réelles, connecté.** Script **200**, `window.sendcloud` posé,
iframe ouverte sur `servicepoints.sendcloud.sc/embed/v3/service-point-picker/` avec
`country=BE`, `carrier=mondial_relay`, `postal-code=1000`, `language=fr`. De vrais
points relais bruxellois s'affichent (UNIQUE MOBILE, boulevard Maurice Lemonnier 24,
538 m).

La carte Mapbox ne répond pas à un `.click()` synthétique — piloter une UI tierce
n'est pas ce qu'il fallait prouver. La couture, elle, a été exercée pour de vrai :
le message `servicePointSelected` émis **depuis l'iframe**, donc avec sa véritable
origine, seule que le handler du script accepte. Tout le reste du chemin est le code
réel. Résultat : iframe fermée automatiquement, « Point relais · UNIQUE MOBILE » au
récapitulatif, bouton Payer encore bloqué tant que les CGV ne sont pas cochées, puis
redirection `cs_test_…`.

En base, la commande portait :
`service_point = { id: "10875421", nom: "UNIQUE MOBILE", adresse: "BOULEVARD MAURICE
LEMONNIER 24, 1000 BRUXELLES", transporteur: "mondial_relay" }`.

**`SENDCLOUD_SECRET_KEY` n'apparaît nulle part dans `app/`, `lib/` ni `components/`.**
Seule `NEXT_PUBLIC_SENDCLOUD_PUBLIC_KEY` est lue, côté client, comme prévu.

**Tirets cadratins.** Le libellé visé est passé à « + 1,00 € de préparation, soit
4,26 € au total ». Les onze autres tirets des textes affichés du checkout, des emails
et de la facture ont été traités : « Livraison : {mode} » (écran, ligne Stripe, email,
facture), « Utiliser mon avoir : », « Stock insuffisant : », « Crédit boutique
Goriki : », « PAIEMENT SÉCURISÉ · REDIRECTION », et le pied de facture
« Goriki · Tanuki Corporation ». Au passage, un tiret servait de valeur au forfait
quand aucun devis n'était encore chargé — remplacé par « à calculer », la règle posée
sur la want list valant ici aussi. Vérification finale : **0 tiret cadratin** dans les
textes affichés de ce périmètre. Celui de `PanierClient` (« Les belles pièces partent
vite — jetez un œil… ») est hors périmètre annoncé, laissé tel quel.

`tsc` 0 · `build` 0 · `npm test` 24/24 · lint 18 problèmes (inchangé).

Base rendue à l'état trouvé : poids du booster à NULL, stock à 36, comptes de test
supprimés, 22 tarifs actifs. **La commande annulée de 20 h 42 est celle du
propriétaire** (compte `8c67c06e…`, « Lettre simple bpost », 4,31 €) : laissée intacte.

**Signalements.**
- **La clé publique Sendcloud circule en clair** dans le bundle et dans l'URL de
  l'iframe. C'est le fonctionnement prévu de cette clé, mais elle est donc publique :
  ne jamais y mettre la valeur de la clé secrète, même « temporairement ».
- **Le picker propose Locker, Bureau de poste et Dépôt transporteur** en plus des
  points relais, parce qu'aucun filtre de type n'est passé. Un client peut donc choisir
  un locker sur une option facturée « point relais ». À trancher : restreindre via
  `shopType`, ou l'accepter si Sendcloud facture pareil.
- La sélection réelle par clic dans la carte n'a pas pu être automatisée (Mapbox +
  headless). Un essai manuel de bout en bout reste souhaitable avant ouverture.

### Session 54 — 2026-09-27 (ZARA mission 3 — expédition depuis l'admin)

**Aucune migration.** Les colonnes viennent de 0055.

**Préalable : la carte des points relais ne se filtre PAS.** Le script expose un
`shopType`, recopié en `shop-type` dans l'URL de l'iframe, mais **aucune valeur ne
fonctionne** : mesuré sur `servicepoint`, `SERVICEPOINT`, `parcelshop`, `pickup`,
`shop`, `store`, la carte se vide (« No service point in this area ») alors que sans
le paramètre elle rend 131 points. Le filtre « Point relais » de leur propre interface
agit côté client, sur un appel interne (`shop_type=servicepoint`) que l'embarqué
n'expose pas. Constaté en interrogeant leur API depuis l'iframe : le champ normalisé
est **`general_shop_type`**, et il vaut `servicepoint` pour un relais classique
(`shop_type` seul rend des codes transporteur : « 1 », « C »).

Le refus est donc posé là où il tient : **liste blanche** sur `general_shop_type`, à la
sélection ET dans `/api/stripe/checkout`. Un type inconnu est refusé comme un casier —
une liste noire laisserait passer le prochain type que Sendcloud ajoutera. L'écran
prévient d'avance que la carte montre aussi des casiers et qu'ils seront refusés.

**Sendcloud : quatre surprises, toutes mesurées, aucune devinée.**

1. **La v2 ne crée plus rien sur ce compte** : « Creating parcels via API v2 is not
   available for this account. Please use API v3. »
2. **La v3 n'a pas de `/parcels`** (404). Le seul chemin qui répond est
   **`POST /api/v3/shipments`**, avec quatre champs racine obligatoires.
3. **`from_address` veut un `sender_address_id` et RIEN d'autre** — « Provide either
   sender_address_id or address fields, not both », et `country_code` compte comme un
   champ d'adresse. C'est cohérent avec la consigne : l'adresse d'expédition reste
   configurée dans le panneau Sendcloud, lue via `/user/addresses/sender`.
4. **Nos codes de grille portent un segment que la v3 n'utilise plus** :
   `mondial_relay:service_point,dualapi/size=l,kg=0-0.25,c2c` contre
   `…/size=l,c2c`. La tranche de poids a quitté le code pour passer dans le corps.
   D'où `normaliserCode()`, qui retire les segments `kg=` des deux côtés avant de
   comparer — puis VÉRIFIE que le code figure dans les options réellement proposées.

**Deux identifiants, et c'est le colis qu'il faut retenir.** L'envoi porte un UUID, le
COLIS un identifiant numérique — et c'est celui-là que l'annulation et l'étiquette
attendent. Le garder en `Number()` donnait `NaN`, puis « Not Found » à l'annulation.
La colonne s'appelle `sendcloud_parcel_id` : elle porte désormais ce qu'elle annonce.

**Le suivi et l'étiquette n'existent pas dans la réponse de création.** Mesuré : elle
rend `tracking_number` vide et aucun `documents`, alors qu'une relecture de l'envoi une
seconde plus tard les montre tous deux. Sans cette relecture (4 essais espacés de
900 ms), la commande gardait une étiquette introuvable et un suivi vide — une
expédition inutilisable. L'étiquette n'est d'ailleurs pas un champ mais un DOCUMENT du
colis, dans `documents[]`, repéré par `type: 'label'`.

**Le PDF passe par le serveur.** Le lien Sendcloud exige l'authentification : donné au
navigateur il rend 401, signé dans l'URL il exposerait les clés.
`GET /api/admin/expedition?id=…` le récupère et le relaie. Vérifié : **HTTP 200,
`application/pdf`, 1 245 octets, signature `%PDF-`**.

**Étiquettes d'essai créées et leur annulation** — toutes sur la seule méthode gratuite
`sendcloud:letter` (Unstamped letter), aucune méthode payante touchée :

| colis | suivi | état final |
|---|---|---|
| 719189950 | SCCWF3P9QYTT | Cancellation requested |
| 719190366 | SCCWF3P9QYT7 | Cancellation requested |
| 719191836 | SCCWF3P9QY3C | Cancellation requested |
| 719192138 | SCCWF3P9QY3Q | Cancellation requested |

Les deux premières étaient **orphelines** : créées chez Sendcloud avant que le code ne
sache lire l'identifiant, donc jamais enregistrées chez nous. C'est ce qui a motivé
`colisParReference()` et le mode `?orphelines=<référence>` : sans lui, une étiquette
créée puis perdue entre deux écritures resterait facturée sans que rien ne la signale.

**Gardes serveur, toutes vérifiées** : commande inexistante **404** · action inconnue
**400** · annuler sans étiquette **400** · commande « pending » **400** (« une étiquette
ne se crée que sur une commande payée ») · doublon **409** · point relais exigé et
absent **400**. Aucune erreur Sendcloud n'est avalée : le message remonte tel quel, avec
son POINTEUR de champ (« /from_address/… : Field required »), sans quoi « Field
required » huit fois de suite ne dit rien.

**Lettre simple** : aucun appel Sendcloud, l'écran rend l'adresse formatée prête à
recopier et le rappel « Lettre à timbrer, non suivie ». Vérifié au rendu. Au passage,
l'adresse n'est plus affichée en JSON brut sur la fiche.

**Email d'expédition** : deux déclencheurs désormais, la première saisie d'un numéro de
suivi ET le passage en « shipped ». Sans le second, un client servi par lettre n'était
jamais prévenu. Le gabarit dit « Cet envoi part en lettre simple : il ne comporte pas
de numéro de suivi » plutôt que d'afficher un bloc vide.

**Tirets cadratins** : zéro dans les textes affichés de la fiche, des emails, de la
facture et des messages d'erreur. Les objets d'email en portaient encore trois.

`tsc` 0 · `build` exit 0 · `npm test` 24/24 · lint **17 problèmes**, deux de moins que
la ligne de base de la session 49.

Base rendue à l'état trouvé : commande et tarif d'essai supprimés, poids du booster à
NULL, comptes de test supprimés, 22 tarifs actifs. La commande annulée du propriétaire
est intacte.

**Signalements.**
- **Un envoi créé chez Sendcloud mais non enregistré reste facturé.** La route le dit
  désormais dans son message d'erreur, avec l'identifiant du colis, et
  `?orphelines=<référence>` permet de les retrouver. Il n'y a PAS de rattrapage
  automatique : ce serait une suppression décidée par la machine.
- **L'annulation est asynchrone** : Sendcloud répond « Parcel cancellation has been
  queued » et le colis passe en « Cancellation requested ». Il faudra vérifier au
  panneau que les quatre essais sont bien passés en « Cancelled ».
- **Le mode `?methodes=1` / `?produits=1` / `?options=1` de la route** est conservé :
  quand `resoudreOption` échoue, son message invite à vérifier le compte, et ces
  lectures sont le moyen de le faire sans ouvrir le panneau Sendcloud.
- **La sélection réelle d'un point relais par clic dans la carte** reste non
  automatisée (Mapbox en headless). La couture a été exercée par le vrai message
  `servicePointSelected` émis depuis l'iframe (session 53).

### Session 55 — 2026-09-27 (ZARA — minimum de commande et forfait à zéro)

**Migration 0056** : `shipping_settings.min_order_value`, défaut 1,00 €. Le réglage
rejoint les autres plutôt qu'une constante : `MIN_ORDER_AMOUNT` avait justement été
supprimé de `lib/constants.ts` en mission 2 pour qu'un chiffre commercial n'exige plus
de redéploiement. Versionnée et **byte-exacte** (`f341aa10…`, 1 177 o).

**Le minimum porte sur les ARTICLES.** Un panier de 0,90 € accompagné de 1,63 € de port
ne le franchit pas : ce qui est visé est la taille de la commande, pas le montant
encaissé. Un test le verrouille explicitement.

**Le calcul reste à un seul endroit.** Le devis lisait déjà le panier valorisé ET les
réglages ; il rend désormais `minimumCommande` et `minimumAtteint`. Une seconde lecture
ailleurs aurait pu diverger. Les options restent calculées sous le minimum : le client
doit voir ce que sa commande coûterait, c'est le PAIEMENT qui est bloqué.

**Trois barrières, indépendantes.** Le panier bloque le lien vers le checkout, le
checkout désarme « Payer », et `/api/stripe/checkout` refuse en 400. La dernière est
la seule qui compte : les deux premières ne font qu'expliquer avant le clic.

**Le panier savait rien de la base** : il vit en `sessionStorage`. `app/panier/page.tsx`
lit maintenant le réglage côté serveur et le passe. Annoncer le minimum dès le panier
évite la découverte au dernier écran, une fois l'adresse saisie.

**Forfait à zéro : il disparaît, il ne s'affiche pas à 0,00 €.** Mention sous les
options, ligne du récapitulatif, ligne de l'email, ligne de la facture — toutes
conditionnées à `> 0`. Et **aucune ligne à 0 € n'est envoyée à Stripe** : la garde vaut
pour le forfait comme pour le port. Remettre le forfait au-dessus de zéro fait tout
réapparaître, sans autre intervention.

**Affranchissement sur la fiche commande**, selon le tarif : `letter_be_norm` →
« 1 timbre Non Prior (lettre normalisée, 5 mm max) » · `letter_be` →
« Affranchissement non normalisé (3,26 €) » · autres pays → le prix du tarif. Les deux
lettres belges ne s'affranchissent pas pareil, et une erreur de timbre fait revenir le
colis.

**Vérifié en conditions réelles**, requêtes forgées comprises :

| contrôle | résultat |
|---|---|
| devis 5 cartes BE (31 g) | `letter_be_norm` à **1,63 €**, `totalLivraison` = port, sans forfait |
| devis à 0,90 € pile | `minimumAtteint: false`, options tout de même rendues |
| paiement à **0,90 € pile** | **400** « Minimum de commande : 1,00 € d'articles. Il manque 0,10 € » |
| paiement à **1,00 € pile** | **200** — la borne est inclusive |
| page Stripe | **deux lignes** : « Article 10,00 € » et « Livraison : Lettre simple bpost 1,63 € », total 11,63 €. Aucune mention de préparation |
| panier à 0,20 € | message affiché, « Passer commande » devient inerte (`aria-disabled`) |
| panier à 10 € | message absent, le lien redevient un lien |
| checkout | aucune mention « de préparation », aucune ligne forfait au récapitulatif |
| écran admin | champ « Minimum de commande (€) » présent, aller-retour 1,00 → 2,50 → 1,00 enregistré |

**Un défaut trouvé en mesurant plutôt qu'en regardant.** Le message rendait
« 1,00 €d'articles », sans espace : JSX avale l'espace qui suit une expression en fin
de segment. Constaté au code de caractère, pas à l'œil. Les deux phrases sont
désormais assemblées dans une seule expression, où la règle ne s'applique pas.

**Tirets cadratins** : zéro dans le panier, le checkout, la fiche, les emails et la
facture. Le dernier vivait dans le pied de page du site, visible sur le checkout.

`tsc` 0 · `build` exit 0 · `npm test` **31/31** · lint 18 problèmes, **aucun dans les
fichiers de ce brief** (vérifié fichier par fichier) ; le seul de `CheckoutClient` est
le `setHydrated` d'hydratation, protégé par son commentaire depuis la mission 02.

Base rendue à l'état trouvé : 4 commandes d'essai libérées, poids du booster à NULL,
stock à 36, comptes de test supprimés, réglages `1.00 / 0.00 / 3 g / 16 g`, 23 tarifs
actifs. La commande annulée du propriétaire est intacte.

**Signalements.**
- **Une sonde mal écrite a failli me faire conclure trop vite** : mon test « aucune
  ligne à 0 € » cherchait `0,00 €`, motif contenu dans « 10,00 € ». C'est la capture
  d'écran de la page Stripe qui a tranché, pas la regex.
- **`letter_be` et `letter_be_norm` partagent transporteur et nature** : la règle « la
  moins chère par couple » élit donc la normalisée jusqu'à 50 g, puis bascule sur
  l'autre. C'est le comportement voulu, mais il rend `letter_be` invisible sous 50 g.
- Le minimum **n'est pas appliqué au rachat ni au dépôt-vente** : il ne concerne que la
  vente. À confirmer si ces parcours doivent en avoir un.

### Session 56 — 2026-09-27 (MILO — pages légales et périmètre du lancement)

**Aucune migration.**

**Recherche d'outils de suivi : AUCUN.** Cherché sur les noms (Google Analytics, gtag,
GTM, Vercel Analytics, Plausible, Fathom, Matomo, Umami, PostHog, Hotjar, Mixpanel,
Segment, Meta Pixel, Clarity, Amplitude, Sentry, Datadog), sur les dépendances, sur les
balises `<script>` et sur tous les domaines externes référencés dans le code. Les deux
seules occurrences étaient des faux positifs : le mot « plausible » dans un commentaire
français, et « amplitude » comme paramètre de rotation dans `lib/rarity.ts`. La phrase
« [À CONFIRMER…] » a donc été retirée de `confidentialite.md`, comme prévu.

Les seuls domaines tiers chargés sont fonctionnels : TCGdex, Cloudinary, Poneglyphe,
Stripe (liens du back-office) et `embed.sendcloud.sc` — ce dernier étant un script
tiers, chargé uniquement au clic sur « Choisir un point relais ». La politique le
mentionne déjà comme prestataire.

**Markdown : `react-markdown` + `remark-gfm`**, ajoutés après votre arbitrage. Rendu par
table de composants, jamais par `dangerouslySetInnerHTML` : aucune surface d'injection,
et chaque balise reçoit les classes du design system plutôt qu'une feuille descendante
qu'un utilitaire Tailwind pourrait élaguer (piège de cascade de CLAUDE.md).

**`LEGAL_UPDATED_AT` est une date FIGÉE**, pas `new Date()`. Sans quoi « Dernière mise à
jour » afficherait le jour de la visite et le document prétendrait avoir été revu ce
matin. Le marqueur reste dans les `.md` et la substitution se fait au rendu : une date
recopiée dans quatre fichiers finirait par en contredire trois.

**Un registre unique** (`PAGES_LEGALES`) sert les quatre pages, le pied de page ET le
sitemap. Une liste recopiée à trois endroits survit à une page renommée.

**Les `.md` doivent être embarqués au déploiement** : `outputFileTracingIncludes` les
déclare dans `next.config.ts`. Le chemin est dynamique, donc invisible pour l'analyse
statique de Next — sans cette déclaration, les pages auraient fonctionné en local et
échoué en ligne.

**Rendu mobile mesuré, pas supposé.** À 390 px, la page ne défile pas horizontalement.
Les deux tableaux de la politique faisaient d'abord 420 px dans un conteneur à
débordement : ils défilaient seuls, mais la colonne « Base légale » se coupait au bord
sans aucun indice, et on lisait une base légale tronquée sans le savoir. Largeur
minimale ramenée à 340 px et cellules resserrées sous `sm` : le tableau tient
désormais ENTIER (350 px mesurés dans 390), plus aucun débordement, ni page ni
conteneur.

**Fermeture du rachat et du dépôt-vente.** Interrupteur unique dans
`lib/fonctionnalites.ts` : `RACHAT_OUVERT` et `DEPOT_VENTE_OUVERT`, à `false`. Constante
et non réglage en base, volontairement : ouvrir une fonction demande d'avoir relu son
parcours, ses emails et les pages légales qui la décrivent. Un interrupteur en base
inviterait à le basculer un soir sans ce travail.

Fermé à DEUX endroits, la page et le serveur. Vérifié : `/rachat` et `/depot-vente`
rendent « Bientôt disponible » avec **zéro champ dans `<main>`**, les entrées de
navigation restent visibles, `/compte/rachat` et `/compte/depot-vente` affichent le
message dans la coquille du compte, et `POST /api/rachat` comme `POST /api/compte/rachat`
répondent **503** avant toute lecture du corps. 503 et non 403 : la fonction n'est pas
interdite à ce client, elle n'est pas encore ouverte.

**Aucun code ni aucune donnée supprimés** : les pages gardent tout leur contenu sous la
garde, et la base ne portait de toute façon ni demande de rachat ni dépôt (0 et 0).

**Adresse de contact** remplacée dans la facture, `BULK_CONTACT_EMAIL` et `REPLY_TO`.
`REPLY_TO` était **exporté sans être branché** : un client qui répondait à un email de
commande écrivait à `noreply@`, c'est-à-dire à personne. Les trois envois le posent
maintenant en `replyTo`. L'expéditeur `noreply@goriki.be` est inchangé.

**Facture** : identité complète du vendeur (Tanuki Corporation SRL, siège, BCE), mention
« Régime particulier de franchise des petites entreprises, TVA non applicable » à la
place de l'article 283 du CGI — qui était du droit FRANÇAIS sur une facture belge, signalé
à l'audit de la session 48 — et « Total » au lieu de « Total TTC », qui n'a pas de sens
sans TVA applicable.

`tsc` 0 · `build` exit 0 · `npm test` 31/31 · lint 18 problèmes, **aucun dans les
fichiers de ce brief**. Les quatre pages légales sont **prérendues en statique**.

Base rendue à l'état trouvé : compte de test supprimé, aucune donnée touchée.

**Signalements.**
- **`npm audit` remonte 11 vulnérabilités, toutes PRÉEXISTANTES** : `exceljs` (devDep) et
  sa dépendance `uuid`, plus `next`, `sharp`, `postcss`, `nanoid`. Ni `react-markdown` ni
  `remark-gfm` n'y figurent, vérifié. `npm audit fix --force` rétrograderait `exceljs`
  en version majeure inférieure : à traiter séparément, pas au détour de ce brief.
- **`SITE_DESCRIPTION` porte encore un tiret cadratin** (`lib/constants.ts`), affiché
  dans la balise description de chaque page. Hors périmètre, non modifié.
- **`/depot-vente` était une vitrine de vente**, listant les pièces en dépôt avec un CTA
  « Déposer mes cartes ». La fermer masque donc aussi ce rayon. Sans conséquence
  aujourd'hui (0 pièce en dépôt), mais à savoir si des dépôts existaient.
- **Le dépôt-vente n'a aucune route de création** : rien à fermer côté serveur, seules
  les deux pages l'étaient. La garde `DEPOT_VENTE_OUVERT` est en place pour le jour où
  une route existera.
- **La facture n'a pas été régénérée en PDF** : aucune commande payée en base pour le
  faire. Les trois changements sont textuels et le build passe, mais un rendu réel
  reste à faire à la première vraie commande.

### Session 57 - 2026-09-27 (NOVA : image du hero et fond des pages neutres)

**Aucune migration.**

**Une seule source pour « quelle route porte quel fond » : `lib/fond.ts`.** Trois couches
lisaient jusqu'ici la même règle recopiée : le layout Pokémon, le layout One Piece et
`AtmosphereLayer`, dont les commentaires insistaient déjà sur le fait que leurs préfixes
devaient rester identiques. Un quatrième fond arrivant, la recopie serait devenue
intenable. `natureDuFond(pathname)` répond `univers`, `neutre`, `aucun` ou `fiche`, et les
deux couches globales en découlent. Ajouter une page neutre ne demande plus rien, ajouter
un rayon d'univers demande une ligne, à un seul endroit.

**Le wallpaper bascule en CSS, jamais en JavaScript.** `.fond-neutre` porte la version
portrait, une media query à `64rem` (le point `lg`, seul point de bascule du design
system : 196 usages contre 2 pour `md`) la remplace par la version large. Vérifié au
rendu : à 390 px le navigateur ne télécharge que `wallpaper-mobile.webp`, à 1440 px que
`wallpaper.webp`. Un composant qui aurait mesuré la fenêtre aurait chargé la mauvaise
image le temps de l'hydratation, voire les deux.

**Le voile a deux intensités, et un critère.** 0,42 partout, 0,74 sur les écrans qu'on
vient LIRE (pages légales, compte, panier), liste tenue dans `fondDense()`. Le critère
n'est pas esthétique : le voile ne doit jamais faire descendre le contraste d'un texte en
dessous de ce qu'il vaut sur le parchemin nu. C'est ce qui fixe aussi le bas du voile du
hero à 0,93, valeur à laquelle un `text-ink-55` retrouve exactement son rapport habituel.

**Le canvas d'atmosphère perd son rôle de fond.** Il peignait sa cartographie à 72 %
d'opacité sur une vingtaine d'écrans. Il ne reste que sur l'accueil, invisible au repos,
pour le seul morph de transition vers un univers, comme demandé. Effet de bord bienvenu :
la boucle `requestAnimationFrame` ne tourne plus que sur une page au lieu de vingt.

**Le hero est un panorama, il ne pouvait pas tenir dans une demi-colonne.** Le visuel
précédent était l'éventail de cartes de `NouveautesHero`, dans la colonne droite.
L'illustration fournie est une scène large 1672 x 941 : recadrée à 700 px elle perdait son
sujet. Elle occupe donc tout le panneau, le manifeste passe au-dessus à gauche, et le
voile est DIRECTIONNEL sur grand écran (0,88 à gauche, 0,02 à droite) : le texte garde son
contraste, la cité flottante reste pleinement visible là où il n'y a rien à lire.

**Un rognage mesuré, pas supposé.** À 390 px, la troisième ligne du manifeste mesure
331 px, pour 350 px de contenu utile. La gouttière de page et le padding du panneau se
seraient cumulés et le titre aurait été coupé, silencieusement, puisque le panneau est en
`overflow: hidden`. Le panneau sort donc de la gouttière sous 1024 px et la rétablit
lui-même : le texte retrouve exactement la largeur qu'il avait, et l'illustration passe
bord à bord. Mesuré à 360, 390, 430 et 768 px : plus aucun débord, y compris à 360 où
l'ancienne composition débordait déjà de 11 px.

**Sur écran étroit, le voile réserve une bande haute à découvert** (rampe en PIXELS et non
en pourcentages : la hauteur du panneau dépend du texte, une rampe relative se décalerait
d'un écran à l'autre). Sans elle, l'illustration disparaissait entièrement sous le voile,
puisque le texte occupe toute la largeur.

**`NouveautesHero` quitte le hero et reprend sa place juste en dessous.** L'illustration
l'a délogé de la colonne droite ; le propriétaire a demandé, dans la foulée, de le
remonter en section propre. Il vit donc sous le hero, avec ses quatre requêtes d'origine
restituées telles quelles (les 2 sets les plus récents de chaque univers, et leur stock
réel). Aucun encadré : la composition pose ses cartes dans l'espace, c'est la règle de
traitement produit de la planche, et un filet `.hair` suffit à séparer la section du hero.

Aucun recadrage non plus, contrairement à ce que je pensais devoir poser : l'éventail se
resserre déjà tout seul sous 1024 px (`--eventail` à 0,58, largeurs clampées en vw).
Mesuré cartes inclinées comprises à 360, 390, 430 et 1440 px, il tient dans la gouttière,
et `document.scrollWidth` reste égal à la fenêtre. Un `overflow` n'aurait rien coupé et
aurait rogné les ombres portées.

**Poids des images.** Originaux laissés dans `docs/design-reference/`, qui n'est pas
servi ; `public/` créé à la racine.

| Servi | Source | Dimensions | Avant | Après | Gain |
|---|---|---|---|---|---|
| `hero.webp` | `Hero.png` | 1672 x 941 | 3 388 853 o | 583 072 o | 83 % |
| `wallpaper.webp` | `wallpaper.png.png` | 1672 x 940 | 2 891 371 o | 205 926 o | 93 % |
| `wallpaper-mobile.webp` | `wallpaper-mobile.png.png` | 1024 x 1536 | 3 157 845 o | 214 540 o | 93 % |

Ce que le visiteur télécharge réellement est plus bas encore pour le hero, qui passe par
`next/image` : 53 338 o à 390 px, 170 433 o à 1440 px. `sizes` est plafonné à 1200 px
au-delà de `lg` et non à la largeur réelle du panneau (1328 px à 1440) : la source ne fait
que 1672 px, demander le palier supérieur aurait fait AGRANDIR l'image par l'optimiseur,
pour un fichier plus lourd et aucun détail de plus.

AVIF produit puis écarté : 177 Ko et 185 Ko, soit 12 % de moins que le WebP. Pas de quoi
maintenir deux formats et une règle `image-set`.

`tsc` 0 · `build` exit 0 · lint 18 problèmes, **aucun dans les fichiers de ce brief**
(baseline inchangée).

**Signalements.**
- **`NouveautesHero` porte encore le mot « hero » dans son nom et dans son en-tête**
  (« colonne droite du hero »), alors qu'il vit maintenant sous le hero. Renommage hors
  périmètre, non fait : à traiter dans une passe de nettoyage.
- **Un set sans aperçu laisse la vitrine vide.** Sur les quatre sets mis en avant
  aujourd'hui, `30TH-C` n'a aucun visuel en base : quand le défilement tombe sur lui, la
  scène de 560 px n'affiche que le cartouche de texte, sans une seule carte. Le composant
  n'a pas d'état de repli pour ce cas, seulement pour « aucun set du tout ». Défaut
  préexistant, révélé par la mesure, hors périmètre de ce brief.
- **Le gradient radial du body est masqué sur les pages neutres** : le wallpaper est opaque
  et passe devant. Il reste seul visible sur les pages d'univers et le checkout. Aucun
  code retiré, la règle est intacte.
- **Sous 1024 px, l'illustration du hero est très retenue.** Le texte occupe toute la
  largeur : au-delà de la bande haute, le voile doit rester fort pour que les libellés de
  11 px gardent leur contraste. C'est l'arbitrage lisibilité contre illustration, tranché
  du côté de la lisibilité comme le demandait le brief.

### Session 58 - 2026-09-27 (NOVA : Nouveautés de retour dans le hero)

**Constat du propriétaire.** Remonté en section séparée sous le hero (session 57),
l'éventail de `NouveautesHero` perdait sa mise en scène. Il revient dans le hero.

**Section séparée supprimée**, avec tout ce qu'elle portait : le titre « Nouveautés », le
compteur « N sets récents », le lien « Voir tout → » et le filet `.hair`. Dans le hero,
seul le badge « Nouveau » du cartouche signale la vitrine.

**Composition du panneau illustré** (`app/page.tsx`). `Hero.png` reste le fond de tout le
panneau. Le panneau passe en `flex-col lg:flex-row` : texte, boutons et garanties dans la
moitié gauche (`lg:w-[46%]`), éventail dans la moitié droite, par-dessus l'illustration.
Sous 1024 px, l'éventail passe sous le texte, dans le même panneau.

**Voile du texte déplacé, pas modifié.** À partir de 1024 px, `.voile-hero` couvre tout le
panneau comme avant (voile directionnel). En dessous, il est porté par la colonne de texte
seule, sinon sa partie à 0,93 aurait recouvert l'éventail. Ses arrêts se calculent sur la
même hauteur qu'avant : le texte garde exactement son contraste.

**`.voile-nouveautes` ajouté** (`styles/globals.css`), léger par principe :
- à partir de 1024 px, une ellipse de 300 x 140 px centrée sur le cartouche (0,78 au
  centre, 0 au bord) ; le reste de la moitié droite ne reçoit que le voile directionnel,
  presque transparent de ce côté ;
- sous 1024 px, une rampe haute de 0,93 à 0 sur 180 px, qui prolonge le voile du texte
  sans marche nette, et une rampe basse de 0,80 à 0 sur 250 px derrière le cartouche et
  la navigation.
Arrêts en pixels depuis le bas : la hauteur de la zone varie, celle du cartouche non.

**Écartement de l'éventail** (`NouveautesHero.tsx`) : `--eventail` à 0,6 entre 1024 et
1279 px, 1 à partir de `xl`. À 1024 px la moitié droite ne fait qu'environ 490 px : à 1, la
carte de droite arrivait à 3 px du bord du panneau. À 0,6 : 20 px de marge côté bord, 21 px
côté texte. `lg:min-h` de la scène ramené de 560 à 520 px.

**Mesuré** (build de production, Chromium) : à 1440 px, panneau de 628 px, cartes entre
x = 715 et 1302 dans un panneau de 96 à 1344 ; à 390 px, panneau bord à bord de 1060 px,
cartes entre x = 15 et 378. `scrollWidth` égal à la fenêtre à 360, 390, 1024 et 1440 px.

`tsc` 0 · `build` exit 0 · lint 18 problèmes, aucun dans les fichiers de ce brief (baseline
inchangée).

**Signalement levé** : `NouveautesHero` vit de nouveau dans le hero, son nom redevient exact.

### Session 59 - 2026-09-27 (ZARA : annonces non chiffrées, masquage et garde-fou 0 €)

**Aucune migration.** Aucune donnée modifiée : l'arbitrage du propriétaire est de masquer
par le code, pas de toucher aux lignes. La base a été rendue exactement dans l'état trouvé,
distribution recomptée (937 / 839 / 1533 / 108).

**Deux affirmations du brief étaient fausses, vérifiées en base avant de coder.**
- `pokemon_listings.price` est **NOT NULL, défaut 0**. Aucune annonce Pokémon n'a de prix
  NULL et il ne peut pas y en avoir. « Pas chiffré » s'y dit 0, exactement comme en One
  Piece. La règle est donc unique pour les deux univers, et non deux règles jumelles.
- Le brief supposait les annonces non chiffrées masquées. **108 annonces Pokémon étaient EN
  LIGNE, en stock, à 0 €** : visibles dans la grille du catalogue, ajoutables au panier, et
  payables dès qu'un autre article portait le panier au-dessus du minimum de commande.
  C'était le vrai trou, et il n'était pas dans le brief.

**Une règle, un fichier : `lib/annonces.ts`.** `estChiffre`, `estVendable`,
`doitRepasserEnVente`, plus le libellé de refus. La règle « 0 n'est pas un prix » vivait
déjà à sept endroits avec sept formulations ; un huitième lecteur, la grille du catalogue,
l'avait oubliée. 15 tests unitaires (`lib/annonces.test.ts`), 46 au total dans le projet.

**Remise en vente automatique : un seul point d'écriture.** Les trois écrans de saisie
(édition en ligne, application à une sélection, fiche d'annonce) passent tous par
`PATCH /api/listings`. La règle y est posée une fois, avec une relecture de l'état AVANT
en une requête `in` pour toute la sauvegarde. Aucun des trois écrans ne peut l'oublier, et
aucun n'a eu à être modifié.

**Distinguer le masquage « faute de prix » d'un autre : arbitrage du propriétaire.** Aucune
colonne n'enregistre la raison d'un masquage. Mesuré au moment de la décision : sur les 937
annonces masquées, 937 répondaient à la signature (masquée + 0 € + stock), et aucune
annonce masquée ne portait de prix. Le propriétaire a tranché pour la combinaison, sans
migration. Risque résiduel assumé, à connaître : une annonce masquée délibérément pour une
autre raison et pas encore chiffrée se rallumera quand on la chiffrera.

**Un garde-fou que j'avais écrit ne servait à rien, le test l'a montré.** J'avais ajouté un
paramètre `visibiliteTouchee` pour qu'un `is_active: false` explicite l'emporte sur
l'automatisme. La vérification a rallumé l'annonce quand même, et c'était juste : la fiche
d'annonce renvoie TOUJOURS la valeur courante, donc `false` sur une annonce masquée, sans
que personne ait touché la case. La respecter aurait désactivé l'automatisme précisément là
où le brief le demande. Dans l'autre sens, un `true` explicite donne déjà le même résultat.
Le paramètre ne pouvait jamais changer l'issue : branche morte déguisée en garde-fou,
retirée.

Conséquence assumée : chiffrer une annonce masquée la met en vente. Pour la chiffrer en la
gardant masquée, il faut décocher « actif » et enregistrer une seconde fois.

**Garde-fou serveur, deux routes.** `POST /api/cart` et `POST /api/stripe/checkout`
refusent toute ligne non chiffrée, avec un message explicite plutôt qu'un retrait
silencieux. Vérifié en forçant la requête, session ouverte, adresse complète, CGV
acceptées : le prix envoyé par le client est ignoré, la route relit la base.

**Côté boutique.** `/api/catalogue` était la SEULE requête publique sans filtre de prix :
la page d'accueil, les séries, le détail d'un set, la recherche et la want list le
portaient déjà. Ajouté pour les trois branches (Pokémon, One Piece, scellés). Le bouton
d'ajout au panier traite désormais l'absence de prix comme une rupture, au lieu d'afficher
« Ajouter au panier » sous un prix qui disait « Épuisé ». Et la tuile de set n'affiche plus
de tiret à la place d'un prix.

**Filtre de saisie.** Le filtre du set disait « Sans prix » et filtrait `prix <= 0`, pendant
que le compteur juste à côté comptait `stock > 0 et prix <= 0` : deux définitions pour un
seul mot. Sans conséquence en Pokémon, où toutes les annonces ont du stock ; en One Piece,
839 annonces sans stock ni prix noyaient les 937 à traiter. Le filtre s'appelle maintenant
« En stock sans prix », porte son compte, et ce compte est calculé sur TOUT le set et pas
sur les lignes affichées, pour ne pas fondre au moment où on clique dessus. Le tableau de
bord, qui ne comptait que Pokémon, porte les deux univers.

**Vérifications, toutes au rendu.**
- One Piece masquée à 0 € : fiche « Produit introuvable », ajout au panier refusé, y
  compris en forçant un prix de 2,50 € dans la requête.
- Prix saisi à 2,50 € dans l'admin : `is_active` passe à `true`, la fiche propose l'ajout,
  le panier accepte.
- Pokémon en ligne à 0 € : « Carapuce n'est pas encore en vente » au panier ET au paiement.
  Masquée puis chiffrée : remise en vente, achetable.
- Grille Pokémon : 1 641 variantes avant, **1 533 après**, soit exactement les 108.
- Set PRB01 : 166 annonces, filtre « En stock sans prix · 122 », 122 affichées.
- Tableau de bord : « Prix à saisir · Pokémon 108 » et « Prix à saisir · One Piece 937 ».

`tsc` 0 · `build` exit 0 · `npm test` 46/46 · lint 18 problèmes, **aucun dans les fichiers
de ce brief**. Compte admin de test supprimé, base recomptée à l'identique.

**Signalements.**
- **Une fiche produit introuvable répond HTTP 200**, avec le titre « Produit introuvable ».
  Le visiteur voit la bonne page, mais un moteur d'indexation la prend pour une page
  valide. Préexistant, hors périmètre.
- **Un administrateur connecté voit la boutique autrement qu'un client** : la policy RLS
  d'admin est un `ALL` sans condition, donc il lit aussi les annonces masquées. Les filtres
  applicatifs ajoutés ici le couvrent pour le prix, pas pour `is_active` partout.
- **839 annonces One Piece sont actives, sans stock et sans prix.** Invisibles en boutique
  (stock nul) et hors des files de saisie, qui exigent du stock. À savoir si elles doivent
  un jour recevoir du stock : elles apparaîtront alors d'un coup dans la file.
- **Les 108 annonces Pokémon restent en base telles quelles**, actives à 0 €, masquées par
  le seul code. Elles reviendront d'elles-mêmes en boutique dès qu'un prix sera saisi, sans
  passer par la remise en vente automatique puisqu'elles ne sont pas masquées.

### Session 60 - 2026-09-27 (ZARA : 30ᵉ Anniversaire affiché comme un seul set)

**Constat.** TCGdex découpe le 30ᵉ Anniversaire en 30TH (161 cartes) et 30TH-C, la
Collection Classique (30 cartes). Commercialement, un seul produit de 191 cartes. Les deux
lignes restent séparées en base : l'import upserte sur `code` et recréerait 30TH-C.

**Mécanisme générique : `display_parent_id`** (migration 0057, sur `pokemon_sets` ET
`onepiece_sets`). NULL = set affiché pour lui-même ; un uuid = set affiché dans son parent,
en fin de liste. Un seul niveau, garanti par le trigger `sets_rattachement_un_niveau`.
Déclarer un nouveau cas ne demande aucun code :
`update pokemon_sets set display_parent_id = (select id from pokemon_sets where code = 'PARENT') where code = 'ENFANT';`
L'import ne touche pas cette colonne (`upsertSet` ne l'envoie pas). Helpers dans
`lib/catalogue/rattachements.ts`.

**Boutique.**
- Page du set (`SetDetail`) : cartes du groupe entier, celles de chaque rattaché en fin de
  liste quel que soit le tri, sous un intertitre (nom, code, nombre de cartes). La fiche
  compte le groupe : 191 cartes. Rareté, versions, stock : sur le groupe.
- Anciennes URL d'un rattaché : `permanentRedirect` vers le parent, paramètres conservés.
  La page streame (`loading.tsx`) : Next répond 200 avec un `meta refresh` à 0 s, puis
  redirige côté client. Vérifié : arrivée sur la page de 30TH.
- Listes de sets (`getSeriesByEra`) : le rattaché disparaît, son stock et son nombre de
  cartes s'ajoutent au parent (tuile « 191 cartes »).
- Recherche (`search_catalogue`, réécrite dans 0057) : un set rattaché trouvé renvoie son
  parent, la déduplication n'en garde qu'une entrée (« classique » et « anniversaire »
  donnent tous deux « 30ᵉ Anniversaire »). Une carte de 30TH-C mène à la page de 30TH ;
  son code et son numéro restent ceux imprimés (30TH-C 001).
- Vitrine Nouveautés : les rattachés n'ont plus d'entrée (30TH puis ME05, au lieu de 30TH
  puis 30TH-C). Stock compté sur le groupe.
- Compteur de sets de `/catalogue`, sitemap : rattachés exclus.
- Fiche produit : fil d'ariane et « Voir les N cartes » pointent sur le parent, N = groupe.
- Rachat : une seule entrée ; les cartes du rattaché suivent, préfixées de leur code, et
  la ligne du lot garde le code RÉEL (30TH-C) pour l'inspection.

**Admin.** Les deux sets restent séparés. Mention en ligne (« ↳ rattaché à 30TH »,
« + 30TH-C ») et bloc « Affichage boutique » dans le panneau latéral. Aucun import modifié.

**Nom de 30TH-C.** « Collection Classique30ᵉ Anniversaire » corrigé en « Collection
Classique 30ᵉ Anniversaire ». Un import l'aurait réécrit (`upsertSet` envoie `name_fr` à
chaque passage) : `name_fr` est donc ajouté à `locked_fields`, et `verrous_pokemon_sets`
rétablit le nom. Vérifié par une écriture simulée, annulée.

**Bug corrigé au passage.** La vitrine comptait le stock Pokémon par
`pokemon_listings → pokemon_cards`, relation disparue depuis ARCHI-01 : la requête
échouait en silence et affichait « bientôt » partout. Elle passe désormais par la
variante (vérifié : 245 lignes sur SV10, l'ancienne renvoyait une erreur).

`tsc` 0 · `build` exit 0 · lint 18 problèmes, aucun dans les fichiers de ce brief (baseline
inchangée).

**Signalements.**
- **Le sitemap ne liste aucun set** : il demande `updated_at`, colonne absente de
  `pokemon_sets` et `onepiece_sets`. Préexistant, hors périmètre.
- **Rachat : sans recherche, la liste ne montre que les 60 premières cartes.** Les 30
  cartes de 30TH-C, en fin de liste, ne s'y voient qu'en tapant leur nom ou numéro.
  Plafond préexistant.
- **La référence « 30TH-C 1 » ne trouve rien en recherche** : la branche par référence
  retire les tirets du terme mais pas du code. Préexistant, touche tout code à tiret.
- **Déclarer un rattachement passe par SQL.** Aucun contrôle dans l'admin pour l'instant.

### Session 61 - 2026-09-27 (ZARA : sitemap des sets et vraies pages 404)

**Sitemap.** Il demandait `updated_at` aux tables de sets, colonne qui n'existe ni sur
`pokemon_sets` ni sur `onepiece_sets` : la requête échouait et le sitemap ne listait aucun
set. La date retenue est `created_at` (entrée du set au catalogue, donc apparition de sa
page). `release_date` écartée : nulle sur certains sets, future pour un set annoncé. Aucune
colonne ajoutée. Mesuré : 1 009 URL avant, 1 284 après (183 sets Pokémon, 92 One Piece,
soit exactement les sets actifs non rattachés en base ; 30TH-C absent).

**Vraies 404.** Cause commune : `loading.tsx`. Le squelette part avec un statut 200 avant
que la page s'exécute, et son `notFound()` ne peut plus changer le statut. Le contenu était
bien celui de la page introuvable, mais servi en 200.
- Fiche produit : `notFound()` déplacé dans `app/[slug]/layout.tsx`, hors de la frontière
  de chargement, qui résolvait déjà le slug (aucune requête en plus). Un `generateMetadata`
  du layout conserve le titre « Produit introuvable | Goriki » dans le HTML servi.
- Set : aucun layout de set n'est hors de `app/catalogue/loading.tsx`. Le contrôle est donc
  dans le proxy (`lib/supabase/middleware.ts`), limité aux chemins
  `/catalogue/{univers}/{id}` : une lecture par clé primaire, puis un `rewrite` sur la même
  URL avec `status: 404`. La page est rendue telle quelle, seul le statut change.
- Série : pas de route dynamique ; un chemin inconnu répondait déjà 404.

Statuts mesurés (build de production) : fiche, set Pokémon, set One Piece, set à id
invalide, série inexistante : 404 ; fiche, set et liste de séries existants : 200 ; ancienne
URL de 30TH-C : 200 puis redirection (inchangé).

`tsc` 0 · `build` exit 0 · lint 18 problèmes, aucun dans les fichiers de ce brief (baseline
inchangée).

**Signalements.**
- **Titre d'onglet de la fiche introuvable.** Le HTML servi porte « Produit introuvable |
  Goriki », mais une fois la page hydratée l'onglet affiche « 404: This page could not be
  found. », titre du not-found par défaut de Next, désormais rendu depuis la racine. Le
  garder demanderait un `app/not-found.tsx`, qui changerait toutes les 404 du site.
- **Builds concurrents.** Une autre session sert `.next` avec `next start -p 3100` pendant
  que celle-ci rebuild : la mesure a été faite sur une copie du projet (`next build
  --webpack`, Turbopack refusant un `node_modules` en jonction) pour ne pas casser son
  serveur.

### Session 62 - 2026-09-27 (ZARA : Nouveautés, uniquement des sets achetables)

**Migration 0058** `nouveautes_achetables(p_sets_par_univers, p_apercus)`, appliquée et
versionnée, md5 identique à l'octet près (`2b1678e15f91397401d8ea6193c07e5d`, 7 360
caractères).

**Le défaut.** La vitrine retenait les 2 sets les plus récents par `release_date`, en vente
ou non. Elle affichait donc « Bientôt » sur 30TH et 30TH-C, qui n'ont aucune annonce
achetable, et pour DP-12, dont les DEUX seules cartes sont des DON!!, le filigrane SAMPLE
que l'éditeur imprime sur ces visuels.

**Une fonction en base plutôt que des requêtes, et ce n'est pas une préférence.** La
sélection est un « top 2 par univers » assorti d'un « top 3 des cartes achetables » par set
retenu. PostgREST ne sait pas exprimer ce classement par groupe : il aurait fallu rapatrier
toutes les annonces en vente pour les regrouper côté Node, soit 1 533 lignes aujourd'hui,
au-dessus du plafond `db-max-rows` de 1 000 qui **tronque sans lever d'erreur**. La page
passe de six requêtes à une.

**`security invoker`, volontairement.** La fonction n'a aucun privilège propre et filtre
`is_active` explicitement. Un administrateur connecté, dont la policy RLS est un `ALL` sans
condition, voit donc exactement la même vitrine qu'un visiteur. Vérifié : la fonction
appelée sous un rôle qui contourne la RLS rend les deux mêmes sets.

**Ce qu'est une carte montrable.** Achetable (visible, stock > 0, prix chiffré au sens de
`estChiffre`), plus trois exclusions : pas un DON!!, un visuel non nul, et une URL qui ne
contient pas « sample ». Le test DON!! porte sur `card_type` ET `rarity`, qui valent tous
deux « DON!! » en base : une source qui n'en renseignerait qu'une serait quand même
écartée. Rien en base ne marque aujourd'hui une image d'échantillon, le filigrane est DANS
le fichier ; le garde sur l'URL ne coûte rien et attrapera le jour où une source le nomme.

**Deux conditions distinctes, chacune son rôle.** Le décompte affiché compte toutes les
annonces achetables du groupe, DON!! compris : c'est le stock réel. La qualification d'un
set, elle, exige au moins une carte MONTRABLE. Sans cette seconde condition, un set dont
les seules pièces en vente seraient des DON!! entrerait dans la vitrine avec un éventail
vide, c'est-à-dire le défaut qu'on corrige.

**Dédoublonnage par carte.** Plusieurs exemplaires d'une même carte peuvent être en vente :
l'éventail montrait trois fois le même visuel. La fonction garde un exemplaire par carte,
le plus cher, qui est en pratique le mieux conservé.

**Aperçus pris sur ce qui est en vente.** La rareté la moins fréquente est calculée parmi
les cartes ACHETABLES du set, plus parmi tout le catalogue, et le visuel suit le même ordre
de préférence que `visuelDuListing` : scan réel de la pièce, puis visuel de la variante,
puis illustration de référence.

**Sets rattachés inchangés** (migration 0057) : jamais candidats, leur stock reporté sur le
parent par un `coalesce(display_parent_id, id)`.

**Cas « aucun set achetable » : le bloc est ABSENT, pas vide.** Un conteneur conservé aurait
gardé sa place en `flex-1` et laissé un trou au milieu du panneau, que le composant ne
pouvait pas remplir. Sans lui, la colonne de texte garde ses 46 % et l'illustration occupe
le reste : c'est le hero de la session 57, à l'identique.

**L'ordre d'affichage reste Pokémon d'abord**, rétabli par un tri de deux à quatre éléments
côté page. La fonction rend ses lignes par univers alphabétique, et une décision de
présentation n'a pas à dépendre d'une migration.

**Vérifications, au rendu, DÉCONNECTÉ.**
- Sets retenus aujourd'hui. **Pokémon** : ME03 « Équilibre Parfait » (27/03/2026, 51
  annonces / 46 cartes distinctes) et ME02.5 « Héros Transcendants » (30/01/2026, 82
  annonces / 80 cartes). **One Piece : aucun**, l'univers n'a pas une seule annonce
  achetable. Parité 2+2 impossible, et non compensée.
- 30TH, 30TH-C et DP-12, jusqu'ici en vitrine, sont écartés : 0 annonce achetable.
- À 390 px comme à 1440 px : 2 sets au pager, 3 visuels réels, aucun « Bientôt », aucune URL
  contenant « sample » ou « DON- », aucun débordement horizontal.
- Cas vide simulé en appelant la fonction avec `p_sets_par_univers = 0`, sans toucher une
  seule ligne de données : le panneau garde la même hauteur (628 px à 1440), l'illustration
  occupe la moitié droite, aucune zone vide. Correctif temporaire retiré après mesure.

`tsc` 0 · `build` exit 0 · `npm test` 46/46 · lint 18 problèmes, **aucun dans les fichiers
de ce brief**.

**Signalements.**
- **`apercus_de_set` (migration 0031) reste inchangée** et sert toujours les éventails des
  tuiles de rayon, qui sont de la décoration et tirent du CATALOGUE, stock ou non. Les deux
  fonctions coexistent donc avec des règles différentes, à dessein : une vitrine de
  nouveautés annonce ce qu'on peut acheter, une tuile de rayon ne doit pas se vider.
- **La sélection dépend de `release_date`.** Un set récent chiffré plus tard remplacera un
  set plus ancien dès qu'une de ses cartes sera mise en vente. C'est voulu, mais la vitrine
  bougera au fil de la saisie des prix.
- **One Piece disparaîtra de la vitrine tant que rien n'y sera chiffré.** Les 937 annonces
  en stock attendent leur prix : le jour où deux sets en auront, la parité 2+2 reviendra
  d'elle-même.
