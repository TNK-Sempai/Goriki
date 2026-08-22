-- ─────────────────────────────────────────────────────────────────────────────
-- Dépôt-vente : lecture par le déposant
--
-- La migration 0023 a retiré `user_id` du GRANT SELECT de `anon` et
-- `authenticated`, pour que la vitrine publique n'expose pas l'identité des
-- déposants. Effet de bord : le déposant lui-même ne pouvait plus filtrer ses
-- propres pièces (`.eq('user_id', auth.uid())` porte sur une colonne qu'il
-- n'a plus le droit de lire) — l'espace « Mes dépôts » remontait vide.
--
-- On ne réouvre PAS la colonne : un utilisateur connecté verrait alors le
-- `user_id` des dépôts de tout le monde, puisque la policy de vitrine autorise
-- la lecture de toute ligne `active`. On expose à la place une fonction
-- `SECURITY DEFINER` étroitement cadrée, qui ne rend QUE les lignes de
-- l'appelant et ne divulgue jamais `commission_rate` ni `notes`.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.mes_depots()
returns table (
  id uuid,
  card_id uuid,
  variant_type_id uuid,
  asking_price numeric,
  status consignment_status,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.card_id, c.variant_type_id, c.asking_price, c.status, c.created_at
  from public.consignment_items c
  where c.user_id = auth.uid()
  order by c.created_at desc
$$;

revoke all on function public.mes_depots() from public, anon;
grant execute on function public.mes_depots() to authenticated;

comment on function public.mes_depots() is
  'Pièces en dépôt-vente de l''utilisateur courant. SECURITY DEFINER car la '
  'migration 0023 a retiré `user_id` du GRANT SELECT pour protéger l''identité '
  'des déposants sur la vitrine publique. Ne rend jamais commission_rate ni notes.';