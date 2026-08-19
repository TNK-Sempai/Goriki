-- Mission 03 — RPC de stock atomiques. Remplacent le read-then-write du webhook.
-- Le nom de table est choisi par un CASE fermé (whitelist) : pas d'injection possible via format(%I).

-- Réservation : verrouille chaque ligne de stock, calcule le disponible
-- (quantity - réservations actives) et pose les réservations. Tout ou rien.
create or replace function public.reserve_order_stock(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r record;
  v_table text;
  v_available integer;
  v_reserved integer;
  v_failures jsonb := '[]'::jsonb;
begin
  -- Re-tentative sur la même commande : on repart d'une ardoise propre.
  delete from stock_reservations where order_id = p_order_id;

  for r in
    select oi.item_type,
           oi.item_id,
           oi.quantity,
           coalesce(oi.item_snapshot ->> 'name', oi.item_id::text) as label
    from order_items oi
    where oi.order_id = p_order_id
  loop
    v_table := case r.item_type
                 when 'pokemon'  then 'pokemon_listings'
                 when 'onepiece' then 'onepiece_listings'
                 when 'sealed'   then 'sealed_products'
               end;

    if v_table is null then
      v_failures := v_failures || jsonb_build_object(
        'item_id', r.item_id, 'label', r.label, 'reason', 'type d''article inconnu');
      continue;
    end if;

    v_available := null;
    execute format('select quantity from %I where id = $1 and is_active for update', v_table)
      into v_available using r.item_id;

    if v_available is null then
      v_failures := v_failures || jsonb_build_object(
        'item_id', r.item_id, 'label', r.label, 'reason', 'article indisponible');
      continue;
    end if;

    select coalesce(sum(sr.quantity), 0) into v_reserved
    from stock_reservations sr
    join orders o on o.id = sr.order_id
    where sr.item_type = r.item_type
      and sr.item_id = r.item_id
      and o.status = 'pending'
      and o.checkout_expires_at > now();

    if (v_available - v_reserved) < r.quantity then
      v_failures := v_failures || jsonb_build_object(
        'item_id', r.item_id, 'label', r.label, 'reason', 'stock insuffisant',
        'available', greatest(v_available - v_reserved, 0), 'requested', r.quantity);
      continue;
    end if;

    insert into stock_reservations (order_id, item_type, item_id, quantity)
    values (p_order_id, r.item_type, r.item_id, r.quantity);
  end loop;

  if jsonb_array_length(v_failures) > 0 then
    delete from stock_reservations where order_id = p_order_id;
    return jsonb_build_object('ok', false, 'failures', v_failures);
  end if;

  return jsonb_build_object('ok', true, 'failures', '[]'::jsonb);
end;
$fn$;

-- Finalisation : chemin UNIQUE de passage en `paid`, appelé par le webhook Stripe
-- ET par le bypass 0 €. Verrou + décrément + crédit + écriture dans une seule transaction.
create or replace function public.finalize_paid_order(
  p_order_id uuid,
  p_payment_id text,
  p_session_id text,
  p_total numeric,
  p_shipping_cost numeric,
  p_shipping_address jsonb,
  p_store_credit_used numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_status order_status;
  v_user_id uuid;
  r record;
  v_table text;
  v_rows integer;
  v_failures jsonb := '[]'::jsonb;
begin
  select status, user_id into v_status, v_user_id
  from orders where id = p_order_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'commande introuvable');
  end if;

  -- Idempotence : un rejeu Stripe (ou un double appel) ne repasse jamais ici.
  if v_status <> 'pending' then
    return jsonb_build_object('ok', true, 'already_finalized', true);
  end if;

  -- Décrément atomique, article par article, depuis order_items (source de vérité).
  for r in
    select oi.item_type, oi.item_id, oi.quantity,
           coalesce(oi.item_snapshot ->> 'name', oi.item_id::text) as label
    from order_items oi where oi.order_id = p_order_id
  loop
    v_table := case r.item_type
                 when 'pokemon'  then 'pokemon_listings'
                 when 'onepiece' then 'onepiece_listings'
                 when 'sealed'   then 'sealed_products'
               end;

    if v_table is null then
      v_failures := v_failures || jsonb_build_object('item_id', r.item_id, 'label', r.label,
        'reason', 'type d''article inconnu');
      continue;
    end if;

    execute format(
      'update %I set quantity = quantity - $1, is_active = (quantity - $1) > 0, updated_at = now()
       where id = $2 and quantity >= $1', v_table)
      using r.quantity, r.item_id;
    get diagnostics v_rows = row_count;

    if v_rows = 0 then
      v_failures := v_failures || jsonb_build_object('item_id', r.item_id, 'label', r.label,
        'reason', 'stock insuffisant au décrément', 'requested', r.quantity);
    end if;
  end loop;

  -- Déduction du crédit boutique (plancher à 0).
  if p_store_credit_used > 0 and v_user_id is not null then
    update profiles
    set store_credit = greatest(0, store_credit - p_store_credit_used)
    where id = v_user_id;
  end if;

  update orders set
    status              = 'paid',
    total               = p_total,
    shipping_cost       = coalesce(p_shipping_cost, 0),
    store_credit_used   = coalesce(p_store_credit_used, 0),
    stripe_payment_id   = coalesce(p_payment_id, stripe_payment_id),
    stripe_session_id   = coalesce(p_session_id, stripe_session_id),
    shipping_address    = coalesce(p_shipping_address, shipping_address),
    checkout_expires_at = null,
    needs_review        = jsonb_array_length(v_failures) > 0,
    review_reason       = case when jsonb_array_length(v_failures) > 0
                            then 'Décrément de stock incomplet : ' || v_failures::text
                            else null end
  where id = p_order_id;

  delete from stock_reservations where order_id = p_order_id;

  return jsonb_build_object('ok', true, 'already_finalized', false, 'stock_failures', v_failures);
end;
$fn$;

-- Remboursement : ré-incrément atomique du stock d'une commande.
create or replace function public.restock_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  r record;
  v_table text;
  v_restocked integer := 0;
begin
  for r in
    select oi.item_type, oi.item_id, oi.quantity
    from order_items oi where oi.order_id = p_order_id
  loop
    v_table := case r.item_type
                 when 'pokemon'  then 'pokemon_listings'
                 when 'onepiece' then 'onepiece_listings'
                 when 'sealed'   then 'sealed_products'
               end;
    if v_table is null then continue; end if;

    execute format(
      'update %I set quantity = quantity + $1, is_active = true, updated_at = now() where id = $2',
      v_table) using r.quantity, r.item_id;
    v_restocked := v_restocked + r.quantity;
  end loop;

  return jsonb_build_object('ok', true, 'restocked', v_restocked);
end;
$fn$;

-- Libération ciblée (checkout.session.expired) : la commande pending est purgée,
-- les réservations tombent par cascade. Une commande déjà payée n'est jamais touchée.
create or replace function public.release_order_checkout(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_status order_status;
begin
  select status into v_status from orders where id = p_order_id for update;

  if not found then
    return jsonb_build_object('ok', true, 'released', false, 'reason', 'commande introuvable');
  end if;

  if v_status <> 'pending' then
    return jsonb_build_object('ok', true, 'released', false, 'reason', 'commande non pending');
  end if;

  delete from orders where id = p_order_id;
  return jsonb_build_object('ok', true, 'released', true);
end;
$fn$;

-- Filet de sécurité : balayage des checkouts expirés (appelé au début de chaque checkout).
-- Marge de grâce pour ne jamais croiser un webhook en cours de traitement.
create or replace function public.release_expired_checkouts(p_grace_minutes integer default 5)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_deleted integer;
begin
  with purged as (
    delete from orders
    where status = 'pending'
      and checkout_expires_at is not null
      and checkout_expires_at < now() - make_interval(mins => p_grace_minutes)
    returning 1
  )
  select count(*) into v_deleted from purged;

  return v_deleted;
end;
$fn$;

revoke all on function public.reserve_order_stock(uuid) from public, anon, authenticated;
revoke all on function public.finalize_paid_order(uuid, text, text, numeric, numeric, jsonb, numeric) from public, anon, authenticated;
revoke all on function public.restock_order(uuid) from public, anon, authenticated;
revoke all on function public.release_order_checkout(uuid) from public, anon, authenticated;
revoke all on function public.release_expired_checkouts(integer) from public, anon, authenticated;