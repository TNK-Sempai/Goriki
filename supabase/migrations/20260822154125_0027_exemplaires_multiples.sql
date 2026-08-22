-- ─────────────────────────────────────────────────────────────────────────────
-- Exemplaires multiples pour les cartes ≥ 1 €
--
-- DÉCISION D'ARCHITECTURE (KAEL) : ni l'option A ni l'option B seules, mais les
-- DEUX index, chacun répondant à une contrainte que l'autre ne couvre pas.
--
-- Option B seule (index unique partiel `WHERE price < 1`) était séduisante :
-- une ligne, la règle métier exprimée déclarativement. Elle est ÉCARTÉE parce
-- qu'un index PARTIEL ne satisfait pas l'inférence `ON CONFLICT (colonnes)` de
-- PostgreSQL — le prédicat de l'index doit être impliqué par le WHERE de la
-- requête, ce que PostgREST ne sait pas émettre. Or SIX upserts du code
-- (`lib/import/pokemon.ts`, `app/api/import/onepiece/route.ts`) ciblent
-- `card_id,variant_type_id,condition` avec `ignoreDuplicates`. La retenir seule
-- aurait cassé TOUS les imports de catalogue.
--
-- Option A seule (`copy_index` dans la clé) garde l'inférence `ON CONFLICT`
-- fonctionnelle, mais n'exprime AUCUNE règle métier : rien n'empêcherait cinq
-- lignes pour une commune à 0,10 €, en violation directe du garde-fou « le
-- régime bulk reste à une ligne ».
--
-- D'où la combinaison :
--   1. `UNIQUE (card_id, variant_type_id, condition, copy_index)` — index TOTAL,
--      cible d'`ON CONFLICT` pour les imports (copy_index vaut 0 par défaut).
--   2. `UNIQUE (card_id, variant_type_id, condition) WHERE price < 1.0` — index
--      PARTIEL, qui rend structurellement impossible d'avoir deux lignes bulk.
--
-- Conséquence voulue : passer deux exemplaires sous 1 € lève une erreur de
-- contrainte. C'est correct — on tenterait de fusionner deux pièces physiques
-- distinctes dans le régime fongible sans dire quoi faire de leurs quantités.
--
-- ⚠️ Le seuil 1.0 est répété ici et dans `set_needs_photo()`. Les deux
-- traduisent la même règle (`PHOTO_PRICE_THRESHOLD` côté code) : les modifier
-- ensemble.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.pokemon_listings
  add column if not exists copy_index smallint not null default 0;
alter table public.onepiece_listings
  add column if not exists copy_index smallint not null default 0;

comment on column public.pokemon_listings.copy_index is
  'Numéro d''exemplaire physique pour une même (carte, variante, état). 0 = la ligne '
  'de base / le stock fongible. Les exemplaires ≥ 1 € scannés individuellement prennent 1, 2, 3…';
comment on column public.onepiece_listings.copy_index is
  'Numéro d''exemplaire physique pour une même (carte, variante, état). 0 = la ligne '
  'de base / le stock fongible. Les exemplaires ≥ 1 € scannés individuellement prennent 1, 2, 3…';

-- 1. L'ancienne contrainte cède la place à la clé incluant l'exemplaire.
alter table public.pokemon_listings
  drop constraint if exists pokemon_listings_card_id_variant_type_id_condition_key;
alter table public.onepiece_listings
  drop constraint if exists onepiece_listings_card_id_variant_type_id_condition_key;

alter table public.pokemon_listings
  add constraint pokemon_listings_exemplaire_key
  unique (card_id, variant_type_id, condition, copy_index);
alter table public.onepiece_listings
  add constraint onepiece_listings_exemplaire_key
  unique (card_id, variant_type_id, condition, copy_index);

-- 2. Le régime bulk reste à UNE ligne par (carte, variante, état).
create unique index if not exists pokemon_listings_bulk_unique
  on public.pokemon_listings (card_id, variant_type_id, condition)
  where price < 1.0;
create unique index if not exists onepiece_listings_bulk_unique
  on public.onepiece_listings (card_id, variant_type_id, condition)
  where price < 1.0;