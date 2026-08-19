# NETTOYAGE — code mort · 2026-08-19

> Audit et suppression menés par RYUU (orchestration) / REX (exécution), avant le portage du nouveau visuel.
> État de départ : commit `e14f73a` (mission 03 livrée). Tout est réversible par git.
> Méthode : détection par grep systématique sur chaque fichier et chaque symbole exporté — aucune suppression sur intuition.

---

## A. Supprimé

### Fichiers

| Fichier | Lignes | Raison | Preuve |
|---|---|---|---|
| `components/admin/NavItem.tsx` | 41 | Jamais importé. `components/admin/Sidebar.tsx` réimplémente le rendu des entrées de nav en interne (mêmes icônes, même notion `disabled`) — doublon pur | 0 occurrence de `NavItem` hors du fichier lui-même |
| `lib/types.ts` | 0 | Fichier **vide** (0 octet), jamais importé. Signalé comme défaut P3 depuis l'audit de juillet | 0 import ; le seul match de `types` dans le code est `detail?.types?.[0]` (TCGdex) |
| `lib/emails/welcome.ts` | 40 | `welcomeHtml` n'est appelé nulle part. Aucun email de bienvenue n'a jamais été branché | 0 import ; le seul `resend.emails.send` du projet utilise `order-confirmed` et `order-shipped` |
| `public/file.svg` | — | Asset par défaut de `create-next-app`, référencé nulle part | 0 référence dans `app/`, `components/`, `styles/` |
| `public/globe.svg` | — | idem | idem |
| `public/next.svg` | — | idem | idem |
| `public/vercel.svg` | — | idem | idem |
| `public/window.svg` | — | idem | idem |

### Symboles et paramètres

| Symbole | Fichier | Raison |
|---|---|---|
| `ADMIN_EMAILS` | `lib/constants.ts` | Tableau vide, jamais consommé. **Activement trompeur** : il suggère une gestion des admins par email alors que la source de vérité est `profiles.role` (unifiée en mission 03) |
| paramètre `request` | `app/api/export/commandes/route.ts` (`GET`) | Jamais utilisé — signalé par ESLint. L'import `NextRequest` devenu inutile est retiré avec lui |
| paramètre `request` | `app/api/wishlist/route.ts` (`GET`) | Jamais utilisé. L'import `NextRequest` est **conservé** : le `POST` du même fichier s'en sert |

### Fonctions SQL — migration `0018_drop_orphan_functions`

Quatre fonctions trigger rattachées à **aucun** trigger, appelées nulle part, et **cassées par construction** : elles visent des tables ou colonnes qui n'existent plus. Vérifié avant suppression qu'aucune n'apparaît dans une policy, un `DEFAULT` de colonne, une contrainte ou une vue.

| Fonction | Pourquoi morte |
|---|---|
| `generate_order_number()` | Écrit `NEW.order_number` — la colonne n'existe pas sur `orders` (13 colonnes, vérifié) |
| `generate_ticket_number()` | Lit la table `tickets` — elle n'existe pas dans le schéma |
| `handle_default_address()` | Écrit dans `addresses` — elle n'existe pas dans le schéma |
| `update_updated_at_column()` | Doublon strict de `update_updated_at()`, qui porte les 7 triggers réels |

`decrement_stock_on_paid_order()`, citée au brief, avait déjà été supprimée en mission 03 (migration `0015`) — rien à faire.

