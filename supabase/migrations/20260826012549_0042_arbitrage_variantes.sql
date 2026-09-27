-- ═══════════════════════════════════════════════════════════════════════════
-- 0042 — Arbitrage des variantes contradictoires
--
-- Deux fonctions, et rien de plus : la lecture de ce qu'il y a à arbitrer, et
-- l'application d'une décision. Aucune règle automatique n'est encodée ici —
-- la décision vient de l'utilisateur, la base ne fait que l'exécuter et la
-- rendre durable.
--
-- POURQUOI UNE RPC ET PAS TROIS APPELS DEPUIS LE CLIENT. Une décision, c'est
-- supprimer une variante, tracer l'exclusion et marquer la conservée : trois
-- écritures qui doivent tenir ou échouer ENSEMBLE. Une variante supprimée sans
-- son exclusion reviendrait au prochain import ; une exclusion sans suppression
-- masquerait une ligne toujours présente. `supabase-js` ne sait pas ouvrir de
-- transaction — une fonction plpgsql, si, par construction.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Lecture : les cartes portant deux variantes contradictoires ────────────
create or replace function public.admin_variantes_contradictoires(
  p_code_a text,
  p_code_b text
)
returns table (
  card_id uuid, numero text, nom text, rarete text, image_url text,
  set_id uuid, set_code text, set_nom text, serie text,
  type_a_id uuid, type_a_label text, type_a_cree timestamptz, type_a_exemplaires bigint, type_a_source text,
  type_b_id uuid, type_b_label text, type_b_cree timestamptz, type_b_exemplaires bigint, type_b_source text
)
language sql
security definer
set search_path to 'public'
as $$
  with va as (
    select v.card_id, v.id as variante_id, v.created_at, v.source,
           t.id as type_id, t.label, t.code
    from pokemon_card_variants v
    join pokemon_variant_types t on t.id = v.variant_type_id
    where t.code in (p_code_a, p_code_b)
  ),
  stock as (
    select variant_id, count(*)::bigint as n from pokemon_listings group by variant_id
  ),
  paires as (
    select card_id,
           (array_agg(type_id    order by code) filter (where code = p_code_a))[1] as a_type,
           (array_agg(label      order by code) filter (where code = p_code_a))[1] as a_label,
           (array_agg(created_at order by code) filter (where code = p_code_a))[1] as a_cree,
           (array_agg(source     order by code) filter (where code = p_code_a))[1] as a_source,
           (array_agg(variante_id order by code) filter (where code = p_code_a))[1] as a_var,
           (array_agg(type_id    order by code) filter (where code = p_code_b))[1] as b_type,
           (array_agg(label      order by code) filter (where code = p_code_b))[1] as b_label,
           (array_agg(created_at order by code) filter (where code = p_code_b))[1] as b_cree,
           (array_agg(source     order by code) filter (where code = p_code_b))[1] as b_source,
           (array_agg(variante_id order by code) filter (where code = p_code_b))[1] as b_var
    from va
    group by card_id
    having count(distinct code) = 2
  )
  select
    c.id, c.number, c.name_fr, c.rarity, c.image_url,
    s.id, s.code, s.name_fr, s.serie_name,
    p.a_type, p.a_label, p.a_cree, coalesce(sa.n, 0), p.a_source,
    p.b_type, p.b_label, p.b_cree, coalesce(sb.n, 0), p.b_source
  from paires p
  join pokemon_cards c on c.id = p.card_id
  join pokemon_sets  s on s.id = c.set_id
  left join stock sa on sa.variant_id = p.a_var
  left join stock sb on sb.variant_id = p.b_var
  where public.is_admin()
  order by s.release_date nulls last, s.code, c.sort_prefix, c.sort_num, c.number;
$$;

comment on function public.admin_variantes_contradictoires(text, text) is
  'Cartes portant DEUX variantes de types donnés — pour l''écran d''arbitrage. '
  'Les dates de création sont l''information qui décide : un écart de dates '
  'signale une correction de la source entre deux synchronisations.';

