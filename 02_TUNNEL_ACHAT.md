# MISSION 02 — TUNNEL D'ACHAT COMPLET (RYUU orchestre · ZARA exécute)

## Contexte projet
- Goriki, Next.js 16.2.9 + React 19 + Tailwind v4, Supabase (`qsejsgkuksojplhitebv`).
- ⚠️ Divergences stack : pas de `tailwind.config.ts` (tokens dans `globals.css`) · `await createClient()` partout server-side · middleware = `proxy.ts` · `use(params)` routes dynamiques.
- Prérequis : Mission 01 livrée (catalogue en base). Peut se lancer en parallèle de 01 si sessions séparées — aucun fichier commun.

## Problème central (constaté par audit)
Le bouton « Ajouter au panier » de la fiche produit (`app/[slug]/page.tsx:191-208`) est un `<button>` SANS `onClick`. `useCart.addItem` (`hooks/useCart.ts`) n'est appelé nulle part. La route `/api/cart` (validation prix/stock) existe mais est orpheline. Conséquence : `/panier` et `/checkout` sont inatteignables — AUCUNE vente possible.

## Livrables

### A. Ajout au panier fonctionnel
1. Brancher le CTA de la fiche produit sur `useCart.addItem`, en passant par `POST /api/cart` pour la validation prix/stock serveur (la logique existe, l'utiliser — ne pas la réécrire).
2. Feedback visuel à l'ajout : ouverture du `CartDrawer` existant (composant déjà propre et responsive).
3. Gérer les cas : stock insuffisant, produit désactivé, quantité max = stock.
4. Vérifier que l'ajout fonctionne depuis la fiche produit ET depuis les grilles catalogue si un CTA rapide y existe.

### B. Module livraison abstrait (décision transporteur NON prise — coder pour le changement)
1. Créer `lib/shipping.ts` : une interface `ShippingProvider` + une implémentation `FlatRateProvider` avec tarifs paramétrables dans `lib/constants.ts` (structure : zone BE / UE-proche (FR-LU-NL-DE) / seuil de gratuité). Valeurs placeholder CLAIREMENT commentées `// TODO tarifs à valider` : BE 5.00€, UE 8.00€, offert dès 60€.
2. Brancher ces tarifs dans la Checkout Session Stripe via `shipping_options` (aujourd'hui inexistants alors que l'UI annonce « Calculée par Stripe » → mensonge involontaire, livraison de fait gratuite).
3. L'architecture doit permettre de remplacer `FlatRateProvider` par un provider API (type Sendcloud) SANS toucher au checkout — c'est le critère de réussite de l'abstraction.

### C. Parcours vérifié de bout en bout
Fiche produit → panier (`/panier` : quantités, suppression) → checkout → paiement Stripe test → `/checkout/success`. Inclure le cas `store_credit` (line item négatif plafonné au sous-total — logique existante à préserver).

## Hors périmètre
- Refonte du webhook Stripe, idempotence, remboursements (mission 03 — ne pas anticiper).
- Design/responsive (mission 04) : brancher la logique dans le markup existant, ne pas restyler.
- Admin (sauf si un fix est strictement nécessaire au parcours).

## Validation
- `npm run build` → 0 erreur.
- Parcours complet exécuté en mode Stripe test avec frais de port visibles dans le checkout.
- PROJECT LOG mis à jour.
