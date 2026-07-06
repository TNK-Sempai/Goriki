# GORIKI — ORDONNANCEMENT DES MISSIONS (juillet 2026)

Objectif : boutique en vente directe ouvrable. Dépôt-vente, scan, exports multi-plateformes = V2 (après ouverture).

## Ordre d'exécution

```
Session A ──▶ 01_CATALOGUE_IMPORTS ─┐
                                     ├──▶ 03_STRIPE_COMPLET ──▶ 04_DESIGN_RESPONSIVE
Session B ──▶ 02_TUNNEL_ACHAT ──────┘
```

- **01 et 02 en parallèle** (2 fenêtres Claude Code) : aucun fichier commun — 01 vit dans `/api/import/*` + `/admin/import/*`, 02 dans fiche produit / cart / checkout.
- **03 STRICTEMENT après 02** : retravaille le checkout et le webhook que 02 vient de brancher.
- **04 STRICTEMENT après 02** (et idéalement après 03) : restyle des pages dont la logique doit être figée.
- Une mission = une session Claude Code. Jamais deux missions dans la même session.

## Après la mission 04 (hors agents — manuel)
1. Saisie du stock réel (édition en masse admin + Google Sheets inventaire).
2. Redéploiement Vercel + env vars (les 10 listées dans ETAT-DES-LIEUX.md §8 — vérifier `NEXT_PUBLIC_APP_URL` : une valeur incorrecte casse silencieusement /admin/stats).
3. Passage Stripe en mode live + webhook prod.
4. Domaine goriki.be.

## Décisions encore ouvertes (à trancher avant ouverture, pas avant de coder)
- Tarifs de port réels (placeholders : BE 5€ / UE 8€ / offert dès 60€ — dans `lib/constants.ts`).
- Transporteur + API (candidat : Sendcloud) → remplacera `FlatRateProvider` sans toucher au checkout.
- Source One Piece si OPECards est mort (la mission 01 rendra son diagnostic).

## V2 (backlog, ne pas laisser les agents y toucher)
Dépôt-vente complet (rôle déposant, paliers 30/25/20/15%, gross_amount/payout, TVA marge) · scan local via Ollama vision (qwen2.5-vl sur G16/desktop) · sync eBay (Sell API officielle, gratuite) · export CSV format Cardmarket (API fermée aux nouvelles demandes, vérifié 07/2026) · reste du backlog audit (admin responsive, filtres commandes, N+1 wishlist, adresse JSON brute).