<details>
<summary>Source des 4 fonctions supprimées (conservée ici : leur <code>CREATE</code> n'était dans aucune migration versionnée)</summary>

```sql
CREATE OR REPLACE FUNCTION public.generate_order_number()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE
  v_date text := to_char(now(), 'YYYYMMDD');
  v_count integer;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.orders
  WHERE created_at::date = CURRENT_DATE;
  NEW.order_number := 'TCG-' || v_date || '-' || LPAD(v_count::text, 5, '0');
  RETURN NEW;
END;
$function$

CREATE OR REPLACE FUNCTION public.generate_ticket_number()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE
  today_date text;
  seq_num int;
BEGIN
  today_date := to_char(NOW(), 'YYYYMMDD');

  SELECT COUNT(*) + 1 INTO seq_num
  FROM tickets
  WHERE ticket_number LIKE 'TKT-' || today_date || '%';

  NEW.ticket_number := 'TKT-' || today_date || '-' || lpad(seq_num::text, 4, '0');
  RETURN NEW;
END;
$function$

CREATE OR REPLACE FUNCTION public.handle_default_address()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.addresses
    SET is_default = false
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$function$

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
```

</details>

---

## B. Laissé en l'état — par prudence

### ⚠️ À trancher : les 4 composants catalogue dormants

| Fichier | Lignes | Pourquoi NON supprimé |
|---|---|---|
| `components/blocks/Hero.tsx` | 58 | **La mission 04 les nomme explicitement comme à rebrancher** : « Hero.tsx, CardGrid.tsx, CardTile.tsx, SetGrid.tsx sont responsive, bien conçus et importés NULLE PART. Les brancher dans les pages réelles… Les adapter si besoin, ne pas les réécrire. » Les supprimer détruirait un livrable planifié |
| `components/catalogue/CardGrid.tsx` | 46 | idem |
| `components/catalogue/CardTile.tsx` | 67 | idem — importé uniquement par `CardGrid` (donc mort par transitivité, pas en soi) |
| `components/catalogue/SetGrid.tsx` | 36 | idem |

**Décision requise :** si le « nouveau visuel » à porter remplace le plan de la mission 04, ces 207 lignes sont bel et bien mortes et je les supprime en une passe. Si la mission 04 tient, elles doivent rester.

### Exports inutilisés — conservés volontairement

| Symbole | Fichier | Raison de la conservation |
|---|---|---|
| `ShippingProvider`, `FlatRateProvider`, `ShippingQuoteInput` | `lib/shipping.ts` | **Abstraction délibérée** (décision d'archi mission 02) : l'interface existe pour pouvoir remplacer `FlatRateProvider` par un provider Sendcloud sans toucher au checkout. Seul `getShippingProvider()` est consommé aujourd'hui — c'est le fonctionnement attendu |
| `cn` | `lib/utils.ts` | Helper Tailwind standard. Supprimé la veille d'un portage visuel, il serait réécrit le lendemain |
| `StockFailure`, `FinalizeOrderInput`, `FinalizeOrderResult` | `lib/orders/finalize.ts` | Contrat typé public du module (mission 03), utilisés en interne comme types de signature |
| `SetImportStats` | `lib/import/pokemon.ts` | Contrat typé du moteur d'import |
| `OPECard` | `lib/opecards.ts` | Contrat typé du client OPECards, en attente du branchement d'une source One Piece |
| `TCGdexCardDetail` | `lib/tcgdex.ts` | Contrat typé du client TCGdex |
| `CART_UPDATED_EVENT` | `hooks/useCart.ts` | Utilisé dans son propre module ; exporté en pendant de `CART_OPEN_EVENT`, lui consommé à l'extérieur. Dépareiller les deux nuirait à la lisibilité |
| `TCGType`, `PHOTO_PRICE_THRESHOLD` | `lib/constants.ts` | Une ligne chacun, documentant une règle métier de `CLAUDE.md` (seuil photo à 1 €, appliqué par trigger SQL) |
| `REPLY_TO` | `lib/resend.ts` | Une ligne, adresse de contact — évidence pour le prochain email branché |
| `slugify` | `lib/utils.ts` | Une ligne d'un trio d'helpers (`cn` / `formatPrice` / `slugify`) ; casser le trio pour 3 lignes n'apporte rien |

### Fonctions SQL V2 — conservées

`generate_buyback_number()`, `generate_consignment_number()`, `handle_consignment_item_sold()` : rattachées à aucun trigger et sans appelant, **mais** leurs tables (`buyback_requests`, `consignment_items`) existent et le dépôt-vente est un chantier V2 explicitement protégé par `00_ORDONNANCEMENT.md`. C'est de l'amorce, pas du résidu.

`is_admin()` est dans la même situation « 0 trigger, 0 appel dans le code » — **et pourtant vitale** : la policy `SELECT` de `profiles` l'appelle depuis la migration `0017`. Piège évité de justesse ; c'est la raison pour laquelle chaque candidat a été confronté aux policies, defaults, contraintes et vues avant suppression.

### Ne relève pas de la suppression

| Élément | Pourquoi laissé |
|---|---|
| `detectSerie()` — `components/catalogue/OnePieceCatalogueClient.tsx:26` | **Le brief la cible, mais elle n'est pas morte : elle est appelée ligne 47.** La retirer suppose de basculer le catalogue One Piece sur `serie_name` en base — or **cette colonne n'existe que sur `pokemon_sets`** (migration `0014`), pas sur `onepiece_sets`. Le retrait exige donc une migration + une reprise du pipeline d'import : c'est un refactor, hors périmètre « suppression uniquement ». Sans effet aujourd'hui (0 donnée One Piece en base) |
| `alert()` — `components/auth/LoginForm.tsx:37` | Défaut d'UX, pas du code mort. Le remplacer change le comportement → hors périmètre |
| 21 `any` dans `app/**` | Tous dans des composants de page (`useState<any>`, `map((item: any))`). Les typer est un refactor, pas une suppression |
| `console.log` × 10 dans `scripts/import-catalogue-pokemon.ts` | Sortie terminal légitime d'un outil CLI. Aucun `console.log` dans le code applicatif |
| `/admin/rachat`, `/admin/depot-vente` dans `Sidebar.tsx` | Entrées `disabled: true` marquées « V2 » — placeholders volontaires, pas des liens cassés |
| `app/compte/rachat/`, `app/compte/depot-vente/` | Pages « Bientôt disponible » réellement servies (HTTP 200), pas des stubs oubliés |
| Briefs de mission `01`→`03` (livrés) | Spécifications que le code implémente, référencées par `00_ORDONNANCEMENT.md` et le PROJECT LOG. Documentation, pas code mort |

### Hors du dépôt git — signalé, non touché

`git ls-files` le confirme : **le dépôt s'arrête à `goriki/`**. Rien de ce qui suit n'est suivi par git, donc **aucune suppression n'y serait réversible**. Décision : ne rien y toucher sans demande explicite.

| Chemin | Observation |
|---|---|
| `../scripts/import-stock-pokemon.ts` | Vraisemblablement remplacé par `goriki/scripts/import-catalogue-pokemon.ts` (mission 01), qui est le moteur réellement utilisé. Candidat à la suppression manuelle |
| `../docs/archive/*.md` (3 fichiers, 90 Ko) | Explicitement qualifiés d'HISTORIQUE par `CLAUDE.md`, avec interdiction de les exécuter. Volumineux mais assumés |
| `../ETAT-DES-LIEUX.md`, `../POINT-ETAPE.md` | Documents de référence toujours cités par `CLAUDE.md` et le PROJECT LOG |
| `../PROJECT_LOG.md` | Pointeur de 554 octets vers le LOG canonique — utile, empêche d'écrire au mauvais endroit |

---

## C. Recherches restées vides

Ces pistes du brief ont été explorées et n'ont **rien** donné — c'est un résultat, pas un oubli :

- **Références à l'ancien projet Bulk-TCG** : 0 occurrence (`bulk-tcg`, `bulktcg`, insensible à la casse) dans le code, les styles et la documentation.
- **Tables/colonnes disparues référencées dans le code** : 0 occurrence de `extensions`, `blog_posts`, `accessories`, `addresses`, `condition_id`, `language_id`, `stock_qty`, `tcg_id`. Le code ne parle qu'au schéma actuel. *(Ces noms subsistent uniquement dans les 6 premières migrations historiques — voir le signalement « historique non rejouable » au PROJECT LOG.)*
- **Vues SQL orphelines** : aucune vue ni vue matérialisée dans `public`. La vue `blog_posts_with_author` de la migration de mars n'existe plus.
- **`debugger`, `FIXME`, `XXX`** : 0 occurrence.

---

## D. Signalements — constatés, NON corrigés (hors périmètre)

1. **Webhook Stripe — journalisation d'événement en échec sur commande purgée.** `app/api/stripe/webhook/route.ts` insère dans `stripe_events` avec l'`order_id` lu dans la metadata. Si la commande a déjà été purgée (session expirée), l'insert viole `stripe_events_order_id_fkey`. Le code loggue et poursuit **volontairement**, donc rien ne casse — mais l'événement n'est pas journalisé, et l'idempotence de niveau 1 est perdue pour lui. Le niveau 2 (verrou d'état dans `finalize_paid_order`) protège toujours. Correctif naturel : mettre `order_id` à `null` si la commande n'existe plus. Trace observée dans `.next/dev/logs/next-development.log` pendant les tests de la mission 03.
2. **`app/api/wishlist/route.ts`** conserve un `import type { NextRequest }` désormais utilisé par le seul `POST` — normal, mentionné pour éviter qu'une future passe ne le retire à tort.

---

## Validation

| Contrôle | Résultat |
|---|---|
| `npm run build` | **0 erreur** (TypeScript compilé, 46 pages générées) |
| `next-development.log` | **0** « module not found » / « cannot find module » / « failed to compile » |
| Parcours `npm run dev` (port 3001) | `/` 200 · `/catalogue` 200 · `/catalogue/pokemon` 200 · `/catalogue/scelles` 200 · fiche produit `/[slug]` 200 · `/panier` 200 · `/checkout` 200 · `/login` 200 · `/admin` 307 (redirection attendue sans session) |
| Migrations versionnées | **18/18**, `0018` vérifiée par md5 contre le SQL appliqué |
| Fonctions SQL restantes | 12, dont 9 portant les triggers actifs ou appelées par le code/les policies |

**Bilan : 8 fichiers, 1 constante, 2 paramètres et 4 fonctions SQL supprimés.** Aucun comportement modifié.
