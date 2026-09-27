-- ═══════════════════════════════════════════════════════════════════════════
-- 0045 — Les fonctions d'écriture passent aux trois axes
--
-- RÉGRESSION RÉPARÉE ICI. `admin_ajouter_variante` insérait
-- `(card_id, variant_type_id)` et rien d'autre. Depuis que 0044 a posé
-- `tirage_id NOT NULL`, tout appel échouait : l'éditeur ne pouvait plus créer
-- une seule variante. Le défaut vient de la migration précédente, pas de
-- l'existant — c'est à elle de le réparer.
--
-- ─── POURQUOI `variant_type_id` DEVIENT NULLABLE ──────────────────────────
--
-- Le brief demande de ne PAS supprimer la colonne, et elle reste. Mais la
-- laisser OBLIGATOIRE forcerait chaque nouvelle écriture à inventer une valeur
-- de l'ancien modèle : « Illimité » et « Normale » retombent tous deux sur
-- `NORMAL`, une finition « Holo Cosmos » n'a aucun équivalent. On écrirait donc
-- une approximation dans une colonne destinée à disparaître.
--
-- La rendre nullable garde les 29 210 valeurs existantes intactes — l'import
-- continue de l'alimenter, donc les exclusions par `(card_id, variant_type_id)`
-- restent opérantes — et laisse les créations manuelles n'écrire que ce qu'on
-- sait vraiment. La suppression de la colonne reste une migration à part.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.pokemon_card_variants
  alter column variant_type_id drop not null;

comment on column public.pokemon_card_variants.variant_type_id is
  'HÉRITAGE, en cours de retrait. Alimentée par l''import pour que les '
  'exclusions restent opérantes ; NULL sur les variantes créées à la main dans '
  'le modèle à trois axes. Le sens vit désormais dans tirage_id / finition_id / '
  'tampon_id.';

-- ── Créer une variante sur les trois axes ──────────────────────────────────
create or replace function public.admin_ajouter_variante_axes(
  p_card_id     uuid,
  p_tirage_id   uuid,
  p_finition_id uuid default null,
  p_tampon_id   uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if p_tirage_id is null then
    raise exception 'Le tirage est obligatoire : c''est lui qui dit quelle impression a été mise en vente.'
      using errcode = 'not_null_violation';
  end if;

  insert into public.pokemon_card_variants (card_id, tirage_id, finition_id, tampon_id, source)
  values (p_card_id, p_tirage_id, p_finition_id, p_tampon_id, 'manuel')
  on conflict (card_id, tirage_id, finition_id, tampon_id) do nothing
  returning id into v_id;

  if v_id is null then
    raise exception 'Cette carte porte déjà cette combinaison tirage / finition / tampon.'
      using errcode = 'unique_violation';
  end if;
  return v_id;
end $$;

-- ── Modifier les axes d'une variante existante ─────────────────────────────
create or replace function public.admin_modifier_axes_variante(
  p_variante_id uuid,
  p_tirage_id   uuid,
  p_finition_id uuid default null,
  p_tampon_id   uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if p_tirage_id is null then
    raise exception 'Le tirage est obligatoire.' using errcode = 'not_null_violation';
  end if;

  -- Édition manuelle : le trigger de verrous laisse passer et ne réécrase pas
  -- `locked_fields`.
  perform set_config('goriki.edition_manuelle', 'on', true);

  update public.pokemon_card_variants
     set tirage_id   = p_tirage_id,
         finition_id = p_finition_id,
         tampon_id   = p_tampon_id,
         source      = 'manuel'
   where id = p_variante_id;

  -- Remis à 'off' AVANT la sortie : `set_config(..., true)` est scopé à la
  -- TRANSACTION, pas à l'appel.
  perform set_config('goriki.edition_manuelle', 'off', true);

  if not found then
    raise exception 'Variante introuvable : %', p_variante_id;
  end if;
end $$;

-- ── Suppression : trace l'exclusion, sinon l'import la recrée ──────────────
create or replace function public.supprimer_variante(
  p_variante uuid,
  p_cible    uuid default null
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n_total int; n_stock int; v_depart smallint;
  v_card uuid; v_type uuid;
begin
  -- Retenus AVANT la suppression : après, la ligne n'existe plus et l'exclusion
  -- ne pourrait plus être écrite.
  select card_id, variant_type_id into v_card, v_type
    from public.pokemon_card_variants where id = p_variante;

  select count(*), count(*) filter (where quantity > 0)
    into n_total, n_stock
    from public.pokemon_listings where variant_id = p_variante;

  if n_stock > 0 then
    if p_cible is null then
      raise exception
        'Variante % : % exemplaire(s) avec du stock. Fournir une variante cible pour les déplacer, ou écouler le stock.',
        p_variante, n_stock using errcode = 'foreign_key_violation';
    end if;
    if not exists (select 1 from public.pokemon_card_variants where id = p_cible) then
      raise exception 'Variante cible % inexistante.', p_cible;
    end if;

    -- Renumérotation : la cible a peut-être déjà des exemplaires dans la même
    -- condition, et `(variant_id, condition, copy_index)` est unique.
    select coalesce(max(copy_index), -1) into v_depart
      from public.pokemon_listings where variant_id = p_cible;

    with renum as (
      select id, (v_depart + row_number() over (order by copy_index, id))::smallint as nouveau
        from public.pokemon_listings where variant_id = p_variante
    )
    update public.pokemon_listings l
       set variant_id = p_cible, copy_index = r.nouveau
      from renum r where r.id = l.id;
  else
    -- Aucun stock : les lignes à quantité nulle ne sont pas de l'inventaire.
    delete from public.pokemon_listings where variant_id = p_variante;
  end if;

  delete from public.pokemon_card_variants where id = p_variante;

  -- ── La trace, sans laquelle tout ce travail est défait au prochain import ──
  -- Seulement si la variante portait un type de l'ancien modèle : c'est cette
  -- clé que l'import consulte, et lui seul peut recréer une ligne. Une variante
  -- créée à la main dans le modèle à trois axes n'est connue d'aucun import.
  if v_type is not null then
    insert into public.pokemon_variant_exclusions (card_id, variant_type_id, raison)
    values (v_card, v_type, 'suppression depuis l''éditeur de variantes')
    on conflict (card_id, variant_type_id) do nothing;
  end if;

  return case
    when n_stock > 0 then format('%s exemplaire(s) déplacé(s) vers %s, variante supprimée.', n_total, p_cible)
    else format('Variante supprimée (%s exemplaire(s) sans stock retiré(s)).', n_total)
  end;
end $$;

revoke all on function public.admin_ajouter_variante_axes(uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.admin_modifier_axes_variante(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.admin_ajouter_variante_axes(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.admin_modifier_axes_variante(uuid, uuid, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
