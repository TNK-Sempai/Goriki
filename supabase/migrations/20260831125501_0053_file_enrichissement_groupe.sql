-- ═══════════════════════════════════════════════════════════════════════════
-- 0053 — L'enrichissement se fait en DEUX passes, pas en cent appels
--
-- Mesuré : la vue ne coûte que 227 ms, mais `admin_file_reconciliation` en
-- prenait 5 439. La différence venait des fonctions appelées ligne par ligne —
-- `annonce_checklist` seule coûte 38 ms par appel, soit ~1,9 s pour 50 lignes,
-- et autant pour la notation des variantes.
--
-- Une fonction scalaire par ligne se replanifie à chaque appel et ne peut rien
-- partager. Deux CTE groupées, restreintes aux seuls sets et cartes de la PAGE,
-- font le même travail en une passe chacune.
--
-- Les fonctions restent en place : `admin_apercu_reconciliation` et
-- `admin_reconcilier` les appellent sur une poignée d'ids, où le coût unitaire
-- est sans conséquence.
-- ═══════════════════════════════════════════════════════════════════════════

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
  page as materialized (
    select f.* from filtre f
     order by (f.exemplaires > 0) desc, f.set_code, f.numero
     limit greatest(1, least(coalesce(p_limite, 50), 200))
     offset greatest(0, coalesce(p_offset, 0))
  ),
  -- Ce que la checklist annonce, pour les seules cartes de la page.
  annonces as (
    select cb.set_code, cb.numero,
           string_agg(distinct
             ti.label || coalesce(' · ' || fi.label, '') || coalesce(' · ' || ta.label, ''), ', ') as annonce
    from (
      select cc.set_code, cc.tirage, cc.finition, cc.tampon,
             regexp_replace(btrim(n), '^0+(?=.)', '') as numero
      from checklist_cible cc
      cross join lateral unnest(string_to_array(cc.numeros, ',')) as n
      where cc.set_code in (select distinct set_code from page)
    ) cb
    join page p on p.set_code = cb.set_code and p.numero_norm = cb.numero
    left join pokemon_variant_tirages   ti on ti.code = cb.tirage
    left join pokemon_variant_finitions fi on fi.code = cb.finition
    left join pokemon_variant_tampons   ta on ta.code = cb.tampon
    group by cb.set_code, cb.numero
  ),
  -- Toutes les variantes des cartes de la page, en notation lisible.
  notations as (
    select v.card_id,
           string_agg(
             ti.label || coalesce(' · ' || fi.label, '') || coalesce(' · ' || ta.label, '')
             || case when coalesce(sc.n, 0) > 0 then ' [' || sc.n || ' ex.]' else '' end,
             ' | ' order by ti.sort_order) as notation
    from pokemon_card_variants v
    join pokemon_variant_tirages ti on ti.id = v.tirage_id
    left join pokemon_variant_finitions fi on fi.id = v.finition_id
    left join pokemon_variant_tampons  ta on ta.id = v.tampon_id
    left join (select variant_id, count(*)::bigint n from pokemon_listings group by variant_id) sc
      on sc.variant_id = v.id
    where v.card_id in (select card_id from page)
    group by v.card_id
  ),
  -- La jumelle, pour les seules variantes de la page.
  jumelles as (
    select p.variante_id,
           (array_agg(j.id))[1] as jumelle_id,
           count(j.id) as jumelles_trouvees
    from page p
    join pokemon_card_variants v on v.id = p.variante_id
    left join pokemon_card_variants j
      on j.card_id = v.card_id
     and j.tirage_id = v.tirage_id
     and j.tampon_id is not distinct from v.tampon_id
     and j.finition_id is null
     and j.id <> v.id
    group by p.variante_id
  )
  select
    p.variante_id, p.set_code, p.set_nom, p.serie,
    p.numero, p.carte, p.rarete, p.image_url,
    p.tirage_label, p.finition_label, p.tampon_label,
    p.exemplaires, ju.jumelle_id, coalesce(ju.jumelles_trouvees, 0),
    a.annonce, p.famille, no.notation,
    (select count(*) from filtre)
  from page p
  left join annonces a on a.set_code = p.set_code and a.numero = p.numero_norm
  left join notations no on no.card_id = p.card_id
  left join jumelles ju on ju.variante_id = p.variante_id
  order by (p.exemplaires > 0) desc, p.set_code, p.numero;
$$;

revoke all on function public.admin_file_reconciliation(text,text,text,text,text,text,int,int) from public, anon;
grant execute on function public.admin_file_reconciliation(text,text,text,text,text,text,int,int) to authenticated;

notify pgrst, 'reload schema';
