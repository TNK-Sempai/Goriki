-- ═══════════════════════════════════════════════════════════════════════════
-- 0043 — Modèle de variantes à TROIS AXES (schéma seul, sans reprise)
--
-- `pokemon_card_variants` ne portait qu'un `variant_type_id`. Une carte réelle
-- se décrit par trois choses INDÉPENDANTES : quelle impression a été mise en
-- vente, comment elle brille, ce qui a été apposé après impression.
--
-- Le cas qui le prouve — Mélodelfe, Jungle #17. La checklist PokéCardex donne
-- DEUX cases (1ère édition, Illimité) et la carte est non-holo. Un champ unique
-- oblige à choisir entre « 1ère édition » et « non-holo », donc à écrire
-- quelque chose de faux. Avec trois axes, la carte devient deux lignes justes :
-- `1ère édition · non-holo` et `Illimité · non-holo`.
--
-- ─── CE QUE CETTE MIGRATION NE FAIT PAS, ET POURQUOI ──────────────────────
--
-- Elle n'ajoute NI `NOT NULL` sur `tirage_id`, NI la contrainte d'unicité.
-- Les deux sont IMPOSSIBLES ici et non un oubli :
--
--  · `NOT NULL` sur une colonne ajoutée à 29 210 lignes existantes échouerait
--    immédiatement, faute de valeur.
--  · `UNIQUE NULLS NOT DISTINCT (card_id, tirage_id, finition_id, tampon_id)`
--    verrait, avant reprise, toutes les colonnes à NULL : les 8 770 cartes à
--    plusieurs variantes deviendraient autant de doublons et la migration
--    serait rejetée.
--
-- Les deux sont donc posés par 0044, APRÈS la reprise. `variant_type_id` reste
-- en place : sa suppression fera l'objet d'une migration séparée, après
-- validation.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Axe 1 — TIRAGE : quelle impression a été mise en vente ─────────────────
create table if not exists public.pokemon_variant_tirages (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  label      text not null,
  sort_order int  not null default 0,
  source     text not null default 'manuel',
  created_at timestamptz not null default now(),
  constraint pokemon_variant_tirages_source_check check (source = any (array['api'::text, 'manuel'::text]))
);

-- ── Axe 2 — FINITION : comment la carte brille ─────────────────────────────
create table if not exists public.pokemon_variant_finitions (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  label      text not null,
  sort_order int  not null default 0,
  source     text not null default 'manuel',
  created_at timestamptz not null default now(),
  constraint pokemon_variant_finitions_source_check check (source = any (array['api'::text, 'manuel'::text]))
);

-- ── Axe 3 — TAMPON : ce qui a été apposé après impression ──────────────────
create table if not exists public.pokemon_variant_tampons (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  label      text not null,
  sort_order int  not null default 0,
  source     text not null default 'manuel',
  created_at timestamptz not null default now(),
  constraint pokemon_variant_tampons_source_check check (source = any (array['api'::text, 'manuel'::text]))
);

comment on table public.pokemon_variant_tirages   is 'Axe 1 — impression mise en vente. Obligatoire sur une variante.';
comment on table public.pokemon_variant_finitions is 'Axe 2 — brillance. NULL = finition NON DÉTERMINÉE, à renseigner. « non-holo » est une valeur explicite, distincte de NULL.';
comment on table public.pokemon_variant_tampons   is 'Axe 3 — marquage apposé après impression. NULL = non renseigné ; « Sans tampon » est une valeur explicite.';

-- ── Peuplement — TIRAGES ───────────────────────────────────────────────────
insert into public.pokemon_variant_tirages (code, label, sort_order) values
  ('NORMALE',            'Normale',            10),
  ('PREMIERE_EDITION',   '1ère édition',       20),
  ('ILLIMITE',           'Illimité',           30),
  ('REVERSE',            'Reverse',            40),
  ('REVERSE_POKEBALL',   'Reverse Pokéball',   50),
  ('REVERSE_MASTERBALL', 'Reverse Masterball', 60),
  ('REVERSE_COPAIN',     'Reverse Copain',     70),
  ('REVERSE_LOVE',       'Reverse Love',       80),
  ('REVERSE_SOMBRE',     'Reverse Sombre',     90),
  ('REVERSE_RAPIDE',     'Reverse Rapide',    100),
  ('REVERSE_ROCKET',     'Reverse Rocket',    110)
on conflict (code) do nothing;

-- ── Peuplement — FINITIONS ─────────────────────────────────────────────────
insert into public.pokemon_variant_finitions (code, label, sort_order) values
  ('NON_HOLO',         'non-holo',          10),
  ('HOLO',             'holo',              20),
  ('HOLO_COSMOS',      'Holo Cosmos',       30),
  ('HOLO_CRACKED_ICE', 'Holo Cracked Ice',  40),
  ('HOLO_LIGNE',       'Holo Ligne',        50),
  ('HOLO_WATER_WEB',   'Holo Water Web',    60),
  ('HOLO_MIRAGE',      'Holo Mirage',       70),
  ('HOLO_MIROIR',      'Holo Miroir',       80),
  ('HOLO_TINSEL',      'Holo Tinsel',       90),
  ('HOLO_ETOILE',      'Holo Étoile',      100),
  ('HOLO_CONFETTI',    'Holo Confetti',    110),
  ('HOLO_SHEEN',       'Holo Sheen',       120),
  ('COSMOS_REVERSE',   'Cosmos Reverse',   130),
  ('METAL',            'Métal',            140)
on conflict (code) do nothing;

