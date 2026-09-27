-- ═══════════════════════════════════════════════════════════════════════════
-- 0048 — Correctif : la trace d'exclusion était neutralisée
--
-- La version 0047 contenait un `insert … where false` — un bloc qui avait
-- l'apparence d'écrire l'exclusion et n'écrivait rien. Une suppression sans
-- exclusion est défaite au prochain import : tout le travail de la file serait
-- revenu, silencieusement.
--
-- Le `variant_type_id` doit être retenu AVANT le DELETE : après, la ligne
-- n'existe plus et la clé d'exclusion est perdue.
-- ═══════════════════════════════════════════════════════════════════════════

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
        if r.jumelles_trouvees <> 1 then
          raise exception 'Jumelle % — rattachement impossible.',
            case when r.jumelles_trouvees = 0 then 'introuvable' else 'ambiguë' end;
        end if;

        -- Renumérotation : la jumelle a peut-être déjà des exemplaires, et
        -- `(variant_id, condition, copy_index)` est unique.
        select coalesce(max(copy_index), -1) into v_depart
          from pokemon_listings where variant_id = r.jumelle_id;

        with renum as (
          select id, (v_depart + row_number() over (order by copy_index, id))::smallint as nouveau
            from pokemon_listings where variant_id = v_id
        )
        update pokemon_listings l
           set variant_id = r.jumelle_id, copy_index = n.nouveau
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
      -- Seulement si la variante portait un type de l'ancien modèle : c'est
      -- cette clé que l'import consulte, et lui seul peut recréer une ligne.
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

revoke all on function public.admin_reconcilier(text, uuid[], text) from public, anon;
grant execute on function public.admin_reconcilier(text, uuid[], text) to authenticated;

notify pgrst, 'reload schema';
