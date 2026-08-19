
-- Ajouter une contrainte UNIQUE sur (tcg_id, code) pour permettre l'upsert One Piece
ALTER TABLE extensions 
ADD CONSTRAINT extensions_tcg_id_code_key UNIQUE (tcg_id, code);
