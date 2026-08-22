-- ─────────────────────────────────────────────────────────────────────────────
-- Admin : vue d'ensemble des sets pour le navigateur de listings
--
-- Le navigateur affiche, pour CHAQUE set des deux univers : nombre total de
-- listings, combien ont du stock, combien n'ont pas encore de prix, combien
-- attendent une photo. Sans agrégation côté base, il faudrait rapatrier les
-- ~31 000 listings pour les compter en JavaScript à chaque affichage.
--
-- `SECURITY DEFINER` + garde `is_admin()` À L'INTÉRIEUR : la fonction refuse de
-- répondre à un non-admin, quelles que soient les policies des tables. Elle
-- expose des données de gestion (listings inactifs, prix manquants) qui ne
-- doivent jamais sortir côté client.
--
-- ⚠️ « Prix manquant » = `price = 0`. Il n'existe PAS de colonne
-- `price_override` : `price` est NOT NULL et vaut 0 tant que rien n'a été saisi.
-- C'est la même définition que celle du parcours public, où une pièce n'est
-- vendable que si `is_active AND quantity > 0 AND price > 0`.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.admin_sets_overview()
returns table (
  universe    text,
  set_id      uuid,
  code        text,
  name_fr     text,
  serie_name  text,
  total       bigint,
  avec_stock  bigint,
  sans_prix   bigint,
  sans_photo  bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select 'pokemon'::text, s.id, s.code, s.name_fr, s.serie_name,
         count(l.id)::bigint,
         count(l.id) filter (where l.quantity > 0)::bigint,
         count(l.id) filter (where l.quantity > 0 and l.price <= 0)::bigint,
         count(l.id) filter (where l.needs_photo)::bigint
  from public.pokemon_sets s
  left join public.pokemon_cards c on c.set_id = s.id
  left join public.pokemon_listings l on l.card_id = c.id
  where public.is_admin()
  group by s.id, s.code, s.name_fr, s.serie_name

  union all

  select 'onepiece'::text, s.id, s.code, s.name_fr, s.serie_name,
         count(l.id)::bigint,
         count(l.id) filter (where l.quantity > 0)::bigint,
         count(l.id) filter (where l.quantity > 0 and l.price <= 0)::bigint,
         count(l.id) filter (where l.needs_photo)::bigint
  from public.onepiece_sets s
  left join public.onepiece_cards c on c.set_id = s.id
  left join public.onepiece_listings l on l.card_id = c.id
  where public.is_admin()
  group by s.id, s.code, s.name_fr, s.serie_name
$$;

revoke all on function public.admin_sets_overview() from public, anon;
grant execute on function public.admin_sets_overview() to authenticated;

comment on function public.admin_sets_overview() is
  'Compteurs par set pour le navigateur admin des listings. SECURITY DEFINER, '
  'gardée par is_admin() : ne répond rien à un non-admin. « sans_prix » = price <= 0.';