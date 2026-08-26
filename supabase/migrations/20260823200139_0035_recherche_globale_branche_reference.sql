-- ─────────────────────────────────────────────────────────────────────────────
-- Correction de `search_catalogue` : la branche « référence » sortait l'index
--
-- DÉFAUT DE LA 0034, mesuré et non supposé. Le prédicat des cartes portait
-- quatre branches OR, dont la dernière traversait DEUX tables :
--
--     goriki_normalise(s.code || c.number) = tc
--
-- Un OR qui référence deux tables ne peut pas devenir une condition d'index sur
-- une seule : le planificateur le dégrade en Join Filter et doit matérialiser la
-- jointure entière. Plan constaté sur « dracaufeu » : Seq Scan sur les 21 891
-- cartes, 21 755 lignes rejetées après jointure, 514 ms.
--
-- Les mêmes prédicats de nom, SEULS, donnaient 12 ms en Bitmap Index Scan sur
-- `idx_pokemon_cards_nom_trgm` : l'index et la normalisation étaient bons, c'est
-- la forme de la requête qui les rendait inutilisables.
--
-- CORRECTION : la branche « référence » devient un membre UNION ALL distinct,
-- amorcé par les SETS (200 lignes Pokémon, 30 One Piece) dont le code normalisé
-- PRÉFIXE le terme recollé ; le reste du terme est cherché comme numéro via
-- l'index btree. Les branches de nom redeviennent mono-table, donc indexables.
--
-- Une carte pouvant remonter par deux branches, on ne garde que son meilleur
-- rang (`distinct on`).
--
-- SEUIL DE SIMILARITÉ : la 0034 posait `SET pg_trgm.similarity_threshold = 0.4`
-- sur la fonction. Ce SET n'était accepté que parce que l'extension était créée
-- dans la même transaction — une fois pg_trgm réellement chargée, ce paramètre
-- est refusé au rôle de migration. On s'en remet donc au seuil par défaut (0,3),
-- légèrement plus permissif sur la branche floue, qui est de toute façon la
-- dernière du classement.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.search_catalogue(terme text, limite int default 40)
returns table (
  type text,
  id uuid,
  titre text,
  sous_titre text,
  numero text,
  code text,
  set_id uuid,
  universe text,
  image_url text,
  rarete text,
  en_stock boolean,
  rang int,
  score real
)
language plpgsql
stable
parallel safe
set search_path = public, extensions
as $$
declare
  t  text := public.goriki_normalise(btrim(terme));
  tc text;
