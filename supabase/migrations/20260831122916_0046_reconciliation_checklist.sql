-- ═══════════════════════════════════════════════════════════════════════════
-- 0046 — Réconciliation catalogue ↔ checklists
--
-- ⚠️ NORMALISATION DES NUMÉROS, SANS QUOI TOUT EST FAUX. `checklist_cible`
-- n'écrit AUCUN zéro de tête (34 683 numéros, zéro padding) ; la base en porte
-- 2 951 sur 19 641 cartes. Comparer les chaînes telles quelles fait passer pour
-- « inconnu de la checklist » chaque variante d'un set moderne : mesuré, 7 560
-- faux écarts au lieu de 1 599. La normalisation n'est pas une commodité, c'est
-- la condition de justesse de tout cet écran.
--
-- ─── FINITION NULL N'EST PAS UNE LACUNE ───────────────────────────────────
-- `finition_id IS NULL` = la finition normale de la rareté de la carte. Une
-- commune n'est pas holo, une Rare Holo l'est, et on ne l'écrit pas. La
-- comparaison utilise donc `IS NOT DISTINCT FROM` : NULL doit s'apparier à NULL,
-- pas être traité comme une valeur manquante.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Décisions de conservation ──────────────────────────────────────────────
-- Une variante absente de la checklist peut être légitime. Le motif est
-- OBLIGATOIRE : sans lui, la ligne sortirait de la file sans que personne ne
-- puisse dire pourquoi six mois plus tard.
create table if not exists public.pokemon_variant_conserves (
  variante_id uuid primary key references public.pokemon_card_variants(id) on delete cascade,
  motif       text not null check (btrim(motif) <> ''),
  created_at  timestamptz not null default now()
);

comment on table public.pokemon_variant_conserves is
  'Variantes jugées légitimes malgré leur absence de la checklist. Sortent '
  'définitivement de la file de réconciliation. Le motif est obligatoire.';

alter table public.pokemon_variant_conserves enable row level security;
drop policy if exists "Conserves — admin" on public.pokemon_variant_conserves;
create policy "Conserves — admin" on public.pokemon_variant_conserves
  for all using (public.is_admin()) with check (public.is_admin());

-- ── La vue des écarts, source unique ───────────────────────────────────────
-- Une seule définition, partagée par la lecture et par les garde-fous
-- d'écriture. Deux définitions auraient fini par diverger, et l'écran aurait
-- proposé des actions sur des lignes que le serveur ne reconnaît plus.
create or replace view public.v_ecarts_checklist as
with cible as (
  select cc.set_code, cc.tirage, cc.finition, cc.tampon,
         regexp_replace(btrim(n), '^0+(?=.)', '') as numero
  from public.checklist_cible cc,
       lateral unnest(string_to_array(cc.numeros, ',')) as n
),
reelles as (
  select
    v.id as variante_id, v.card_id,
    v.tirage_id, v.finition_id, v.tampon_id,
    s.id as set_id, s.code as set_code, s.name_fr as set_nom, s.serie_name as serie,
    c.number as numero, regexp_replace(c.number, '^0+(?=.)', '') as numero_norm,
    c.name_fr as carte, c.rarity as rarete, c.image_url,
    ti.code as tirage_code, ti.label as tirage_label,
    fi.code as finition_code, fi.label as finition_label,
    ta.code as tampon_code, ta.label as tampon_label,
    (select count(*) from public.pokemon_listings l where l.variant_id = v.id) as exemplaires
  from public.pokemon_card_variants v
  join public.pokemon_cards c on c.id = v.card_id
  join public.pokemon_sets  s on s.id = c.set_id
  join public.pokemon_variant_tirages ti on ti.id = v.tirage_id
  left join public.pokemon_variant_finitions fi on fi.id = v.finition_id
  left join public.pokemon_variant_tampons  ta on ta.id = v.tampon_id
  where s.code in (select set_code from public.checklist_cible)
)
select
  r.*,
  -- La jumelle : même carte, même tirage, même tampon, SANS finition. C'est
  -- elle qui recueille les exemplaires du doublon `Normale · holo`.
  (select j.id from public.pokemon_card_variants j
    where j.card_id = r.card_id
      and j.tirage_id = r.tirage_id
      and j.tampon_id is not distinct from r.tampon_id
      and j.finition_id is null
      and j.id <> r.variante_id
    limit 1) as jumelle_id,
  -- Ambiguë si plusieurs jumelles répondent : on ne devine pas laquelle.
  (select count(*) from public.pokemon_card_variants j
    where j.card_id = r.card_id
      and j.tirage_id = r.tirage_id
      and j.tampon_id is not distinct from r.tampon_id
      and j.finition_id is null
      and j.id <> r.variante_id) as jumelles_trouvees,
  -- Ce que la checklist annonce pour CETTE carte, en clair.
  (select string_agg(distinct
            ti2.label || coalesce(' · ' || fi2.label, '') || coalesce(' · ' || ta2.label, ''), ', ')
     from cible cb
     left join public.pokemon_variant_tirages   ti2 on ti2.code = cb.tirage
     left join public.pokemon_variant_finitions fi2 on fi2.code = cb.finition
     left join public.pokemon_variant_tampons   ta2 on ta2.code = cb.tampon
    where cb.set_code = r.set_code and cb.numero = r.numero_norm) as checklist_annonce,
  case
    when r.tirage_code = 'NORMALE' and r.finition_code = 'HOLO' then 'doublon_holo'
    when r.tirage_code = 'NORMALE'          then 'normale_inconnue'
    when r.tirage_code = 'REVERSE'          then 'reverse_inconnue'
    when r.tirage_code = 'PREMIERE_EDITION' then 'premiere_edition_inconnue'
    when r.tirage_code = 'ILLIMITE'         then 'illimite_inconnu'
    else 'autre'
  end as famille
