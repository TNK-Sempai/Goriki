-- ─────────────────────────────────────────────────────────────────────────────
-- Ajout d'un exemplaire physique (admin)
--
-- Calculer `max(copy_index) + 1` côté application serait exposé à une course :
-- deux ajouts simultanés viseraient le même numéro. On le fait donc en base,
-- sous verrou consultatif porté par (carte, variante), le temps de la insertion.
--
-- La fonction REFUSE un prix < 1 € : sous ce seuil, le régime est fongible et
-- l'index partiel `*_bulk_unique` n'admet qu'une ligne. Lever une erreur
-- explicite vaut mieux que laisser remonter une violation de contrainte.
--
-- Le nouvel exemplaire naît SANS photo : le trigger `set_needs_photo` le place
-- donc aussitôt dans la file « à photographier », par exemplaire — c'est le
-- comportement voulu, chaque pièce physique a son propre scan.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.admin_add_listing_copy(
  p_universe  text,
  p_source_id uuid,
  p_condition text,
  p_price     numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card      uuid;
  v_variant   uuid;
  v_image     text;
  v_next      smallint;
  v_new       uuid;
begin
  if not public.is_admin() then
    raise exception 'Accès refusé';
  end if;

  if p_universe not in ('pokemon', 'onepiece') then
    raise exception 'Univers inconnu : %', p_universe;
  end if;

  if p_price is null or p_price < 1.0 then
    raise exception
      'Un exemplaire distinct suppose un prix d''au moins 1 € : en dessous, le stock est fongible et tient sur une seule ligne.';
  end if;

  if p_universe = 'pokemon' then
    select card_id, variant_type_id, image_api into v_card, v_variant, v_image
    from public.pokemon_listings where id = p_source_id;
  else
    select card_id, variant_type_id, image_api into v_card, v_variant, v_image
    from public.onepiece_listings where id = p_source_id;
  end if;

  if v_card is null then
    raise exception 'Listing source introuvable';
  end if;

  -- Verrou le temps de lire le max et d'insérer : deux ajouts simultanés sur la
  -- même carte se sérialisent au lieu de viser le même `copy_index`.
  perform pg_advisory_xact_lock(hashtextextended(v_card::text || v_variant::text, 0));

  if p_universe = 'pokemon' then
    select coalesce(max(copy_index), 0) + 1 into v_next
    from public.pokemon_listings
    where card_id = v_card and variant_type_id = v_variant and condition = p_condition;

    insert into public.pokemon_listings
      (card_id, variant_type_id, condition, copy_index, quantity, price, image_api, is_active)
    values (v_card, v_variant, p_condition, v_next, 1, p_price, v_image, true)
    returning id into v_new;
  else
    select coalesce(max(copy_index), 0) + 1 into v_next
    from public.onepiece_listings
    where card_id = v_card and variant_type_id = v_variant and condition = p_condition;

    insert into public.onepiece_listings
      (card_id, variant_type_id, condition, copy_index, quantity, price, image_api, is_active)
    values (v_card, v_variant, p_condition, v_next, 1, p_price, v_image, true)
    returning id into v_new;
  end if;

  return v_new;
end;
$$;

revoke all on function public.admin_add_listing_copy(text, uuid, text, numeric) from public, anon;
grant execute on function public.admin_add_listing_copy(text, uuid, text, numeric) to authenticated;

comment on function public.admin_add_listing_copy(text, uuid, text, numeric) is
  'Crée un exemplaire physique supplémentaire (copy_index suivant) pour la carte+variante '
  'du listing source. Gardée par is_admin(). Refuse un prix < 1 € : sous ce seuil le stock '
  'est fongible et tient sur une seule ligne (index partiel *_bulk_unique).';