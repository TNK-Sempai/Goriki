
CREATE TABLE public.wishlist_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_type       TEXT NOT NULL CHECK (item_type IN ('pokemon','onepiece','sealed')),
  item_id         UUID NOT NULL,
  variant_type_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, item_type, item_id, variant_type_id)
);
CREATE INDEX idx_wishlist_user_id ON public.wishlist_items(user_id);

ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Wishlist — lecture" ON public.wishlist_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Wishlist — insert" ON public.wishlist_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Wishlist — delete" ON public.wishlist_items FOR DELETE USING (auth.uid() = user_id);
