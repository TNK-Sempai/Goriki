
CREATE TYPE public.buyback_status     AS ENUM ('pending','accepted','rejected','completed');
CREATE TYPE public.payment_type       AS ENUM ('cash','store_credit');
CREATE TYPE public.consignment_status AS ENUM ('pending','active','sold','returned','cancelled');

CREATE TABLE public.buyback_requests (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status       public.buyback_status NOT NULL DEFAULT 'pending',
  items_json   JSONB NOT NULL DEFAULT '[]',
  offer_amount NUMERIC(10, 2),
  payment_type public.payment_type,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.buyback_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyback — lecture" ON public.buyback_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Buyback — admin" ON public.buyback_requests FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE public.consignment_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  card_id         UUID,
  variant_type_id UUID,
  asking_price    NUMERIC(10, 2) NOT NULL,
  commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 15.0,
  status          public.consignment_status NOT NULL DEFAULT 'pending',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.consignment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Consignment — lecture" ON public.consignment_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Consignment — admin" ON public.consignment_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TRIGGER buyback_updated_at BEFORE UPDATE ON public.buyback_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER consignment_updated_at BEFORE UPDATE ON public.consignment_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
