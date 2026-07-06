# MISSION 03 — STRIPE DE A À Z + SÉCURITÉ (RYUU orchestre · KAEL valide l'archi · ZARA exécute)

## Contexte projet
- Goriki, Next.js 16.2.9 + React 19, Supabase (`qsejsgkuksojplhitebv`), Stripe (Checkout Sessions, apiVersion `2026-05-27.dahlia`).
- ⚠️ `await createClient()` partout server-side · middleware = `proxy.ts`.
- Prérequis STRICT : Mission 02 livrée (le checkout et le webhook seront retravaillés ici — dépendance de fichiers directe).
- Demande utilisateur : « Stripe est à faire dans son ensemble » — refonte complète, pas un patch.

## État actuel (audit)
Existant : Checkout Session serveur avec prix relus en base, metadata `user_id`/`items_json`/`store_credit_used`, adresses BE/FR/LU/NL/DE, webhook signé traitant UNIQUEMENT `checkout.session.completed` (création commande + décrément stock read-then-write + déduction store_credit + email Resend).
Manquant : idempotence, remboursements, échecs/expirations, atomicité, réservation de stock, vue paiements admin.

## Livrables

### A. Webhook fiable
1. **Idempotence** : avant toute création, contrôle d'existence d'une commande pour ce `stripe_session_id` (contrainte UNIQUE en base + check applicatif). Un retry Stripe ne doit JAMAIS dupliquer commande / stock / store_credit.
2. **Décrément de stock atomique** : fonction RPC Postgres (`apply_migration`) avec `UPDATE ... SET stock = stock - qty WHERE stock >= qty` + gestion du cas d'échec (commande flaggée pour revue admin plutôt que stock négatif silencieux).
3. **Événements supplémentaires** : `checkout.session.expired` (libération de réservation), `payment_intent.payment_failed` (trace en base).
4. **Gestion d'erreur réelle** sur les inserts `order_items` et updates de stock (aujourd'hui : aucun rollback/vérification).

### B. Réservation de stock
Au checkout : réservation courte (colonne `reserved_qty` ou table de réservations avec TTL aligné sur l'expiration de session Stripe). Décrément définitif au webhook. Objectif : fermer la fenêtre de survente identifiée par l'audit. KAEL tranche l'implémentation (colonne vs table) et la documente au PROJECT LOG.

### C. Remboursements réels
L'action admin « refunded » (`/admin/commandes/[id]`) doit déclencher : `stripe.refunds.create` sur le payment_intent, ré-incrément atomique du stock, re-crédit du `store_credit` si utilisé, statut mis à jour seulement si le refund Stripe réussit. Gérer le remboursement partiel = hors scope (total uniquement, le noter).

### D. Vue paiements admin
Dans `/admin/commandes/[id]` : afficher `stripe_session_id` / `stripe_payment_id` avec lien profond vers le dashboard Stripe. Rien de plus.

### E. Sécurité (à faire dans cette mission, les mains sont dans ces fichiers)
1. **Unifier la source de vérité des rôles sur `profiles.role`** : le middleware (`lib/supabase/middleware.ts:37`) vérifie `app_metadata.role` alors que layouts et API vérifient `profiles.role`. Incohérence dangereuse (risque de se bloquer hors admin en prod). Unifier, tester l'accès admin après.
2. **`GET /api/listings`** : restreindre aux admins (expose des données de gestion à tout utilisateur connecté).
3. **Versionner le schéma** : `supabase db pull` pour rapatrier les 13 migrations distantes dans `supabase/migrations/` (actuellement vide) + commit.

## Hors périmètre
- Design (mission 04) · dépôt-vente/commissions (V2) · PayPal/autres moyens de paiement · webhooks de litiges (documenter comme TODO V2).

## Validation
- `npm run build` → 0 erreur.
- Tests Stripe CLI : `checkout.session.completed` rejoué 2× → UNE seule commande. Session expirée → réservation libérée. Refund admin → refund visible côté Stripe + stock ré-incrémenté.
- Connexion admin fonctionnelle après unification des rôles.
- PROJECT LOG mis à jour.
