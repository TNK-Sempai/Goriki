-- Branchement One Piece sur Poneglyphe (https://tanuki-poneglyph.pages.dev/v1/).
-- Principe : le schéma Goriki s'adapte à la source, pas l'inverse. Poneglyphe
-- expose une dizaine de champs que `onepiece_cards` ne savait pas stocker et que
-- l'ancien mapping OPECards jetait silencieusement.

-- ── Séries : symétrie avec `pokemon_sets` (dette ouverte depuis la mission 01) ──
-- Alimenté depuis `set_type` de Poneglyphe (DPS/EB/OP/OTHER/PRB/PROMO/ST),
-- jamais depuis une regex sur le code — décision d'archi #11.
alter table public.onepiece_sets
  add column if not exists serie_id text,
  add column if not exists serie_name text;

comment on column public.onepiece_sets.serie_name is
  'Libellé de série, dérivé de `set_type` Poneglyphe. Sert au groupement par ère de l''index des séries.';

-- ── Données de carte réellement fournies par Poneglyphe ────────────────────
-- Taux de remplissage relevés sur un set de référence (151 cartes Standard) :
-- attribute 125, cost 144, counter 83, effect 142, character_name 150,
-- affiliations 151, abilities 62. Tout cela était perdu par l'ancien mapping.
alter table public.onepiece_cards
  add column if not exists attribute text,
  add column if not exists cost integer,
  add column if not exists counter integer,
  add column if not exists effect text,
  add column if not exists trigger_effect text,
  add column if not exists character_name text,
  add column if not exists affiliations text[],
  add column if not exists abilities text[],
  add column if not exists colors text[],
  add column if not exists version text;

comment on column public.onepiece_cards.colors is
  'Couleurs telles que fournies par la source (une carte peut être bicolore). `color` conserve la version aplatie pour l''affichage existant.';
comment on column public.onepiece_cards.version is
  'Version de la carte chez Poneglyphe. Seules les `Standard` sont importées à ce jour ; la colonne permettra d''accueillir les SP/Alternative Art sans nouvelle migration.';

-- Recherche par personnage et par version, utiles dès que le catalogue existe.
create index if not exists onepiece_cards_character_idx on public.onepiece_cards (character_name);
create index if not exists onepiece_cards_version_idx on public.onepiece_cards (version);