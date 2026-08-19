
-- Activer RLS sur les tables de cartes et listings
ALTER TABLE pokemon_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE pokemon_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE onepiece_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE onepiece_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sealed_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessories ENABLE ROW LEVEL SECURITY;

-- Policies pour les cartes (lecture publique)
CREATE POLICY "pokemon_cards_select_public" ON pokemon_cards
  FOR SELECT USING (true);

CREATE POLICY "onepiece_cards_select_public" ON onepiece_cards
  FOR SELECT USING (true);

-- Policies pour les listings (lecture publique, écriture admin)
CREATE POLICY "pokemon_listings_select_public" ON pokemon_listings
  FOR SELECT USING (true);

CREATE POLICY "pokemon_listings_admin_all" ON pokemon_listings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "onepiece_listings_select_public" ON onepiece_listings
  FOR SELECT USING (true);

CREATE POLICY "onepiece_listings_admin_all" ON onepiece_listings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Policies pour sealed_products et accessories (lecture publique, écriture admin)
CREATE POLICY "sealed_products_select_public" ON sealed_products
  FOR SELECT USING (true);

CREATE POLICY "sealed_products_admin_all" ON sealed_products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "accessories_select_public" ON accessories
  FOR SELECT USING (true);

CREATE POLICY "accessories_admin_all" ON accessories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Policies INSERT/UPDATE/DELETE pour les cartes (admin uniquement)
CREATE POLICY "pokemon_cards_admin_all" ON pokemon_cards
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "onepiece_cards_admin_all" ON onepiece_cards
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
