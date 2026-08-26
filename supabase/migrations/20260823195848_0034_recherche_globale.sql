-- ─────────────────────────────────────────────────────────────────────────────
-- Recherche globale du catalogue
--
-- LE POINT DUR : les accents. 4 111 cartes Pokémon, 157 One Piece et 80 sets
-- portent un nom accentué (Salamèche, Énergie Obscurité, Écarlate et Violet).
-- Personne ne tape ces accents. Un ILIKE '%salameche%' ne renvoie rien — c'est
-- le mode d'échec principal, il touche près d'un cinquième du catalogue.
--
-- POURQUOI UN WRAPPER IMMUTABLE ET NON UNE COLONNE MAINTENUE PAR TRIGGER :
-- `unaccent()` est STABLE et ne peut donc pas figurer dans un index. Les deux
-- voies étaient ouvertes ; le wrapper l'emporte parce qu'il ne peut pas dériver.
-- Une colonne normalisée demanderait cinq triggers, un backfill de 23 843
-- lignes, et se désynchroniserait au premier chemin d'écriture qui les
-- contourne — l'import en masse ou une écriture MCP. Ici c'est Postgres
-- lui-même qui calcule l'expression indexée : aucune insertion ne peut y
-- échapper, quel que soit le chemin.
--
-- La dictionnaire est ÉPINGLÉE (`'extensions.unaccent'::regdictionary`) : sans
-- ça, déclarer IMMUTABLE serait faux, le résultat dépendant du search_path.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create or replace function public.goriki_normalise(txt text)
returns text
language sql
immutable
parallel safe
strict
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, txt))
$$;

comment on function public.goriki_normalise(text) is
  'Minuscules + sans accents. IMMUTABLE (dictionnaire épinglé) pour pouvoir '
  'servir d''expression indexée — unaccent() seule est STABLE et y est refusée.';

-- ── Index GIN trigram sur les noms normalisés ────────────────────────────────
-- gin_trgm_ops sert À LA FOIS le LIKE '%…%' et l'opérateur de similarité `%`,
-- les deux branches sur lesquelles la recherche s'appuie.
create index if not exists idx_pokemon_cards_nom_trgm
  on public.pokemon_cards using gin (public.goriki_normalise(name_fr) extensions.gin_trgm_ops);
create index if not exists idx_onepiece_cards_nom_trgm
  on public.onepiece_cards using gin (public.goriki_normalise(name_fr) extensions.gin_trgm_ops);
create index if not exists idx_pokemon_sets_nom_trgm
  on public.pokemon_sets using gin (public.goriki_normalise(name_fr) extensions.gin_trgm_ops);
create index if not exists idx_onepiece_sets_nom_trgm
  on public.onepiece_sets using gin (public.goriki_normalise(name_fr) extensions.gin_trgm_ops);
create index if not exists idx_sealed_products_nom_trgm
  on public.sealed_products using gin (public.goriki_normalise(name) extensions.gin_trgm_ops);

-- Numéros et codes : recherche exacte, un btree suffit et coûte moins cher.
create index if not exists idx_pokemon_cards_numero_norm
  on public.pokemon_cards (public.goriki_normalise(number));
create index if not exists idx_onepiece_cards_numero_norm
  on public.onepiece_cards (public.goriki_normalise(number));
create index if not exists idx_pokemon_sets_code_norm
  on public.pokemon_sets (public.goriki_normalise(code));
create index if not exists idx_onepiece_sets_code_norm
  on public.onepiece_sets (public.goriki_normalise(code));

-- ─────────────────────────────────────────────────────────────────────────────
-- search_catalogue
--
-- RANGS DE PERTINENCE, du plus fort au plus faible :
--   0  référence complète — code de set exact, ou « SV10 197 » recollé
--   1  égalité exacte sur le nom normalisé, ou numéro de carte exact
--   2  préfixe
--   3  contenu
--   4  similarité trigram
--
-- POURQUOI LE CODE DE SET EST AU RANG 0 ET LE NUMÉRO DE CARTE AU RANG 1 :
-- « SV10 » est À LA FOIS le code du set Rivalités Destinées ET le numéro d'une
-- carte du set SMA. Sans cette hiérarchie, la carte remonterait avant le set.
--
-- À rang égal : ce qui est EN STOCK d'abord. Une pièce achetable vaut mieux
-- qu'une fiche de catalogue.
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
set pg_trgm.similarity_threshold = 0.4
as $$
declare
  t  text := public.goriki_normalise(btrim(terme));
  tc text;
begin
  -- Moins de deux caractères : on ne balaie pas 23 843 lignes pour une lettre.
  if t is null or char_length(t) < 2 then
    return;
  end if;
  -- Référence recollée : « SV10 197 », « sv10-197 » et « SV10197 » sont le même
  -- besoin exprimé de trois façons.
  tc := replace(replace(t, ' ', ''), '-', '');

  return query
  with resultats as (
    -- ── Cartes Pokémon ──────────────────────────────────────────────────────
    select 'carte_pokemon'::text as type, c.id, c.name_fr as titre,
           s.name_fr as sous_titre, c.number as numero, s.code as code,
           c.set_id, 'pokemon'::text as universe, c.image_url, c.rarity as rarete,
           exists (select 1 from public.pokemon_listings l
                    where l.card_id = c.id and l.is_active
                      and l.quantity > 0 and l.price > 0) as en_stock,
           case
             when public.goriki_normalise(coalesce(s.code,'') || c.number) = tc then 0
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
        or public.goriki_normalise(coalesce(s.code,'') || c.number) = tc

    union all
    -- ── Cartes One Piece ────────────────────────────────────────────────────
    select 'carte_onepiece', c.id, c.name_fr, s.name_fr, c.number, s.code,
           c.set_id, 'onepiece', c.image_url, c.rarity,
           exists (select 1 from public.onepiece_listings l
                    where l.card_id = c.id and l.is_active
                      and l.quantity > 0 and l.price > 0),
           case
             when public.goriki_normalise(coalesce(s.code,'') || c.number) = tc then 0
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
        or public.goriki_normalise(coalesce(s.code,'') || c.number) = tc

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
  )
  select r.type, r.id, r.titre, r.sous_titre, r.numero, r.code, r.set_id,
         r.universe, r.image_url, r.rarete, r.en_stock, r.rang, r.score
    from resultats r
   order by r.rang, r.en_stock desc, r.score desc nulls last, r.titre
   limit greatest(1, least(coalesce(limite, 40), 200));
end;
$$;

comment on function public.search_catalogue(text, int) is
  'Recherche globale insensible aux accents sur cartes, sets et scellés. '
  'Rangs : 0 référence exacte (code de set, « SV10 197 »), 1 égalité, '
  '2 préfixe, 3 contenu, 4 similarité. À rang égal, le stock passe devant.';

-- Le catalogue est déjà en lecture publique (policies « — lecture ») : la
-- fonction reste STABLE et non SECURITY DEFINER, elle n'ouvre donc rien de plus
-- que ce qu'un visiteur peut déjà lire table par table.
grant execute on function public.search_catalogue(text, int) to anon, authenticated;
grant execute on function public.goriki_normalise(text) to anon, authenticated;