from reelles r
where not exists (
  select 1 from cible c
   where c.set_code = r.set_code
     and c.numero   = r.numero_norm
     and c.tirage   = r.tirage_code
     and c.finition is not distinct from r.finition_code
     and c.tampon   is not distinct from r.tampon_code
)
and not exists (
  select 1 from public.pokemon_variant_conserves k where k.variante_id = r.variante_id
);

comment on view public.v_ecarts_checklist is
  'Variantes présentes en base et absentes de checklist_cible, sur les sets '
  'couverts par la cible. Les variantes conservées avec motif en sont exclues.';

-- ── Lecture paginée ────────────────────────────────────────────────────────
create or replace function public.admin_file_reconciliation(
  p_famille  text default null,
  p_stock    text default null,   -- 'avec' | 'sans' | null
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
  with filtre as (
    select e.* from v_ecarts_checklist e
     where public.is_admin()
       and (p_famille  is null or e.famille = p_famille)
       and (p_stock    is null or (p_stock = 'avec' and e.exemplaires > 0)
                              or (p_stock = 'sans' and e.exemplaires = 0))
       and (p_set_code is null or e.set_code = p_set_code)
       and (p_serie    is null or e.serie = p_serie)
       and (p_rarete   is null or e.rarete = p_rarete)
       and (p_tirage   is null or e.tirage_label = p_tirage)
  )
  select
    f.variante_id, f.set_code, f.set_nom, f.serie,
    f.numero, f.carte, f.rarete, f.image_url,
    f.tirage_label, f.finition_label, f.tampon_label,
    f.exemplaires, f.jumelle_id, f.jumelles_trouvees,
    f.checklist_annonce, f.famille,
    -- Toutes les variantes de la carte, en notation lisible : c'est ce qui
    -- permet de décider sans ouvrir un autre écran.
    (select string_agg(
              ti.label || coalesce(' · ' || fi.label, '') || coalesce(' · ' || ta.label, '')
              || case when (select count(*) from pokemon_listings l where l.variant_id = v2.id) > 0
                      then ' [' || (select count(*) from pokemon_listings l where l.variant_id = v2.id) || ' ex.]'
                      else '' end,
              ' | ' order by ti.sort_order)
       from pokemon_card_variants v2
       join pokemon_variant_tirages ti on ti.id = v2.tirage_id
       left join pokemon_variant_finitions fi on fi.id = v2.finition_id
       left join pokemon_variant_tampons  ta on ta.id = v2.tampon_id
      where v2.card_id = f.card_id) as variantes_de_la_carte,
    (select count(*) from filtre) as total
  from filtre f
  -- Tri par défaut : le stock d'abord, c'est lui qui porte le risque.
  order by (f.exemplaires > 0) desc, f.set_code, f.numero
  limit greatest(1, least(coalesce(p_limite, 50), 200))
  offset greatest(0, coalesce(p_offset, 0));
$$;

revoke all on function public.admin_file_reconciliation(text,text,text,text,text,text,int,int) from public, anon;
grant execute on function public.admin_file_reconciliation(text,text,text,text,text,text,int,int) to authenticated;

notify pgrst, 'reload schema';
