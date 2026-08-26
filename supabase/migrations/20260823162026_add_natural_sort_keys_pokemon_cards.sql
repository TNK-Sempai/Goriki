ALTER TABLE pokemon_cards
  ADD COLUMN sort_prefix text GENERATED ALWAYS AS (
    regexp_replace(COALESCE(number, ''), '[0-9].*$', '')
  ) STORED,
  ADD COLUMN sort_num integer GENERATED ALWAYS AS (
    COALESCE(NULLIF(substring(COALESCE(number, '') from '[0-9]+'), '')::integer, 0)
  ) STORED;

CREATE INDEX idx_pokemon_cards_natural_sort
  ON pokemon_cards (set_id, sort_prefix, sort_num, number);