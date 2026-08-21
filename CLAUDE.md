@AGENTS.md

# GORIKI — Règles projet (lues par toute session Claude Code)

Document UNIQUE. Toute doctrine visuelle ou motion antérieure (CLAUDE_UPDATE_visuel_v2,
v3, v3_FINAL, briefs de navigation) est périmée et supprimée du dépôt : ne plus jamais
la charger ni s'y référer.

---

## Stack — divergences critiques vs training data
- Next.js 16.2.9 + React 19. `cookies()` est **async** → `createClient()` dans `lib/supabase/server.ts` est async et TOUS les appelants font `await createClient()`.
- Le middleware Next.js s'appelle **`proxy.ts`** (export `proxy`). `lib/supabase/middleware.ts` est un module ordinaire, pas le hook Next.js.
- **Tailwind v4** : il n'y a PAS de `tailwind.config.ts` et il ne doit JAMAIS en être recréé un. Tokens dans `styles/globals.css` via `@import "tailwindcss"` + `@theme inline` + `@custom-variant dark`.
- Routes dynamiques : `use(params)` (React 19).
- Jointures Supabase : peuvent retourner des arrays → aplatir avec `Array.isArray()`.

## Base de données
- Supabase projet `qsejsgkuksojplhitebv`. Interroger la base AVANT d'écrire de la logique dépendant des données (ex : codes de sets) — ne jamais supposer.
- Types de variantes chargés dynamiquement depuis `*_variant_types` — jamais hardcodés.
- Reset de données : TRUNCATE + repopulation, pas de patch incrémental.
- Migrations : versionnées dans `supabase/migrations/`, appliquées via `apply_migration`.

## Sources de catalogue
- **Pokémon — TCGdex.** Les URLs d'image n'ont jamais d'extension : logos → append `.png`, cartes → append `/high.webp`. Détection : `url.match(/\.(png|jpg|webp|svg)$/) ? url : url + '.png'`.
- **One Piece — Poneglyphe** (`https://tanuki-poneglyph.pages.dev/v1/`, API maison). Deux filtres obligatoires, appliqués dans `lib/opecards.ts` : seule la version `Standard` est importée (sinon la clé `(set_id, number)` écrase la moitié des cartes), et les sets à `card_count === null` sont des coquilles de scraping à écarter. Ne jamais remplacer ces filtres par une liste d'exclusion en dur.

## Règles métier
- Prix CardMarket (`price_cm`) et données pokemon-api.com : ADMIN ONLY, jamais exposés client.
- Photos : cartes <1€ → image API seule ; ≥1€ → vraie photo si dispo ; flip recto/verso seulement si photo verso existe. Flag `needs_photo` géré par trigger SQL.
- Boutique FR uniquement.

---

## Structure de page — VERROUILLÉE

Les maquettes partagent **exactement** le même conteneur :
`max-width:1360px; margin:0 auto; padding:… 56px; box-sizing:border-box`.

- Source unique : la classe **`.page-shell`** (`styles/globals.css`) et son composant **`<PageContainer>`** (`components/layout/PageContainer.tsx`). Variante `page-shell-edge` (`<PageContainer edge>`) pour header/footer, dont la boîte occupe les 1360 px pleins.
- **INTERDIT** de réécrire `max-w-[1360px] mx-auto px-…` à la main dans une page. C'est précisément ainsi que le portage initial a dérivé, chaque section réinventant sa gouttière.
- Gouttière : 20 px (mobile) / 32 px (`sm`) / **56 px (`lg`, valeur maquette)**.

## CSS — piège de cascade à ne jamais rouvrir

