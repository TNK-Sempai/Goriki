-- Appliquée le 2026-07-06 via MCP par RYUU — ce fichier est du versionnage
-- (le SQL a déjà été exécuté en base ; ne pas le rejouer manuellement).

ALTER TABLE public.pokemon_sets
  ADD COLUMN IF NOT EXISTS serie_id text,
  ADD COLUMN IF NOT EXISTS serie_name text;

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

INSERT INTO public.onepiece_variant_types (set_id, code, label, sort_order)
SELECT NULL, 'STANDARD', 'Standard', 1
WHERE NOT EXISTS (
  SELECT 1 FROM public.onepiece_variant_types t
  WHERE t.set_id IS NULL AND t.code = 'STANDARD'
);
