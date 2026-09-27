-- ═══════════════════════════════════════════════════════════════════════════
-- 0051 — La file passe de 8,2 s à un temps utilisable
--
-- MESURÉ, pas supposé : `explain analyze` sur `admin_file_reconciliation`
-- donnait 8 245 ms. La cause était dans la vue, qui portait QUATRE sous-requêtes
-- corrélées évaluées pour chacune des 35 386 variantes des sets couverts —
-- dont `checklist_annonce`, qui redépliait les 34 683 numéros de la cible à
-- chaque ligne.
--
-- Or ces champs ne servent QUE sur les 50 lignes affichées. La vue ne fait donc
-- plus que détecter l'écart ; l'enrichissement se fait dans la RPC, APRÈS le
-- `limit`. Le compte total ne parcourt plus qu'une vue légère.
--
-- `exemplaires` reste dans la vue : c'est un critère de FILTRE, il doit être
-- connu avant de limiter. Il passe d'une sous-requête corrélée à une jointure
-- sur un agrégat calculé une seule fois.
-- ═══════════════════════════════════════════════════════════════════════════

create index if not exists pokemon_listings_variant_idx on public.pokemon_listings(variant_id);

drop view if exists public.v_ecarts_checklist;

create view public.v_ecarts_checklist as
with cible as (
  select cc.set_code, cc.tirage, cc.finition, cc.tampon,
         regexp_replace(btrim(n), '^0+(?=.)', '') as numero
  from public.checklist_cible cc
  cross join lateral unnest(string_to_array(cc.numeros, ',')) as n
),
stock as (
  select variant_id, count(*)::bigint as n
  from public.pokemon_listings group by variant_id
)
select
  v.id as variante_id, v.card_id,
  v.tirage_id, v.finition_id, v.tampon_id,
  s.id as set_id, s.code as set_code, s.name_fr as set_nom, s.serie_name as serie,
  c.number as numero, regexp_replace(c.number, '^0+(?=.)', '') as numero_norm,
  c.name_fr as carte, c.rarity as rarete, c.image_url,
  ti.label as tirage_label, fi.label as finition_label, ta.label as tampon_label,
  coalesce(st.n, 0) as exemplaires,
  case
    when ti.code = 'NORMALE' and fi.code = 'HOLO' then 'doublon_holo'
    when ti.code = 'NORMALE'          then 'normale_inconnue'
    when ti.code = 'REVERSE'          then 'reverse_inconnue'
    when ti.code = 'PREMIERE_EDITION' then 'premiere_edition_inconnue'
    when ti.code = 'ILLIMITE'         then 'illimite_inconnu'
    else 'autre'
  end as famille
from public.pokemon_card_variants v
join public.pokemon_cards c on c.id = v.card_id
join public.pokemon_sets  s on s.id = c.set_id
join public.pokemon_variant_tirages ti on ti.id = v.tirage_id
left join public.pokemon_variant_finitions fi on fi.id = v.finition_id
left join public.pokemon_variant_tampons  ta on ta.id = v.tampon_id
left join stock st on st.variant_id = v.id
where s.code in (select set_code from public.checklist_cible)
  and not exists (
    select 1 from cible cb
     where cb.set_code = s.code
       and cb.numero   = regexp_replace(c.number, '^0+(?=.)', '')
       and cb.tirage   = ti.code
       and cb.finition is not distinct from fi.code
       and cb.tampon   is not distinct from ta.code)
  and not exists (
    select 1 from public.pokemon_variant_conserves k where k.variante_id = v.id);

comment on view public.v_ecarts_checklist is
  'Variantes présentes en base et absentes de checklist_cible, sur les sets '
  'couverts. Volontairement LÉGÈRE : l''enrichissement coûteux vit dans les '
  'RPC, après limitation — il ne sert que sur les lignes affichées.';

-- ── La jumelle, calculée à la demande ──────────────────────────────────────
-- Même carte, même tirage, même tampon, SANS finition. Le NOMBRE trouvé est
-- rendu autant que l'id : à deux jumelles, on ne devine pas laquelle.
create or replace function public.jumelle_sans_finition(p_variante uuid)
returns table (jumelle_id uuid, jumelles_trouvees bigint)
language sql
stable
as $$
  select (array_agg(j.id))[1], count(*)
  from public.pokemon_card_variants v
  join public.pokemon_card_variants j
    on j.card_id = v.card_id
   and j.tirage_id = v.tirage_id
   and j.tampon_id is not distinct from v.tampon_id
   and j.finition_id is null
   and j.id <> v.id
  where v.id = p_variante;
$$;

