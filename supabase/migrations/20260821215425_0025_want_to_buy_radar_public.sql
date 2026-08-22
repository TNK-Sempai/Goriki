-- ─────────────────────────────────────────────────────────────────────────────
-- Want to Buy : radar public agrégé
--
-- L'entrée de nav « Want to Buy » doit mener à une page PUBLIQUE montrant ce
-- que la communauté recherche (« X personnes recherchent cette carte »), et non
-- à la gestion personnelle qui exige d'être connecté.
--
-- `want_to_buy_requests` est en lecture strictement propriétaire, et doit le
-- rester : une demande nominative révèle ce qu'un individu cherche et jusqu'à
-- quel prix. On n'ouvre donc PAS la table — on expose uniquement un AGRÉGAT via
-- une fonction `SECURITY DEFINER`.
--
-- Ce que la fonction ne rend jamais :
--   · `user_id`    → qui cherche
--   · `max_price`  → jusqu'à combien (avec un compte à 1, ce serait nominatif)
--   · `free_text`  → description libre, peut contenir n'importe quoi
--
-- Seules les demandes `active` rattachées à une carte du catalogue remontent.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.want_to_buy_radar()
returns table (
  card_type text,
  card_id uuid,
  demandes bigint,
  derniere timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select w.card_type, w.card_id, count(*)::bigint as demandes, max(w.created_at) as derniere
  from public.want_to_buy_requests w
  where w.status = 'active'
    and w.card_id is not null
    and w.card_type is not null
  group by w.card_type, w.card_id
  order by count(*) desc, max(w.created_at) desc
  limit 200
$$;

revoke all on function public.want_to_buy_radar() from public;
grant execute on function public.want_to_buy_radar() to anon, authenticated;

comment on function public.want_to_buy_radar() is
  'Agrégat public des recherches en cours (radar Want to Buy). SECURITY DEFINER : '
  'la table reste en lecture propriétaire. Ne rend jamais user_id, max_price ni free_text.';