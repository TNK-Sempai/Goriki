-- Nettoyage code mort — 4 fonctions trigger orphelines : rattachées à AUCUN trigger,
-- appelées nulle part dans le code, et cassées par construction (elles visent des
-- tables ou colonnes qui n'existent plus). Leur source est conservée dans NETTOYAGE.md.
--
-- Vérifié avant suppression : aucune n'apparaît dans une policy, un DEFAULT de colonne,
-- une contrainte ni une vue. `is_admin()` — qui est dans la même situation « 0 trigger » —
-- est CONSERVÉE : la policy SELECT de `profiles` l'appelle (migration 0017).
-- Les fonctions V2 (generate_buyback_number, generate_consignment_number,
-- handle_consignment_item_sold) sont CONSERVÉES : leurs tables existent et le
-- dépôt-vente est un chantier V2 explicitement protégé.

-- Écrit NEW.order_number : la colonne n'existe pas sur public.orders
drop function if exists public.generate_order_number();

-- Lit la table `tickets` : elle n'existe pas
drop function if exists public.generate_ticket_number();

-- Écrit dans la table `addresses` : elle n'existe pas
drop function if exists public.handle_default_address();

-- Doublon strict de public.update_updated_at() (qui, elle, porte 7 triggers)
drop function if exists public.update_updated_at_column();