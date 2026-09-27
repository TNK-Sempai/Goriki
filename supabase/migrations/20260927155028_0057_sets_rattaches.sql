-- ═══════════════════════════════════════════════════════════════════════════
-- 0057 : Sets rattachés (regroupement d'AFFICHAGE)
--
-- TCGdex découpe certains produits commerciaux en plusieurs sets. Premier cas :
-- le 30ᵉ Anniversaire Pokémon, livré en 30TH (161 cartes) et 30TH-C, la
-- Collection Classique (30 cartes). En boutique, c'est un seul produit de
-- 191 cartes.
--
-- Les deux sets RESTENT SÉPARÉS en base : l'import TCGdex upserte sur `code`,
-- fusionner les lignes ferait recréer 30TH-C au prochain import. On ne fait
-- que déclarer un rattachement :
--
--   display_parent_id  NULL      set affiché pour lui-même (cas général)
--                      <uuid>    set affiché DANS son parent, en fin de liste
--
-- Déclarer un autre cas plus tard ne demande aucun code :
--   update public.pokemon_sets
--      set display_parent_id = (select id from public.pokemon_sets where code = 'PARENT')
--    where code = 'ENFANT';
--
-- L'import ne touche jamais cette colonne : `upsertSet` ne l'envoie pas, et un
-- upsert PostgREST ne met à jour que les colonnes fournies.
--
-- Un seul niveau : un parent ne peut pas être lui-même rattaché, et un set qui
-- a des rattachés ne peut pas devenir rattaché. Le trigger le garantit.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.pokemon_sets
  add column if not exists display_parent_id uuid
    references public.pokemon_sets(id) on delete set null,
  add constraint pokemon_sets_parent_pas_soi
    check (display_parent_id is distinct from id);

alter table public.onepiece_sets
  add column if not exists display_parent_id uuid
    references public.onepiece_sets(id) on delete set null,
  add constraint onepiece_sets_parent_pas_soi
    check (display_parent_id is distinct from id);

create index if not exists pokemon_sets_display_parent_idx
  on public.pokemon_sets (display_parent_id) where display_parent_id is not null;
create index if not exists onepiece_sets_display_parent_idx
  on public.onepiece_sets (display_parent_id) where display_parent_id is not null;

comment on column public.pokemon_sets.display_parent_id is
  'Regroupement d''affichage boutique : ce set est présenté dans son parent, '
  'en fin de liste. NULL = set affiché pour lui-même. Un seul niveau.';
comment on column public.onepiece_sets.display_parent_id is
  'Regroupement d''affichage boutique : ce set est présenté dans son parent, '
  'en fin de liste. NULL = set affiché pour lui-même. Un seul niveau.';

-- ─── Un seul niveau de rattachement ─────────────────────────────────────────
create or replace function public.sets_rattachement_un_niveau()
returns trigger
language plpgsql
set search_path to 'public', 'extensions'
as $$
declare
  parent_du_parent uuid;
  a_des_rattaches  boolean;
begin
  if new.display_parent_id is null then
    return new;
  end if;

  execute format('select display_parent_id from public.%I where id = $1', tg_table_name)
    into parent_du_parent using new.display_parent_id;
  if parent_du_parent is not null then
    raise exception 'Le set parent est lui-même rattaché : un seul niveau est permis.';
  end if;

  execute format('select exists (select 1 from public.%I where display_parent_id = $1)', tg_table_name)
    into a_des_rattaches using new.id;
  if a_des_rattaches then
    raise exception 'Ce set a déjà des sets rattachés : il ne peut pas être rattaché à son tour.';
  end if;

  return new;
end $$;

drop trigger if exists pkm_sets_rattachement on public.pokemon_sets;
create trigger pkm_sets_rattachement
  before insert or update of display_parent_id on public.pokemon_sets
  for each row execute function public.sets_rattachement_un_niveau();

drop trigger if exists op_sets_rattachement on public.onepiece_sets;
create trigger op_sets_rattachement
  before insert or update of display_parent_id on public.onepiece_sets
  for each row execute function public.sets_rattachement_un_niveau();

-- ─── Premier cas déclaré : 30TH-C dans 30TH ─────────────────────────────────
update public.pokemon_sets
   set display_parent_id = (select id from public.pokemon_sets where code = '30TH')
 where code = '30TH-C';

-- ─── Nom de 30TH-C corrigé, et VERROUILLÉ ───────────────────────────────────
-- TCGdex livre « Collection Classique30ᵉ Anniversaire » (espace manquant), et
-- `upsertSet` réécrit `name_fr` à chaque import. Sans verrou, la correction
-- serait perdue au prochain passage : `verrous_pokemon_sets` rétablit le nom
-- dès que `name_fr` figure dans `locked_fields`. Le mode d'édition manuelle est
-- le seul qui autorise à écrire `locked_fields` (même chemin que l'admin).
select set_config('goriki.edition_manuelle', 'on', true);

update public.pokemon_sets
   set name_fr = 'Collection Classique 30ᵉ Anniversaire',
       locked_fields = case
         when 'name_fr' = any(locked_fields) then locked_fields
         else array_append(locked_fields, 'name_fr')
       end
 where code = '30TH-C';

select set_config('goriki.edition_manuelle', 'off', true);

-- ─── Recherche : un set rattaché se présente sous son parent ────────────────
-- Reprise intégrale de `search_catalogue` (0034, 0035, 0037). Deux changements :
--   · branches SET : un rattaché qui correspond renvoie son PARENT (id, nom,
--     code). « classique » trouve donc le 30ᵉ Anniversaire, et la déduplication
--     finale sur (type, id) fond les deux en une seule entrée ;
--   · branches CARTE : `set_id` et `sous_titre` désignent le parent, pour que
--     le lien mène directement à la page regroupée. `code` et `numero` restent
--     ceux du set réel : c'est la référence imprimée sur la carte.
create or replace function public.search_catalogue(terme text, limite integer default 40)
returns table(type text, id uuid, titre text, sous_titre text, numero text, code text,
              set_id uuid, universe text, image_url text, rarete text, en_stock boolean,
              rang integer, score real)
language plpgsql
stable parallel safe
set search_path to 'public', 'extensions'
as $function$
declare
  t  text := public.goriki_normalise(btrim(terme));
  tc text;
begin
  if t is null or char_length(t) < 2 then
    return;
  end if;
  tc := replace(replace(t, ' ', ''), '-', '');

  return query
  with resultats as (
    select 'carte_pokemon'::text as type, c.id, c.name_fr as titre,
           coalesce(ps.name_fr, s.name_fr) as sous_titre, c.number as numero, s.code as code,
           coalesce(s.display_parent_id, c.set_id) as set_id, 'pokemon'::text as universe,
           c.image_url, c.rarity as rarete,
           -- Le stock est porté par l'EXEMPLAIRE, rattaché à la carte via la variante.
           exists (select 1 from public.pokemon_listings l
                     join public.pokemon_card_variants v on v.id = l.variant_id
                    where v.card_id = c.id and l.is_active
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
      left join public.pokemon_sets ps on ps.id = s.display_parent_id
     where public.goriki_normalise(c.name_fr) like '%' || t || '%'
        or public.goriki_normalise(c.name_fr) % t
        or public.goriki_normalise(c.number) = t

    union all
    select 'carte_pokemon', c.id, c.name_fr, coalesce(ps.name_fr, s.name_fr), c.number, s.code,
           coalesce(s.display_parent_id, c.set_id), 'pokemon', c.image_url, c.rarity,
           exists (select 1 from public.pokemon_listings l
                     join public.pokemon_card_variants v on v.id = l.variant_id
                    where v.card_id = c.id and l.is_active
                      and l.quantity > 0 and l.price > 0),
           0, 1.0::real
      from public.pokemon_sets s
      left join public.pokemon_sets ps on ps.id = s.display_parent_id
      join public.pokemon_cards c
        on c.set_id = s.id
       and public.goriki_normalise(c.number)
           = substr(tc, char_length(public.goriki_normalise(s.code)) + 1)
     where starts_with(tc, public.goriki_normalise(s.code))
       and char_length(tc) > char_length(public.goriki_normalise(s.code))

    union all
    select 'carte_onepiece', c.id, c.name_fr, coalesce(ps.name_fr, s.name_fr), c.number, s.code,
           coalesce(s.display_parent_id, c.set_id), 'onepiece', c.image_url, c.rarity,
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
      left join public.onepiece_sets ps on ps.id = s.display_parent_id
     where public.goriki_normalise(c.name_fr) like '%' || t || '%'
        or public.goriki_normalise(c.name_fr) % t
        or public.goriki_normalise(c.number) = t

    union all
    select 'carte_onepiece', c.id, c.name_fr, coalesce(ps.name_fr, s.name_fr), c.number, s.code,
           coalesce(s.display_parent_id, c.set_id), 'onepiece', c.image_url, c.rarity,
           exists (select 1 from public.onepiece_listings l
                    where l.card_id = c.id and l.is_active
                      and l.quantity > 0 and l.price > 0),
           0, 1.0::real
      from public.onepiece_sets s
      left join public.onepiece_sets ps on ps.id = s.display_parent_id
      join public.onepiece_cards c
        on c.set_id = s.id
       and public.goriki_normalise(c.number)
           = substr(tc, char_length(public.goriki_normalise(s.code)) + 1)
     where starts_with(tc, public.goriki_normalise(s.code))
       and char_length(tc) > char_length(public.goriki_normalise(s.code))

    union all
    select 'set_pokemon', coalesce(ps.id, s.id), coalesce(ps.name_fr, s.name_fr),
           coalesce(ps.code, s.code), null, coalesce(ps.code, s.code),
           coalesce(ps.id, s.id), 'pokemon', coalesce(ps.image_url, s.image_url), null, false,
           case
             when public.goriki_normalise(s.code) = t then 0
             when public.goriki_normalise(s.name_fr) = t then 1
             when public.goriki_normalise(s.name_fr) like t || '%' then 2
             when public.goriki_normalise(s.name_fr) like '%' || t || '%' then 3
             else 4
           end,
           similarity(public.goriki_normalise(s.name_fr), t)
      from public.pokemon_sets s
      left join public.pokemon_sets ps on ps.id = s.display_parent_id
     where s.is_active
       and coalesce(ps.is_active, true)
       and (public.goriki_normalise(s.name_fr) like '%' || t || '%'
         or public.goriki_normalise(s.name_fr) % t
         or public.goriki_normalise(s.code) = t)

    union all
    select 'set_onepiece', coalesce(ps.id, s.id), coalesce(ps.name_fr, s.name_fr),
           coalesce(ps.code, s.code), null, coalesce(ps.code, s.code),
           coalesce(ps.id, s.id), 'onepiece', coalesce(ps.image_url, s.image_url), null, false,
           case
             when public.goriki_normalise(s.code) = t then 0
             when public.goriki_normalise(s.name_fr) = t then 1
             when public.goriki_normalise(s.name_fr) like t || '%' then 2
             when public.goriki_normalise(s.name_fr) like '%' || t || '%' then 3
             else 4
           end,
           similarity(public.goriki_normalise(s.name_fr), t)
      from public.onepiece_sets s
      left join public.onepiece_sets ps on ps.id = s.display_parent_id
     where s.is_active
       and coalesce(ps.is_active, true)
       and (public.goriki_normalise(s.name_fr) like '%' || t || '%'
         or public.goriki_normalise(s.name_fr) % t
         or public.goriki_normalise(s.code) = t)

    union all
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
$function$;
