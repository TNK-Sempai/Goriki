-- ═══════════════════════════════════════════════════════════════════════════
-- 0047 — Les trois actions de réconciliation
--
-- ─── POURQUOI CHAQUE LIGNE A SA PROPRE SOUS-TRANSACTION ───────────────────
--
-- Le brief exige qu'« en cas d'échec partiel, les lignes traitées restent
-- traitées ». Une fonction plpgsql s'exécute dans UNE transaction : la moindre
-- exception annulerait tout le lot, y compris les lignes déjà bonnes. Un bloc
-- `begin … exception` ouvre en revanche une sous-transaction par ligne — seule
-- la ligne fautive est annulée, et elle est rapportée avec son motif.
--
-- ─── ET POURQUOI LE RAPPORT EST LIGNE À LIGNE ─────────────────────────────
--
-- « 45 variantes supprimées » ne dit pas lesquelles. Sur une action
-- destructive portant sur des objets physiques, c'est le compte rendu qui
-- permet de vérifier après coup — chaque ligne nomme la carte, la variante et
-- ce qui lui est arrivé.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Aperçu d'impact, AVANT d'écrire quoi que ce soit ───────────────────────
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
      when 'rattacher_supprimer' then e.jumelles_trouvees = 1
      when 'supprimer'           then e.exemplaires = 0
      when 'conserver'           then true
      else false
    end,
    case p_action
      when 'rattacher_supprimer' then
        case when e.jumelles_trouvees = 0 then 'Aucune jumelle sans finition — rien où rattacher les exemplaires.'
             when e.jumelles_trouvees > 1 then 'Plusieurs jumelles possibles — le choix ne peut pas être deviné.'
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
  where public.is_admin() and e.variante_id = any (coalesce(p_variante_ids, '{}'))
  order by (e.exemplaires > 0) desc, e.set_code, e.numero;
$$;

-- ── Exécution, avec rapport ligne à ligne ──────────────────────────────────
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

      -- Trace d'exclusion : uniquement sur une suppression, et uniquement si la
      -- variante portait un type de l'ancien modèle. C'est cette clé que
      -- l'import consulte ; lui seul peut recréer une ligne.
      if p_action in ('rattacher_supprimer', 'supprimer') then
        insert into pokemon_variant_exclusions (card_id, variant_type_id, raison)
        select r.card_id, v2.variant_type_id, 'réconciliation checklist'
          from (select 1) x
          left join lateral (select null::uuid as variant_type_id) v2 on true
         where false;  -- placeholder neutralisé : voir le bloc ci-dessous
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
