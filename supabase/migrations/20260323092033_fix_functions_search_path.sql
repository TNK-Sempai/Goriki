
-- Corriger les fonctions avec search_path mutable
ALTER FUNCTION generate_ticket_number() SET search_path = public;
ALTER FUNCTION generate_consignment_number() SET search_path = public;
ALTER FUNCTION generate_buyback_number() SET search_path = public;
ALTER FUNCTION is_admin() SET search_path = public;
ALTER FUNCTION handle_default_address() SET search_path = public;
ALTER FUNCTION generate_order_number() SET search_path = public;
ALTER FUNCTION decrement_stock_on_paid_order() SET search_path = public;
ALTER FUNCTION handle_consignment_item_sold() SET search_path = public;
ALTER FUNCTION update_updated_at_column() SET search_path = public;
