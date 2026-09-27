-- ═══════════════════════════════════════════════════════════════════════════
-- 0050 — Les facettes en UN SEUL parcours de la vue
--
-- La version 0049 était juste mais coûteuse : douze sous-requêtes indépendantes
-- sur `v_ecarts_checklist`, donc douze reconstructions de la cible (34 683
-- numéros dépliés) et douze passes de sous-requêtes corrélées. Mesuré à
-- l'écran : 8,46 s pour la file non filtrée.
--
-- Un `with … as materialized` force UN seul calcul, réutilisé par tous les
-- agrégats. Sans le mot-clé, Postgres est libre d'inliner la CTE dans chaque
-- référence — et on retomberait exactement sur les douze parcours.
--
-- L'index sur `checklist_cible(set_code)` sert la jointure de la vue, qui
-- filtre les variantes sur les sets couverts.
-- ═══════════════════════════════════════════════════════════════════════════

create index if not exists checklist_cible_set_code_idx on public.checklist_cible(set_code);

create or replace function public.admin_facettes_reconciliation()
returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  with e as materialized (
    select famille, set_code, serie, rarete, tirage_label, exemplaires
    from v_ecarts_checklist
    where public.is_admin()
  )
  select jsonb_build_object(
    'total',      (select count(*) from e),
    'totalStock', (select count(*) from e where exemplaires > 0),
    'familles', (select coalesce(jsonb_agg(jsonb_build_object('valeur', famille, 'n', n, 'stock', s) order by n desc), '[]'::jsonb)
                   from (select famille, count(*) n, count(*) filter (where exemplaires > 0) s from e group by famille) x),
    'sets',     (select coalesce(jsonb_agg(jsonb_build_object('valeur', set_code, 'n', n) order by n desc), '[]'::jsonb)
                   from (select set_code, count(*) n from e group by set_code) x),
    'series',   (select coalesce(jsonb_agg(jsonb_build_object('valeur', serie, 'n', n) order by n desc), '[]'::jsonb)
                   from (select serie, count(*) n from e where serie is not null group by serie) x),
    'raretes',  (select coalesce(jsonb_agg(jsonb_build_object('valeur', rarete, 'n', n) order by n desc), '[]'::jsonb)
                   from (select rarete, count(*) n from e where rarete is not null group by rarete) x),
    'tirages',  (select coalesce(jsonb_agg(jsonb_build_object('valeur', tirage_label, 'n', n) order by n desc), '[]'::jsonb)
                   from (select tirage_label, count(*) n from e group by tirage_label) x)
  );
$$;

revoke all on function public.admin_facettes_reconciliation() from public, anon;
grant execute on function public.admin_facettes_reconciliation() to authenticated;

notify pgrst, 'reload schema';
