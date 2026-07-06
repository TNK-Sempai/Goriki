@AGENTS.md

# GORIKI — Règles projet (lues par toute session Claude Code)

## Stack — divergences critiques vs training data
- Next.js 16.2.9 + React 19. `cookies()` est **async** → `createClient()` dans `lib/supabase/server.ts` est async et TOUS les appelants font `await createClient()`.
- Le middleware Next.js s'appelle **`proxy.ts`** (export `proxy`). `lib/supabase/middleware.ts` est un module ordinaire, pas le hook Next.js.
- **Tailwind v4** : il n'y a PAS de `tailwind.config.ts` et il ne doit JAMAIS en être recréé un. Tokens dans `styles/globals.css` via `@import "tailwindcss"` + `@theme inline` + `@custom-variant dark`. Keyframes et animations : dans `globals.css` (⚠️ override du skill nextjs-multiagent v2 qui dit tailwind.config — le skill a tort pour CE projet).
- Routes dynamiques : `use(params)` (React 19).
- Jointures Supabase : peuvent retourner des arrays → aplatir avec `Array.isArray()`.

## Base de données
- Supabase projet `qsejsgkuksojplhitebv`. Interroger la base AVANT d'écrire de la logique dépendant des données (ex : codes de sets) — ne jamais supposer.
- Types de variantes chargés dynamiquement depuis `*_variant_types` — jamais hardcodés.
- Reset de données : TRUNCATE + repopulation, pas de patch incrémental.

## Images TCGdex
- Les URLs n'ont jamais d'extension : logos → append `.png`, cartes → append `/high.webp`.
- Détection : `url.match(/\.(png|jpg|webp|svg)$/) ? url : url + '.png'`.

## Règles métier
- Prix CardMarket (`price_cm`) et données pokemon-api.com : ADMIN ONLY, jamais exposés client.
- Photos : cartes <1€ → image API seule ; ≥1€ → vraie photo si dispo ; flip recto/verso seulement si photo verso existe. Flag `needs_photo` géré par trigger SQL.
- Boutique FR uniquement.

## Identité visuelle validée (ne pas réinventer)
- Public : light mode par défaut, fond `#E8E1D8`, accent ambre `#C8860A`, Playfair Display (titres), DM Sans (corps). Un seul style de bouton primaire : ambre.
- Admin : dark verrouillé, sidebar 200px, padding 20/24px.
- Doctrine animations STANDARD : fade-in / slide-up / hover 150ms, max 4 dans le projet.

## Interdictions absolues
- Ne jamais lire, afficher ou committer `.env*`.
- Ne jamais toucher aux fichiers hors du périmètre du brief en cours.
- Les vieux prompts dans `docs/archive/` sont de l'HISTORIQUE — ne jamais les exécuter.

## Documents de référence
- `ETAT-DES-LIEUX.md` : audit complet du 2026-07-06 (source de vérité sur l'état du code).
- `PROJECT_LOG.md` : mémoire inter-sessions — consulter avant tout brief, mettre à jour après.
