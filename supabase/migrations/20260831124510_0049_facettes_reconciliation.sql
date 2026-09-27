-- ═══════════════════════════════════════════════════════════════════════════
-- 0049 — Facettes agrégées côté base
--
-- La page comptait les facettes en relisant la vue entière depuis PostgREST.
-- Mesuré à l'écran : « Écarts restants = 1 000 » pour 1 599 réels. PostgREST
-- plafonne toute réponse à `db-max-rows` = 1 000 — la même troncature
-- silencieuse que sur l'écran d'arbitrage, et que j'avais pourtant décrite dans
-- le commentaire de cette page avant d'y tomber pour les facettes.
--
-- Un chiffre faux mais plausible est pire qu'une erreur : il fait croire la
-- file plus courte qu'elle n'est. On agrège donc EN BASE, où aucun plafond ne
-- s'applique, et on ne rapatrie que les totaux.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.admin_facettes_reconciliation()
returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  select case when not public.is_admin() then '{}'::jsonb else jsonb_build_object(
    'total',      (select count(*) from v_ecarts_checklist),
    'totalStock', (select count(*) from v_ecarts_checklist where exemplaires > 0),
    'familles', (select coalesce(jsonb_agg(jsonb_build_object('valeur', famille, 'n', n, 'stock', s) order by n desc), '[]'::jsonb)
                   from (select famille, count(*) n, count(*) filter (where exemplaires > 0) s
                           from v_ecarts_checklist group by famille) x),
    'sets',     (select coalesce(jsonb_agg(jsonb_build_object('valeur', set_code, 'n', n) order by n desc), '[]'::jsonb)
                   from (select set_code, count(*) n from v_ecarts_checklist group by set_code) x),
    'series',   (select coalesce(jsonb_agg(jsonb_build_object('valeur', serie, 'n', n) order by n desc), '[]'::jsonb)
                   from (select serie, count(*) n from v_ecarts_checklist where serie is not null group by serie) x),
    'raretes',  (select coalesce(jsonb_agg(jsonb_build_object('valeur', rarete, 'n', n) order by n desc), '[]'::jsonb)
                   from (select rarete, count(*) n from v_ecarts_checklist where rarete is not null group by rarete) x),
    'tirages',  (select coalesce(jsonb_agg(jsonb_build_object('valeur', tirage_label, 'n', n) order by n desc), '[]'::jsonb)
                   from (select tirage_label, count(*) n from v_ecarts_checklist group by tirage_label) x)
  ) end;
$$;

revoke all on function public.admin_facettes_reconciliation() from public, anon;
grant execute on function public.admin_facettes_reconciliation() to authenticated;

notify pgrst, 'reload schema';
