# MISSION 04 — DESIGN & RESPONSIVE PARCOURS CLIENT (RYUU orchestre · MILO exécute · NOVA tokens)

## Contexte projet
- Goriki, Next.js 16.2.9 + React 19 + **Tailwind v4**.
- ⚠️ RÈGLE CRITIQUE : PAS de `tailwind.config.ts` — tous les tokens vivent dans `globals.css` via `@import "tailwindcss"` + `@theme inline` + `@custom-variant dark`. Tout agent qui recrée un tailwind.config produit du code cassé.
- Prérequis : Mission 02 livrée (le CTA panier et le checkout sont branchés — ne pas casser leur logique en restylant).

## Identité visuelle VALIDÉE (ne pas réinventer, IMPLÉMENTER)
- Light mode par défaut sur la boutique publique : fond `#E8E1D8` (gris-rosé chaud), accent signature ambre `#C8860A`.
- Typo : Playfair Display (titres), DM Sans (corps).
- Hero : carrousel horizontal de sets, AUCUN texte en surimpression. Ticker défilant discret (info stock). Grilles produits → achat direct, zéro section éditoriale.
- Dark mode disponible via `data-theme` (système existant à conserver).
- Admin : dark verrouillé, sidebar 200px — HORS PÉRIMÈTRE de cette mission.
- Doctrine animations : STANDARD (fade-in, slide-up, hover 150ms — max 4 dans le projet, rien de plus).

## Problème central (audit)
L'identité a été partiellement implémentée MAIS en styles inline (`style={{}}` + `var(--amber)`) avec des px fixes, coexistant avec un second paradigme Tailwind+tokens propre (pages auth/compte/scellés/CartDrawer). Résultat : deux styles de boutons concurrents, parcours mobile inutilisable.

## Décision structurante
**Unifier TOUT le parcours client sur le paradigme Tailwind v4 + tokens** (celui des pages auth/compte/scellés). Éliminer les styles inline des pages client. L'accent bouton unique = ambre `#C8860A` (le bouton crème disparaît).

## Livrables (pages client UNIQUEMENT)
1. **Tokens** (NOVA) : consolider `globals.css` — palette light/dark complète, corriger le bug footer (copyright en couleur claire codée en dur, invisible en dark, `Footer.tsx:38`).
2. **Brancher l'existant dormant** (MILO) : `components/blocks/Hero.tsx`, `components/catalogue/CardGrid.tsx`, `CardTile.tsx`, `SetGrid.tsx` sont responsive, bien conçus et importés NULLE PART. Les brancher dans les pages réelles à la place des grilles inline `repeat(N,1fr)`. Les adapter si besoin, ne pas les réécrire.
3. **Navbar** : menu hamburger mobile (aucun n'existe — la nav déborde). Conserver la structure desktop validée.
4. **HeroCarousel** : supprimer les px fixes (hauteur 440px, offset left:200px, cartes 140×380) → dimensions fluides avec breakpoints. Conserver le comportement carrousel validé.
5. **Home** : grilles `repeat(6,1fr)` → responsive via CardGrid/SetGrid, paddings tokens.
6. **Catalogue** (pokemon/onepiece/[set]) : accordéons et grilles figées → breakpoints ; `FilterPanel` w-52 → version mobile (drawer ou collapse).
7. **Fiche produit** : flex sans wrap → colonne en mobile ; CTA panier au style ambre unifié (SANS toucher au handler branché en mission 02).
8. **Panier** : récap `width:220px` fixe → empilement mobile.
9. **Footer** : wrap mobile + fix couleur.
10. **ThemeToggle** sur les pages auth (absent).
11. **Nettoyage** : supprimer le code mort résiduel (anciennes grilles inline remplacées) — pas de cadavres en commentaire.

## Hors périmètre (interdiction)
- Admin (sidebar, tableaux) — desktop only, chantier ultérieur.
- Toute logique métier : cart, checkout, Stripe, imports.
- Nouvelles animations hors doctrine.

## Validation
- `npm run build` → 0 erreur.
- Contrôle visuel aux breakpoints 375px / 768px / 1280px sur : home, catalogue, [set], fiche produit, panier, checkout, login.
- Zéro `style={{}}` restant sur les pages client (exceptions documentées uniquement).
- Un seul style de bouton primaire sur tout le parcours.
- PROJECT LOG mis à jour.
