
CREATE TABLE public.pokemon_sets (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code         TEXT NOT NULL UNIQUE,
  name_fr      TEXT NOT NULL,
  release_date DATE,
  image_url    TEXT,
  card_count   INTEGER,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pokemon_sets_code ON public.pokemon_sets(code);

CREATE TABLE public.pokemon_cards (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  set_id     UUID NOT NULL REFERENCES public.pokemon_sets(id) ON DELETE CASCADE,
  number     TEXT NOT NULL,
  name_fr    TEXT NOT NULL,
  image_url  TEXT,
  rarity     TEXT,
  card_type  TEXT,
  category   TEXT,
  attribute  TEXT,
  is_secret  BOOLEAN NOT NULL DEFAULT false,
  is_promo   BOOLEAN NOT NULL DEFAULT false,
  tcgdex_id  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(set_id, number)
);
CREATE INDEX idx_pokemon_cards_set_id ON public.pokemon_cards(set_id);
CREATE INDEX idx_pokemon_cards_rarity ON public.pokemon_cards(rarity);

CREATE TABLE public.pokemon_variant_types (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  set_id     UUID REFERENCES public.pokemon_sets(id) ON DELETE CASCADE,
  code       TEXT NOT NULL,
  label      TEXT NOT NULL,
  source     TEXT NOT NULL DEFAULT 'api' CHECK (source IN ('api', 'custom')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(set_id, code)
);

INSERT INTO public.pokemon_variant_types (set_id, code, label, source, sort_order) VALUES
  (NULL, 'NORMAL',  'Normal',       'api', 1),
  (NULL, 'REVERSE', 'Reverse Holo', 'api', 2);

CREATE OR REPLACE FUNCTION public.set_needs_photo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.price >= 1.0 AND NEW.front_photo_url IS NULL THEN
    NEW.needs_photo = true;
  ELSIF NEW.front_photo_url IS NOT NULL THEN
    NEW.needs_photo = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE public.pokemon_listings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id         UUID NOT NULL REFERENCES public.pokemon_cards(id) ON DELETE CASCADE,
  variant_type_id UUID NOT NULL REFERENCES public.pokemon_variant_types(id),
  quantity        INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  price           NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  condition       TEXT NOT NULL DEFAULT 'Near Mint'
                  CHECK (condition IN ('Mint','Near Mint','Excellent','Light Played','Moderate Played')),
  image_api       TEXT,
  front_photo_url TEXT,
  back_photo_url  TEXT,
  needs_photo     BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  price_cm        NUMERIC(10, 2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(card_id, variant_type_id, condition)
);
CREATE INDEX idx_pkm_listings_card_id     ON public.pokemon_listings(card_id);
CREATE INDEX idx_pkm_listings_is_active   ON public.pokemon_listings(is_active);
CREATE INDEX idx_pkm_listings_needs_photo ON public.pokemon_listings(needs_photo);
CREATE INDEX idx_pkm_listings_price       ON public.pokemon_listings(price);

ALTER TABLE public.pokemon_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Listings PKM — lecture" ON public.pokemon_listings FOR SELECT USING (is_active = true);
CREATE POLICY "Listings PKM — admin" ON public.pokemon_listings FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TRIGGER pkm_needs_photo BEFORE INSERT OR UPDATE ON public.pokemon_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_needs_photo();
CREATE TRIGGER pkm_updated_at BEFORE UPDATE ON public.pokemon_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.pokemon_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sets PKM — lecture" ON public.pokemon_sets FOR SELECT USING (true);
CREATE POLICY "Sets PKM — admin" ON public.pokemon_sets FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.pokemon_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cards PKM — lecture" ON public.pokemon_cards FOR SELECT USING (true);
CREATE POLICY "Cards PKM — admin" ON public.pokemon_cards FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.pokemon_variant_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Variants PKM — lecture" ON public.pokemon_variant_types FOR SELECT USING (true);
CREATE POLICY "Variants PKM — admin" ON public.pokemon_variant_types FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
