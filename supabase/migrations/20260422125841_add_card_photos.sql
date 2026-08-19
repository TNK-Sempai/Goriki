
-- pokemon_listings
ALTER TABLE pokemon_listings
  ADD COLUMN IF NOT EXISTS front_photo_url  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS back_photo_url   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS needs_photo      BOOLEAN NOT NULL DEFAULT FALSE;

-- onepiece_listings
ALTER TABLE onepiece_listings
  ADD COLUMN IF NOT EXISTS front_photo_url  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS back_photo_url   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS needs_photo      BOOLEAN NOT NULL DEFAULT FALSE;

-- Index pour la queue "à photographier"
CREATE INDEX IF NOT EXISTS idx_pokemon_listings_needs_photo
  ON pokemon_listings (needs_photo, price DESC)
  WHERE needs_photo = TRUE AND stock_qty > 0;

CREATE INDEX IF NOT EXISTS idx_onepiece_listings_needs_photo
  ON onepiece_listings (needs_photo, price DESC)
  WHERE needs_photo = TRUE AND stock_qty > 0;

-- Fonction trigger partagée
CREATE OR REPLACE FUNCTION set_needs_photo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.price >= 1 AND NEW.front_photo_url IS NULL THEN
    NEW.needs_photo := TRUE;
  END IF;
  IF NEW.front_photo_url IS NOT NULL AND NEW.back_photo_url IS NOT NULL THEN
    NEW.needs_photo := FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applique sur les deux tables
CREATE OR REPLACE TRIGGER trg_pokemon_listings_needs_photo
  BEFORE INSERT OR UPDATE ON pokemon_listings
  FOR EACH ROW EXECUTE FUNCTION set_needs_photo();

CREATE OR REPLACE TRIGGER trg_onepiece_listings_needs_photo
  BEFORE INSERT OR UPDATE ON onepiece_listings
  FOR EACH ROW EXECUTE FUNCTION set_needs_photo();

-- Backfill des listings existants
UPDATE pokemon_listings
  SET needs_photo = TRUE
  WHERE price >= 1 AND front_photo_url IS NULL AND stock_qty > 0;

UPDATE onepiece_listings
  SET needs_photo = TRUE
  WHERE price >= 1 AND front_photo_url IS NULL AND stock_qty > 0;
