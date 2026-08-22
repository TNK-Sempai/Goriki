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
