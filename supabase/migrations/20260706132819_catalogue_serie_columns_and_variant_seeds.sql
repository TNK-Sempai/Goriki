-- Mission 01 CATALOGUE_IMPORTS — mapping séries data-driven + seed des types de variantes
-- 1. Colonnes série (source : TCGdex serie {id, name}, stockées à l'import)
ALTER TABLE public.pokemon_sets
  ADD COLUMN IF NOT EXISTS serie_id text,
  ADD COLUMN IF NOT EXISTS serie_name text;

-- 2. Seed variantes globales Pokémon (set_id NULL — WHERE NOT EXISTS car UNIQUE(set_id,code)
--    ne matche pas sur NULL avec ON CONFLICT, NULLS DISTINCT par défaut)
INSERT INTO public.pokemon_variant_types (set_id, code, label, source, sort_order)
SELECT NULL, v.code, v.label, 'api', v.sort_order
FROM (VALUES
  ('NORMAL', 'Normale', 1),
  ('REVERSE', 'Reverse', 2),
  ('HOLO', 'Holo', 3),
  ('FIRST_EDITION', '1ère édition', 4)
) AS v(code, label, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.pokemon_variant_types t
  WHERE t.set_id IS NULL AND t.code = v.code
);

-- 3. Seed variante globale One Piece
INSERT INTO public.onepiece_variant_types (set_id, code, label, sort_order)
SELECT NULL, 'STANDARD', 'Standard', 1
WHERE NOT EXISTS (
  SELECT 1 FROM public.onepiece_variant_types t
  WHERE t.set_id IS NULL AND t.code = 'STANDARD'
);