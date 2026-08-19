
CREATE TABLE public.onepiece_sets (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code         TEXT NOT NULL UNIQUE,
  name_fr      TEXT NOT NULL,
  release_date DATE,
  image_url    TEXT,
  card_count   INTEGER,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_onepiece_sets_code ON public.onepiece_sets(code);

CREATE TABLE public.onepiece_cards (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  set_id      UUID NOT NULL REFERENCES public.onepiece_sets(id) ON DELETE CASCADE,
  number      TEXT NOT NULL,
  name_fr     TEXT NOT NULL,
  image_url   TEXT,
  rarity      TEXT,
  card_type   TEXT,
  color       TEXT,
  power       INTEGER,
  life_points INTEGER,
  opecards_id TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(set_id, number)
);
CREATE INDEX idx_op_cards_set_id ON public.onepiece_cards(set_id);
CREATE INDEX idx_op_cards_rarity ON public.onepiece_cards(rarity);
CREATE INDEX idx_op_cards_color  ON public.onepiece_cards(color);

CREATE TABLE public.onepiece_variant_types (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  set_id     UUID REFERENCES public.onepiece_sets(id) ON DELETE CASCADE,
  code       TEXT NOT NULL,
  label      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(set_id, code)
);

INSERT INTO public.onepiece_variant_types (set_id, code, label, sort_order) VALUES
  (NULL, 'STANDARD',     'Standard',      1),
  (NULL, 'PARALLEL',     'Parallèle',     2),
  (NULL, 'FULL_ART',     'Full Art',      3),
  (NULL, 'MANGA',        'Manga Art',     4),
  (NULL, 'FOIL',         'Foil',          5),
  (NULL, 'FINALIST',     'Finalist',      6),
  (NULL, 'EVENT_PACK',   'Event Pack',    7),
  (NULL, 'REGIONAL',     'Régional',      8),
  (NULL, 'PARTICIPATION','Participation', 9),
  (NULL, 'JUDGE',        'Judge',         10);

CREATE TABLE public.onepiece_listings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id         UUID NOT NULL REFERENCES public.onepiece_cards(id) ON DELETE CASCADE,
  variant_type_id UUID NOT NULL REFERENCES public.onepiece_variant_types(id),
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
CREATE INDEX idx_op_listings_card_id     ON public.onepiece_listings(card_id);
CREATE INDEX idx_op_listings_is_active   ON public.onepiece_listings(is_active);
CREATE INDEX idx_op_listings_needs_photo ON public.onepiece_listings(needs_photo);
CREATE INDEX idx_op_listings_price       ON public.onepiece_listings(price);

ALTER TABLE public.onepiece_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Listings OP — lecture" ON public.onepiece_listings FOR SELECT USING (is_active = true);
CREATE POLICY "Listings OP — admin" ON public.onepiece_listings FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TRIGGER op_needs_photo BEFORE INSERT OR UPDATE ON public.onepiece_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_needs_photo();
CREATE TRIGGER op_updated_at BEFORE UPDATE ON public.onepiece_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.onepiece_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sets OP — lecture" ON public.onepiece_sets FOR SELECT USING (true);
CREATE POLICY "Sets OP — admin" ON public.onepiece_sets FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.onepiece_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cards OP — lecture" ON public.onepiece_cards FOR SELECT USING (true);
CREATE POLICY "Cards OP — admin" ON public.onepiece_cards FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.onepiece_variant_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Variants OP — lecture" ON public.onepiece_variant_types FOR SELECT USING (true);
CREATE POLICY "Variants OP — admin" ON public.onepiece_variant_types FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
