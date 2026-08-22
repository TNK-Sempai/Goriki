-- ─────────────────────────────────────────────────────────────────────────────
-- Dépôt-vente : vitrine publique
--
-- La planche de référence (écran 6) fait du dépôt-vente une SECTION BOUTIQUE
-- publique, atteignable depuis la nav principale. Or `consignment_items` était
-- en lecture strictement propriétaire : un visiteur non connecté ne voyait rien,
-- et le lien de nav menait à un mur d'authentification.
--
-- On ouvre la lecture aux SEULES pièces `active` (celles réellement en vitrine).
-- Les autres statuts (pending, sold, returned, cancelled) restent privés.
--
-- ⚠️ RLS ne sait pas restreindre des COLONNES. Les colonnes commercialement
-- sensibles sont donc retirées par GRANT au niveau colonne — même technique que
-- la migration 0021 sur `profiles` :
--   · commission_rate → marge de la maison, jamais publique
--   · notes          → commentaires internes
--   · user_id        → identité du déposant
-- ─────────────────────────────────────────────────────────────────────────────

create policy "Consignment — vitrine publique"
  on public.consignment_items
  for select
  using (status = 'active');

-- Repartir d'une base nette : on retire le SELECT global hérité du rôle...
revoke select on public.consignment_items from anon, authenticated;

-- ...puis on ne rend visibles que les colonnes de vitrine.
grant select (id, card_id, variant_type_id, asking_price, status, created_at, updated_at)
  on public.consignment_items to anon, authenticated;

-- Le propriétaire et l'admin ont besoin de TOUTES les colonnes : ils passent par
-- `service_role` (routes serveur) ou par les policies existantes côté admin.
grant select on public.consignment_items to service_role;