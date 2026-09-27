-- ═══════════════════════════════════════════════════════════════════════════
-- 0041 — Rendre les suppressions de variantes DURABLES
--
-- Problème résolu : supprimer une variante ne tenait pas. `insertListings` fait
-- un upsert `ignoreDuplicates` qui n'efface jamais et recrée la ligne au
-- prochain import si TCGdex la déclare encore. L'utilisateur refaisait le
-- travail sans s'en apercevoir.
--
-- `locked_fields` ne pouvait pas servir : il protège des CHAMPS d'une ligne
-- existante, pas l'ABSENCE d'une ligne. Il faut donc une trace positive de la
-- suppression volontaire — c'est l'objet de `pokemon_variant_exclusions`.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Provenance d'une variante ───────────────────────────────────────────
-- Même vocabulaire que `pokemon_variant_types.source` ('api' | 'manuel'),
-- même contrainte : deux colonnes qui disent la même chose doivent la dire
-- avec les mêmes mots, sinon un jour l'une acceptera 'MANUEL' et pas l'autre.
alter table public.pokemon_card_variants
  add column if not exists source text not null default 'api';

alter table public.pokemon_card_variants
  drop constraint if exists pokemon_card_variants_source_check;

alter table public.pokemon_card_variants
  add constraint pokemon_card_variants_source_check
  check (source = any (array['api'::text, 'manuel'::text]));

comment on column public.pokemon_card_variants.source is
  'api = créée par l''import TCGdex. manuel = arbitrée ou créée à la main ; '
  'témoigne d''une décision humaine sur l''existence de cette variante.';

-- ── 2. Trace des suppressions volontaires ──────────────────────────────────
create table if not exists public.pokemon_variant_exclusions (
  card_id         uuid        not null references public.pokemon_cards(id)         on delete cascade,
  variant_type_id uuid        not null references public.pokemon_variant_types(id) on delete cascade,
  raison          text,
  created_at      timestamptz not null default now(),
  primary key (card_id, variant_type_id)
);

comment on table public.pokemon_variant_exclusions is
  'Paires (carte, type de variante) que l''import ne doit PLUS recréer. '
  'Une ligne ici est une décision humaine : cette variante n''existe pas '
  'physiquement, quoi qu''en dise TCGdex.';

-- La clé primaire indexe déjà `card_id` en tête : le chargement des exclusions
-- d'un set entier (`card_id in (…)`) s'en sert. Pas d'index supplémentaire.

-- ── 3. RLS — administration uniquement, en lecture COMME en écriture ───────
-- Divergence assumée avec `pokemon_variant_types`, qui porte une policy de
-- lecture publique : cette table-ci n'est pas du catalogue, c'est un journal
-- de décisions internes. Rien du parcours public n'en a besoin.
alter table public.pokemon_variant_exclusions enable row level security;

drop policy if exists "Exclusions variantes — admin" on public.pokemon_variant_exclusions;
create policy "Exclusions variantes — admin"
  on public.pokemon_variant_exclusions
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- Le rôle `service_role` (script CLI d'import) contourne la RLS ; la route
-- d'API, elle, tourne avec la session de l'admin et passe par `is_admin()`.
-- Les deux chemins d'import savent donc lire cette table.

notify pgrst, 'reload schema';
