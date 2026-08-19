
-- Contrainte unique pour upsert des listings Pokémon
ALTER TABLE pokemon_listings 
ADD CONSTRAINT pokemon_listings_unique_card_variant_condition_language 
UNIQUE (card_id, variant, condition_id, language_id);

-- Contrainte unique pour upsert des listings One Piece
ALTER TABLE onepiece_listings 
ADD CONSTRAINT onepiece_listings_unique_card_variant_condition_language 
UNIQUE (card_id, variant, condition_id, language_id);
