-- ═══════════════════════════════════════════════════════════════════════════
-- 0052 — Les actions lisent la jumelle par la fonction, plus par la vue
--
-- 0051 a allégé `v_ecarts_checklist` en sortant `jumelle_id` et
-- `jumelles_trouvees`, qui coûtaient deux sous-requêtes corrélées sur 35 386
-- lignes pour ne servir que sur les 50 affichées. Les deux fonctions d'action
-- les lisaient depuis la vue : sans ce correctif, l'aperçu et l'exécution
-- échoueraient sur une colonne disparue.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.admin_apercu_reconciliation(
  p_action       text,
  p_variante_ids uuid[]
)
returns table (
  variante_id uuid, carte text, set_code text, numero text,
  variante text, exemplaires bigint,
  possible boolean, effet text
)
language sql
security definer
set search_path to 'public'
as $$
  select
    e.variante_id, e.carte, e.set_code, e.numero,
    e.tirage_label || coalesce(' · ' || e.finition_label, '') || coalesce(' · ' || e.tampon_label, ''),
    e.exemplaires,
    case p_action
      when 'rattacher_supprimer' then j.jumelles_trouvees = 1
      when 'supprimer'           then e.exemplaires = 0
      when 'conserver'           then true
      else false
    end,
    case p_action
      when 'rattacher_supprimer' then
        case when j.jumelles_trouvees = 0 then 'Aucune jumelle sans finition — rien où rattacher les exemplaires.'
             when j.jumelles_trouvees > 1 then 'Plusieurs jumelles possibles — le choix ne peut pas être deviné.'
             else e.exemplaires || ' exemplaire(s) déplacé(s) vers la variante sans finition, puis cette variante supprimée.'
        end
      when 'supprimer' then
        case when e.exemplaires > 0
             then e.exemplaires || ' exemplaire(s) accroché(s) : suppression refusée.'
             else 'Variante supprimée et inscrite aux exclusions.' end
      when 'conserver' then 'Variante conservée avec motif ; sort définitivement de la file.'
      else 'Action inconnue.'
    end
  from v_ecarts_checklist e
  left join lateral public.jumelle_sans_finition(e.variante_id) j on true
  where public.is_admin() and e.variante_id = any (coalesce(p_variante_ids, '{}'))
  order by (e.exemplaires > 0) desc, e.set_code, e.numero;
$$;

create or replace function public.admin_reconcilier(
  p_action       text,
  p_variante_ids uuid[],
  p_motif        text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id      uuid;
  v_lignes  jsonb := '[]'::jsonb;
  v_ok      int := 0;
  v_echecs  int := 0;
  r         record;
  j         record;
  v_depart  smallint;
  v_msg     text;
  v_type    uuid;
begin
  if not public.is_admin() then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if p_action not in ('rattacher_supprimer', 'supprimer', 'conserver') then
    raise exception 'Action inconnue : %', p_action;
  end if;
  if p_action = 'conserver' and coalesce(btrim(p_motif), '') = '' then
    raise exception 'Le motif est obligatoire pour conserver une variante.';
  end if;

  foreach v_id in array coalesce(p_variante_ids, '{}') loop
    -- Sous-transaction : une ligne qui échoue n'emporte pas les précédentes.
    begin
      select * into r from v_ecarts_checklist where variante_id = v_id;
      if not found then
        raise exception 'Cette variante n''est plus dans la file (déjà traitée ou hors écart).';
      end if;

      -- Retenu AVANT toute suppression : c'est la clé que l'import consulte.
      select variant_type_id into v_type from pokemon_card_variants where id = v_id;

      if p_action = 'rattacher_supprimer' then
        select * into j from public.jumelle_sans_finition(v_id);
        if coalesce(j.jumelles_trouvees, 0) <> 1 then
          raise exception 'Jumelle % — rattachement impossible.',
            case when coalesce(j.jumelles_trouvees, 0) = 0 then 'introuvable' else 'ambiguë' end;
        end if;

        -- Renumérotation : la jumelle a peut-être déjà des exemplaires, et
        -- `(variant_id, condition, copy_index)` est unique.
        select coalesce(max(copy_index), -1) into v_depart
          from pokemon_listings where variant_id = j.jumelle_id;

        with renum as (
          select id, (v_depart + row_number() over (order by copy_index, id))::smallint as nouveau
            from pokemon_listings where variant_id = v_id
        )
        update pokemon_listings l
           set variant_id = j.jumelle_id, copy_index = n.nouveau
          from renum n where n.id = l.id;

        delete from pokemon_card_variants where id = v_id;
        v_msg := format('%s exemplaire(s) rattaché(s) à la variante sans finition, doublon supprimé.', r.exemplaires);

      elsif p_action = 'supprimer' then
        if r.exemplaires > 0 then
          raise exception 'Porte % exemplaire(s) : la supprimer détruirait une pièce physique.', r.exemplaires;
        end if;
        delete from pokemon_card_variants where id = v_id;
        v_msg := 'Variante supprimée.';

      else -- conserver
        insert into pokemon_variant_conserves (variante_id, motif)
        values (v_id, btrim(p_motif))
        on conflict (variante_id) do update set motif = excluded.motif;
        v_msg := format('Conservée — motif : %s', btrim(p_motif));
      end if;

      -- ── La trace, sans laquelle l'import défait tout au prochain passage ──
      if p_action in ('rattacher_supprimer', 'supprimer') and v_type is not null then
        insert into pokemon_variant_exclusions (card_id, variant_type_id, raison)
        values (r.card_id, v_type, 'réconciliation checklist')
        on conflict (card_id, variant_type_id) do nothing;
        v_msg := v_msg || ' Exclusion inscrite.';
      end if;

      v_lignes := v_lignes || jsonb_build_object(
        'variante_id', v_id, 'carte', r.carte, 'set_code', r.set_code, 'numero', r.numero,
        'variante', r.tirage_label || coalesce(' · ' || r.finition_label, '') || coalesce(' · ' || r.tampon_label, ''),
        'ok', true, 'message', v_msg);
      v_ok := v_ok + 1;

    exception when others then
      v_lignes := v_lignes || jsonb_build_object(
        'variante_id', v_id, 'ok', false, 'message', SQLERRM);
      v_echecs := v_echecs + 1;
    end;
  end loop;

  return jsonb_build_object('traitees', v_ok, 'echecs', v_echecs, 'lignes', v_lignes);
end $$;

revoke all on function public.admin_apercu_reconciliation(text, uuid[]) from public, anon;
revoke all on function public.admin_reconcilier(text, uuid[], text) from public, anon;
grant execute on function public.admin_apercu_reconciliation(text, uuid[]) to authenticated;
grant execute on function public.admin_reconcilier(text, uuid[], text) to authenticated;

notify pgrst, 'reload schema';
