
CREATE TABLE public.sealed_products (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tcg_type    TEXT NOT NULL CHECK (tcg_type IN ('pokemon','onepiece','autre')),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('booster','display','etb','tin','coffret','accessoire')),
  description TEXT,
  image_url   TEXT,
  price       NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  quantity    INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sealed_tcg_type  ON public.sealed_products(tcg_type);
CREATE INDEX idx_sealed_is_active ON public.sealed_products(is_active);

ALTER TABLE public.sealed_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scellés — lecture" ON public.sealed_products FOR SELECT USING (is_active = true);
CREATE POLICY "Scellés — admin" ON public.sealed_products FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TRIGGER sealed_updated_at BEFORE UPDATE ON public.sealed_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