-- ── Ce que la checklist annonce pour une carte, à la demande ───────────────
create or replace function public.annonce_checklist(p_set_code text, p_numero_norm text)
returns text
language sql
stable
as $$
  select string_agg(distinct
           ti.label || coalesce(' · ' || fi.label, '') || coalesce(' · ' || ta.label, ''), ', ')
  from public.checklist_cible cc
  cross join lateral unnest(string_to_array(cc.numeros, ',')) as n
  left join public.pokemon_variant_tirages   ti on ti.code = cc.tirage
  left join public.pokemon_variant_finitions fi on fi.code = cc.finition
  left join public.pokemon_variant_tampons   ta on ta.code = cc.tampon
  where cc.set_code = p_set_code
    and regexp_replace(btrim(n), '^0+(?=.)', '') = p_numero_norm;
$$;

-- ── Les variantes d'une carte, en notation lisible ─────────────────────────
create or replace function public.notation_variantes_carte(p_card_id uuid)
returns text
language sql
stable
as $$
  select string_agg(
           ti.label || coalesce(' · ' || fi.label, '') || coalesce(' · ' || ta.label, '')
           || case when sc.n > 0 then ' [' || sc.n || ' ex.]' else '' end,
           ' | ' order by ti.sort_order)
  from public.pokemon_card_variants v
  join public.pokemon_variant_tirages ti on ti.id = v.tirage_id
  left join public.pokemon_variant_finitions fi on fi.id = v.finition_id
  left join public.pokemon_variant_tampons  ta on ta.id = v.tampon_id
  cross join lateral (select count(*)::bigint n from public.pokemon_listings l where l.variant_id = v.id) sc
  where v.card_id = p_card_id;
$$;

-- ── Lecture paginée, enrichie APRÈS limitation ─────────────────────────────
create or replace function public.admin_file_reconciliation(
  p_famille  text default null,
  p_stock    text default null,
  p_set_code text default null,
  p_serie    text default null,
  p_rarete   text default null,
  p_tirage   text default null,
  p_limite   int  default 50,
  p_offset   int  default 0
)
returns table (
  variante_id uuid, set_code text, set_nom text, serie text,
  numero text, carte text, rarete text, image_url text,
  tirage_label text, finition_label text, tampon_label text,
  exemplaires bigint, jumelle_id uuid, jumelles_trouvees bigint,
  checklist_annonce text, famille text,
  variantes_de_la_carte text, total bigint
)
language sql
security definer
set search_path to 'public'
as $$
  with filtre as materialized (
    select e.* from v_ecarts_checklist e
     where public.is_admin()
       and (p_famille  is null or e.famille = p_famille)
       and (p_stock    is null or (p_stock = 'avec' and e.exemplaires > 0)
                              or (p_stock = 'sans' and e.exemplaires = 0))
       and (p_set_code is null or e.set_code = p_set_code)
       and (p_serie    is null or e.serie = p_serie)
       and (p_rarete   is null or e.rarete = p_rarete)
       and (p_tirage   is null or e.tirage_label = p_tirage)
  ),
  page as (
    select f.* from filtre f
     order by (f.exemplaires > 0) desc, f.set_code, f.numero
     limit greatest(1, least(coalesce(p_limite, 50), 200))
     offset greatest(0, coalesce(p_offset, 0))
  )
  select
    p.variante_id, p.set_code, p.set_nom, p.serie,
    p.numero, p.carte, p.rarete, p.image_url,
    p.tirage_label, p.finition_label, p.tampon_label,
    p.exemplaires, j.jumelle_id, j.jumelles_trouvees,
    public.annonce_checklist(p.set_code, p.numero_norm),
    p.famille,
    public.notation_variantes_carte(p.card_id),
    (select count(*) from filtre)
  from page p
  left join lateral public.jumelle_sans_finition(p.variante_id) j on true
  order by (p.exemplaires > 0) desc, p.set_code, p.numero;
$$;

revoke all on function public.admin_file_reconciliation(text,text,text,text,text,text,int,int) from public, anon;
revoke all on function public.jumelle_sans_finition(uuid) from public, anon;
revoke all on function public.annonce_checklist(text, text) from public, anon;
revoke all on function public.notation_variantes_carte(uuid) from public, anon;
grant execute on function public.admin_file_reconciliation(text,text,text,text,text,text,int,int) to authenticated;
grant execute on function public.jumelle_sans_finition(uuid) to authenticated;
grant execute on function public.annonce_checklist(text, text) to authenticated;
grant execute on function public.notation_variantes_carte(uuid) to authenticated;

notify pgrst, 'reload schema';