begin
  -- Moins de deux caractères : on ne balaie pas 23 843 lignes pour une lettre.
  if t is null or char_length(t) < 2 then
    return;
  end if;
  -- « SV10 197 », « sv10-197 » et « SV10197 » sont le même besoin.
  tc := replace(replace(t, ' ', ''), '-', '');

  return query
  with resultats as (
    -- ── Cartes Pokémon — prédicats MONO-TABLE, donc indexables ──────────────
    select 'carte_pokemon'::text as type, c.id, c.name_fr as titre,
           s.name_fr as sous_titre, c.number as numero, s.code as code,
           c.set_id, 'pokemon'::text as universe, c.image_url, c.rarity as rarete,
           exists (select 1 from public.pokemon_listings l
                    where l.card_id = c.id and l.is_active
                      and l.quantity > 0 and l.price > 0) as en_stock,
           case
             when public.goriki_normalise(c.number) = t
               or public.goriki_normalise(c.name_fr) = t then 1
             when public.goriki_normalise(c.name_fr) like t || '%' then 2
             when public.goriki_normalise(c.name_fr) like '%' || t || '%' then 3
             else 4
           end as rang,
           similarity(public.goriki_normalise(c.name_fr), t) as score
      from public.pokemon_cards c
      join public.pokemon_sets s on s.id = c.set_id
     where public.goriki_normalise(c.name_fr) like '%' || t || '%'
        or public.goriki_normalise(c.name_fr) % t
        or public.goriki_normalise(c.number) = t

    union all
    -- ── Référence Pokémon « code de set + numéro » ─────────────────────────
    -- Amorcée par les 200 sets, pas par les 21 891 cartes.
    select 'carte_pokemon', c.id, c.name_fr, s.name_fr, c.number, s.code,
           c.set_id, 'pokemon', c.image_url, c.rarity,
           exists (select 1 from public.pokemon_listings l
                    where l.card_id = c.id and l.is_active
                      and l.quantity > 0 and l.price > 0),
           0, 1.0::real
      from public.pokemon_sets s
      join public.pokemon_cards c
        on c.set_id = s.id
       and public.goriki_normalise(c.number)
           = substr(tc, char_length(public.goriki_normalise(s.code)) + 1)
     where starts_with(tc, public.goriki_normalise(s.code))
       and char_length(tc) > char_length(public.goriki_normalise(s.code))

    union all
    -- ── Cartes One Piece ────────────────────────────────────────────────────
    select 'carte_onepiece', c.id, c.name_fr, s.name_fr, c.number, s.code,
           c.set_id, 'onepiece', c.image_url, c.rarity,
           exists (select 1 from public.onepiece_listings l
                    where l.card_id = c.id and l.is_active
                      and l.quantity > 0 and l.price > 0),
           case
             when public.goriki_normalise(c.number) = t
               or public.goriki_normalise(c.name_fr) = t then 1
             when public.goriki_normalise(c.name_fr) like t || '%' then 2
             when public.goriki_normalise(c.name_fr) like '%' || t || '%' then 3
             else 4
           end,
           similarity(public.goriki_normalise(c.name_fr), t)
      from public.onepiece_cards c
      join public.onepiece_sets s on s.id = c.set_id
     where public.goriki_normalise(c.name_fr) like '%' || t || '%'
        or public.goriki_normalise(c.name_fr) % t
        or public.goriki_normalise(c.number) = t

    union all
    -- ── Référence One Piece ─────────────────────────────────────────────────
    select 'carte_onepiece', c.id, c.name_fr, s.name_fr, c.number, s.code,
           c.set_id, 'onepiece', c.image_url, c.rarity,
           exists (select 1 from public.onepiece_listings l
                    where l.card_id = c.id and l.is_active
                      and l.quantity > 0 and l.price > 0),
           0, 1.0::real
      from public.onepiece_sets s
      join public.onepiece_cards c
        on c.set_id = s.id
       and public.goriki_normalise(c.number)
           = substr(tc, char_length(public.goriki_normalise(s.code)) + 1)
     where starts_with(tc, public.goriki_normalise(s.code))
       and char_length(tc) > char_length(public.goriki_normalise(s.code))

    union all
    -- ── Sets Pokémon ────────────────────────────────────────────────────────
    select 'set_pokemon', s.id, s.name_fr, s.code, null, s.code,
           s.id, 'pokemon', s.image_url, null,
           false,
           case
             when public.goriki_normalise(s.code) = t then 0
             when public.goriki_normalise(s.name_fr) = t then 1
             when public.goriki_normalise(s.name_fr) like t || '%' then 2
             when public.goriki_normalise(s.name_fr) like '%' || t || '%' then 3
             else 4
           end,
           similarity(public.goriki_normalise(s.name_fr), t)
      from public.pokemon_sets s
     where s.is_active
       and (public.goriki_normalise(s.name_fr) like '%' || t || '%'
         or public.goriki_normalise(s.name_fr) % t
         or public.goriki_normalise(s.code) = t)

    union all
    -- ── Sets One Piece ──────────────────────────────────────────────────────
    select 'set_onepiece', s.id, s.name_fr, s.code, null, s.code,
           s.id, 'onepiece', s.image_url, null,
           false,
           case
             when public.goriki_normalise(s.code) = t then 0
             when public.goriki_normalise(s.name_fr) = t then 1
             when public.goriki_normalise(s.name_fr) like t || '%' then 2
             when public.goriki_normalise(s.name_fr) like '%' || t || '%' then 3
             else 4
           end,
           similarity(public.goriki_normalise(s.name_fr), t)
      from public.onepiece_sets s
     where s.is_active
       and (public.goriki_normalise(s.name_fr) like '%' || t || '%'
         or public.goriki_normalise(s.name_fr) % t
         or public.goriki_normalise(s.code) = t)

    union all
    -- ── Scellés ─────────────────────────────────────────────────────────────
    select 'scelle', p.id, p.name, p.type, null, null,
           null, p.tcg_type, p.image_url, null,
           p.quantity > 0,
           case
             when public.goriki_normalise(p.name) = t then 1
             when public.goriki_normalise(p.name) like t || '%' then 2
             when public.goriki_normalise(p.name) like '%' || t || '%' then 3
             else 4
           end,
           similarity(public.goriki_normalise(p.name), t)
      from public.sealed_products p
     where p.is_active
       and (public.goriki_normalise(p.name) like '%' || t || '%'
         or public.goriki_normalise(p.name) % t)
  ),
  -- Une carte peut remonter par la branche « nom » ET par la branche
  -- « référence » : on ne garde que son meilleur rang.
  dedup as (
    select distinct on (r.type, r.id) r.*
      from resultats r
     order by r.type, r.id, r.rang, r.score desc nulls last
  )
  select d.type, d.id, d.titre, d.sous_titre, d.numero, d.code, d.set_id,
         d.universe, d.image_url, d.rarete, d.en_stock, d.rang, d.score
    from dedup d
   order by d.rang, d.en_stock desc, d.score desc nulls last, d.titre
   limit greatest(1, least(coalesce(limite, 40), 200));
end;
$$;

comment on function public.search_catalogue(text, int) is
  'Recherche globale insensible aux accents sur cartes, sets et scellés. '
  'Rangs : 0 référence exacte (code de set, « SV10 197 »), 1 égalité, '
  '2 préfixe, 3 contenu, 4 similarité. À rang égal, le stock passe devant. '
  'Les branches de nom sont mono-table pour rester servies par les index GIN.';