-- ── Peuplement — TAMPONS, partie 1 : ceux qui existent déjà ────────────────
-- Repris de `pokemon_variant_types` par leur PRÉFIXE, sans retaper les
-- libellés : les recopier à la main aurait fini par en faire diverger un.
-- Seuls les types réellement sans variante sont concernés — les quatre autres
-- codes à zéro (MASTERBALL, ROCKET, HOLO_COSMOS, NON_HOLO) ne sont pas des
-- tampons : ils appartiennent aux axes tirage et finition, où ils viennent
-- d'être créés.
insert into public.pokemon_variant_tampons (code, label, sort_order, source)
select t.code, t.label, 1000 + row_number() over (order by t.label), t.source
from public.pokemon_variant_types t
where t.set_id is null
  and (t.code like 'TAMPON\_%' or t.code like 'STAFF\_%' or t.code like 'CHAMPION\_%'
       or t.code like 'TOP4\_%' or t.code like 'TOP8\_%' or t.code = 'WINNER_PROMO')
  and not exists (select 1 from public.pokemon_card_variants v where v.variant_type_id = t.id)
on conflict (code) do nothing;

-- ── Peuplement — TAMPONS, partie 2 : relevés dans les checklists ───────────
insert into public.pokemon_variant_tampons (code, label, sort_order) values
  ('SANS_TAMPON',                  'Sans tampon',                          5),
  ('TAMPON_LEAGUE',                'Tampon (League)',                   2010),
  ('TAMPON_LEAGUE_CUP',            'Tampon (League Cup)',               2020),
  ('STAFF_LEAGUE_CUP',             'Staff (League Cup)',                2030),
  ('PLACE_1_4_LEAGUE_CHALLENGE',   '1ère à 4ème Place (League Challenge)', 2040),
  ('TAMPON_EUIC',                  'Tampon (EUIC)',                     2050),
  ('STAFF_EUIC',                   'Staff (EUIC)',                      2060),
  ('TOP8_EUIC',                    'Top 8 (EUIC)',                      2070),
  ('CHAMPION_EUIC',                'Champion (EUIC)',                   2080),
  ('TAMPON_TOYS_R_US',             'Tampon (Toys "R" Us)',              2090),
  ('TAMPON_POKEMON_LEGENDAIRE',    'Tampon (Pokémon Légendaire)',       2100),
  ('TAMPON_MERCI',                 'Tampon (Merci)',                    2110),
  ('TAMPON_EB_GAMES_CANADA',       'Tampon (EB Games Canada)',          2120),
  ('TAMPON_25_ANS',                'Tampon (25 ans)',                   2130),
  ('TAMPON_30_ANS',                'Tampon (30 ans)',                   2140),
  ('TAMPON_PLAY_POKEMON',          'Tampon (Play! Pokémon)',            2150),
  ('TAMPON_HORIZONS_THE_SERIES',   'Tampon (Horizons The Series)',      2160),
  ('TAMPON_POKEMON_ENSEMBLE',      'Tampon (Pokemon Ensemble)',         2170),
  ('TAMPON_MACHINS_MASHYNN',       'Tampon (Les Machins de Mashynn)',   2180),
  ('TAMPON_WORLDS_2024',           'Tampon (World Championships 2024)', 2190),
  ('AVEC_CODE_POGO',               'Avec code POGO',                    2200),
  ('METAMORPH_STICKER',            'Métamorph Sticker',                 2210)
on conflict (code) do nothing;

-- ── Les trois colonnes sur la variante ─────────────────────────────────────
alter table public.pokemon_card_variants
  add column if not exists tirage_id   uuid references public.pokemon_variant_tirages(id),
  add column if not exists finition_id uuid references public.pokemon_variant_finitions(id),
  add column if not exists tampon_id   uuid references public.pokemon_variant_tampons(id);

comment on column public.pokemon_card_variants.finition_id is
  'NULL = finition NON DÉTERMINÉE, à renseigner. Ce n''est PAS « non-holo », '
  'qui existe comme valeur explicite dans pokemon_variant_finitions.';

-- Index sur les clés étrangères : l'éditeur filtre par axe, et une FK sans
-- index rend tout DELETE sur la table de référence proportionnel à 29 210.
create index if not exists pkm_variants_tirage_idx   on public.pokemon_card_variants(tirage_id);
create index if not exists pkm_variants_finition_idx on public.pokemon_card_variants(finition_id);
create index if not exists pkm_variants_tampon_idx   on public.pokemon_card_variants(tampon_id);

-- ── RLS : lecture publique, écriture admin — comme les types de variantes ──
-- Ces trois tables SONT du catalogue : la fiche publique doit pouvoir nommer
-- la finition d'une carte. Divergence voulue avec `pokemon_variant_exclusions`,
-- qui est un journal interne.
alter table public.pokemon_variant_tirages   enable row level security;
alter table public.pokemon_variant_finitions enable row level security;
alter table public.pokemon_variant_tampons   enable row level security;

drop policy if exists "Tirages — lecture"   on public.pokemon_variant_tirages;
drop policy if exists "Tirages — admin"     on public.pokemon_variant_tirages;
create policy "Tirages — lecture" on public.pokemon_variant_tirages for select using (true);
create policy "Tirages — admin"   on public.pokemon_variant_tirages for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Finitions — lecture" on public.pokemon_variant_finitions;
drop policy if exists "Finitions — admin"   on public.pokemon_variant_finitions;
create policy "Finitions — lecture" on public.pokemon_variant_finitions for select using (true);
create policy "Finitions — admin"   on public.pokemon_variant_finitions for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Tampons — lecture" on public.pokemon_variant_tampons;
drop policy if exists "Tampons — admin"   on public.pokemon_variant_tampons;
create policy "Tampons — lecture" on public.pokemon_variant_tampons for select using (true);
create policy "Tampons — admin"   on public.pokemon_variant_tampons for all using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';
