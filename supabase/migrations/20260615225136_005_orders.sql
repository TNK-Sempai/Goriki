
CREATE TYPE public.order_status AS ENUM (
  'pending','paid','preparing','shipped','delivered','cancelled','refunded'
);

CREATE TABLE public.orders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status            public.order_status NOT NULL DEFAULT 'pending',
  total             NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
  shipping_cost     NUMERIC(10, 2) NOT NULL DEFAULT 0,
  store_credit_used NUMERIC(10, 2) NOT NULL DEFAULT 0,
  stripe_payment_id TEXT,
  stripe_session_id TEXT,
  shipping_address  JSONB,
  tracking_number   TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_user_id    ON public.orders(user_id);
CREATE INDEX idx_orders_status     ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);

CREATE TABLE public.order_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id          UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  item_type         TEXT NOT NULL CHECK (item_type IN ('pokemon','onepiece','sealed')),
  item_id           UUID NOT NULL,
  variant_type_id   UUID,
  quantity          INTEGER NOT NULL CHECK (quantity > 0),
  price_at_purchase NUMERIC(10, 2) NOT NULL,
  item_snapshot     JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Orders — lecture propriétaire" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Orders — insert" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Orders — admin" ON public.orders FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Order items — lecture" ON public.order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND user_id = auth.uid()));
CREATE POLICY "Order items — admin" ON public.order_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