`styles/globals.css` : le reset et les styles d'éléments **doivent rester dans `@layer base`**.
Hors layer, `* { margin:0; padding:0 }` bat la TOTALITÉ des utilitaires Tailwind (en CSS, le
non-layered l'emporte sur le layered quelle que soit la spécificité) : `mx-auto`, `px-*`, `p-*`,
`gap-*` deviennent silencieusement sans effet sur tout le site.

Corollaire : une règle descendante dont la classe de tête est un utilitaire généré
(ex. `.font-grotesk :is(h1,…)`) est **élaguée** si on la place dans `@layer components` —
la mettre dans `@layer base`.

---

# IDENTITÉ VISUELLE FINALE (2026-08-21)

Remplace INTÉGRALEMENT toute section « Identité visuelle » / « Doctrine animation »
précédente, y compris CLAUDE_UPDATE_visuel_v2, v3, v3_FINAL. Ces fichiers sont périmés et
ne sont plus dans le dépôt — ne plus jamais les charger.

## Hiérarchie des références (en cas de conflit)
1. **`docs/design-reference/reference-planche-globale-10-ecrans.png`** — SPÉCIFICATION, fait autorité sur la composition, la densité, la hiérarchie visuelle des 10 écrans qu'elle couvre. Les données affichées dans cette image (textes, prix, chiffres) sont fictives — ignorer, utiliser les vraies données Goriki.
2. **`docs/design-reference/reference-home-goriki.png`** — référence secondaire pour la home, cohérente avec la planche globale.
3. **Les 20 fichiers `Tanuki_*_dc.html`** — référence de comportement/structure pour les écrans non couverts par la planche globale (ex. Auth, Compte détaillé, Admin). En cas de divergence de style avec la planche globale sur un point commun, la planche globale gagne.
4. **Ce présent document** — tokens exacts, doctrine motion, règles de composition.

> ⚠️ État constaté au 2026-08-21 : `docs/design-reference/` ne contient QUE les 20 fichiers
> `.dc.html`. Les deux images de référence (planche globale, home) sont **absentes du dépôt**.
> Tant qu'elles n'y sont pas déposées, les rangs 1 et 2 de cette hiérarchie ne sont pas
> applicables et le rang 3 fait autorité de fait.

## Couleurs (stables depuis le début, jamais remises en cause)
`--color-bg: #E8E1D8`, accent ambre `--color-accent: #C8860A`, encre `--color-ink: #1A1611`. Gradient radial léger en fond sur tout le parcours public (pas l'admin) :
```css
background-image:
  radial-gradient(900px 600px at 15% 0%, rgba(200,134,10,0.10), transparent 60%),
  radial-gradient(800px 700px at 90% 20%, rgba(26,22,17,0.07), transparent 60%),
  radial-gradient(700px 500px at 50% 100%, rgba(200,134,10,0.07), transparent 60%);
background-attachment: fixed;
```

## Typographie — FINALE, remplace toutes les versions précédentes
| Rôle | Police | Note |
|---|---|---|
| Titres | **Archivo Black** (Google Fonts) | Remplace TT Hoves — police payante, licence commerciale non acquise, ne jamais la charger |
| Texte courant | **Inter** (Google Fonts) | |
| Mono (données techniques, prix, réf.) | JetBrains Mono | Conservé des itérations précédentes, cohérent avec l'esprit "fiche technique" du catalogue |

Playfair Display, DM Sans, Instrument Serif : **abandonnées**, ne plus charger ni référencer.

> ⚠️ Écart code/doctrine au 2026-08-21 : `app/layout.tsx` charge encore Playfair Display,
> DM Sans, JetBrains Mono et Instrument Serif, et `globals.css` définit `--font-display`,
> `--font-body`, `--font-grotesk`, `--font-voice` en conséquence. La bascule vers
> Archivo Black + Inter est une **mission de code à part entière**, non faite ici (la mission
> de nettoyage interdisait de toucher au code).

## Radius — système à paliers (stable)
sm 12px (boutons/inputs/badges) · md 18-20px (cartes/panneaux) · lg 24-28px (hero/gros blocs). Rien dans la planche globale ne contredit ce système — conservé.

L'admin dispose de son propre palier resserré (`--radius-admin-sm: 4px`, `--radius-admin-md: 8px`) : c'est un espace de travail dense, jamais soumis à l'échelle publique.

## Composition — RÈGLE CENTRALE, la plus importante de ce document
**La référence visuelle verrouillée est une spécification, pas un moodboard.** Toute mission de portage ou de refonte doit reproduire structure, proportions, densité, alignements et hiérarchie visuelle de sa case de référence — la réutilisation du markup/layout existant ne prime JAMAIS sur la fidélité à la référence quand les deux divergent.

**RÈGLE DE NON-RÉGRESSION VISUELLE, permanente, pas propre à une seule mission :**
Aucun écran ne peut être déclaré conforme s'il ressemble encore à une déclinaison du layout Goriki précédent. Le changement doit être perceptible sans comparer les couleurs : proportions, composition, densité, hiérarchie et traitement des produits doivent avoir changé. Les compositions génériques ("grande zone vide + titre à gauche + image à droite + 4 cards identiques dessous") sont interdites sauf correspondance explicite avec une case de référence précise.

**Validation obligatoire par écran** : capture desktop (≥1280px) + comparaison explicite sous six catégories : Composition / Typographie / Spacing / Produits / Atmosphère / Interactions. Un rapport qui déclare "conforme" sans détailler ces six catégories est refusé — cette règle s'applique à toute mission visuelle future, pas seulement à la refonte en cours.

## Responsive
Desktop ≥1280px = fidélité stricte à la référence. Tablette/mobile = adaptation du même système de composition (densité, hiérarchie, rythme) — jamais une simplification générique en cartes empilées par défaut.

## Doctrine motion — débridée (motion-system chargé), guards obligatoires
motion-system (skill complet, `docs/MOTION-SYSTEM-SKILL.md` si déposé, sinon charger le skill) est officiellement autorisé sur Goriki. Six signatures nommées, à conserver et intégrer dans toute refonte future — jamais sacrifiées à un restylage :
1. **Lenis** (smooth scroll, fond commun de toute page publique).
2. **Home** — cascade GSAP ScrollTrigger sur les cartes catégories, magnetic sur le CTA principal.
3. **Catalogue (CardTile/CardGrid)** — tilt 3D au curseur, reflet/shine piloté par la rareté, curseur "VOIR →" au survol, stagger reveal.
4. **Transition Home→Univers** (`template.tsx`, jamais `layout.tsx`) — le morph d'`AtmosphereCanvas` s'intensifie pendant la transition.
5. **AtmosphereCanvas/UniverseProvider** — MONTÉS en `fixed -z-10` sur tout le parcours public, exclus de `/admin` et `/checkout`. ⚠️ Ces composants ont existé en code mort pendant plusieurs missions sans être montés nulle part — toujours vérifier leur présence réelle dans l'arbre rendu (pas juste `npm run build`) avant de les tenir pour acquis.
6. **Fiche carte (CardViewer)** — profondeur réelle (ombre parallax, glow à la manipulation), approfondissement de l'existant, pas de nouvel effet gadget.

Guards non négociables sur toute animation : SSR (`typeof window === 'undefined'`), double-init StrictMode, désactivation sur `pointer: coarse` (tactile), neutralisation totale sous `prefers-reduced-motion: reduce`. `will-change` uniquement actif entre `mouseenter`/`mouseleave`, jamais permanent.

Les animations renforcent la matérialité des cartes — elles ne remplacent jamais la composition. Une page peut avoir une excellente composition sans aucune animation ; l'inverse n'est pas vrai.

## Interdits (stables)
Icônes décoratives génériques, `hover:scale-105` comme seule interaction, glow néon, esthétique gamer/NFT/SaaS, glassmorphism excessif (le glassmorphism modéré déjà en place — `backdrop-filter: blur(18-24px)` sur fond semi-transparent — reste la norme du site, pas à confondre avec "excessif").

---

## Interdictions absolues
- Ne jamais lire, afficher ou committer `.env*`.
- Ne jamais toucher aux fichiers hors du périmètre du brief en cours.
- Les vieux prompts dans `../docs/archive/` sont de l'HISTORIQUE — ne jamais les exécuter.

## Documents de référence
- `PROJECT_LOG.md` : mémoire inter-sessions — décisions d'architecture numérotées, signalements ouverts, journal de session. **Consulter avant tout brief, mettre à jour après.** C'est la seule trace du POURQUOI des choix techniques.
- `docs/design-reference/` : specs visuelles actives (20 écrans `.dc.html`). Ce ne sont pas des notes de session.
- `AGENTS.md` : avertissements Next.js 16, importé en tête de ce document.