-- ── Écriture : appliquer une décision, à l'unité ou au lot ─────────────────
create or replace function public.admin_arbitrer_variantes(
  p_card_ids     uuid[],
  p_types_gardes uuid[],
  p_types_rejetes uuid[],
  p_raison       text default 'arbitrage doublon',
  p_strict       boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_traitees   int := 0;
  v_ignorees   uuid[] := '{}';
  v_card       uuid;
  v_protegee   boolean;
begin
  if not public.is_admin() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  foreach v_card in array coalesce(p_card_ids, '{}') loop
    -- ── Garde-fou : une variante qui porte un exemplaire physique ne se
    -- supprime pas. C'est ICI qu'il vit, pas dans le composant : le client
    -- peut être contourné, la base non. 80 cartes sont dans ce cas.
    select exists (
      select 1
      from pokemon_card_variants v
      join pokemon_listings l on l.variant_id = v.id
      where v.card_id = v_card
        and v.variant_type_id = any (coalesce(p_types_rejetes, '{}'))
    ) into v_protegee;

    if v_protegee then
      if p_strict then
        raise exception
          'Cette variante porte au moins un exemplaire en stock : la supprimer détruirait une pièce physique. Déplacez d''abord les exemplaires.'
          using errcode = 'check_violation';
      end if;
      -- En lot, on n'échoue pas : on saute la carte et on la rapporte. Faire
      -- échouer 1 400 cartes parce qu'une porte du stock rendrait le lot
      -- inutilisable, et l'utilisateur ne saurait pas laquelle.
      v_ignorees := v_ignorees || v_card;
      continue;
    end if;

    -- Édition manuelle : le trigger de verrous laisse alors passer l'écriture
    -- et ne réécrase pas `locked_fields`.
    perform set_config('goriki.edition_manuelle', 'on', true);

    -- 1. Suppression de la variante rejetée.
    delete from pokemon_card_variants
     where card_id = v_card
       and variant_type_id = any (coalesce(p_types_rejetes, '{}'));

    -- 2. Trace de la suppression volontaire — sans elle, l'import la recrée.
    insert into pokemon_variant_exclusions (card_id, variant_type_id, raison)
    select v_card, t, p_raison
      from unnest(coalesce(p_types_rejetes, '{}')) as t
    on conflict (card_id, variant_type_id) do nothing;

    -- 3. La variante conservée porte désormais une décision humaine.
    update pokemon_card_variants
       set source = 'manuel'
     where card_id = v_card
       and variant_type_id = any (coalesce(p_types_gardes, '{}'));

    -- Remis à 'off' AVANT la fin : `set_config(..., true)` est scopé à la
    -- TRANSACTION, pas à l'appel. Le laisser à 'on' désarmerait les verrous
    -- pour toutes les instructions suivantes de la même transaction.
    perform set_config('goriki.edition_manuelle', 'off', true);

    v_traitees := v_traitees + 1;
  end loop;

  return jsonb_build_object(
    'traitees', v_traitees,
    'ignorees', coalesce(array_length(v_ignorees, 1), 0),
    'cartes_ignorees', to_jsonb(v_ignorees)
  );
end $$;

comment on function public.admin_arbitrer_variantes(uuid[], uuid[], uuid[], text, boolean) is
  'Applique une décision d''arbitrage : supprime les types rejetés, les inscrit '
  'aux exclusions, marque les conservés en source=manuel. Refuse (strict) ou '
  'saute (lot) toute carte dont une variante rejetée porte du stock.';

revoke all on function public.admin_variantes_contradictoires(text, text) from public, anon;
revoke all on function public.admin_arbitrer_variantes(uuid[], uuid[], uuid[], text, boolean) from public, anon;
grant execute on function public.admin_variantes_contradictoires(text, text) to authenticated;
grant execute on function public.admin_arbitrer_variantes(uuid[], uuid[], uuid[], text, boolean) to authenticated;

notify pgrst, 'reload schema';
