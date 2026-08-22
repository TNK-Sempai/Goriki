-- ─────────────────────────────────────────────────────────────────────────────
-- Ajout d'exemplaire : reprendre un visuel de repli fiable
--
-- La 0028 copiait `image_api` depuis le listing SOURCE. Or un exemplaire créé
-- depuis un autre exemplaire hérite d'un champ vide si celui-ci n'en avait pas :
-- la fiche produit tombait alors sur « scan à venir » alors que la carte dispose
-- d'un visuel d'éditeur parfaitement valable.
--
-- On résout donc le repli sur TOUTE la fratrie (même carte, même variante), et
-- à défaut sur `*_cards.image_url`. Le scan individuel reste évidemment à faire :
-- `needs_photo` est levé par le trigger, comme pour tout exemplaire ≥ 1 €.
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
  v_card    uuid;
  v_variant uuid;
  v_image   text;
  v_next    smallint;
  v_new     uuid;
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
    select card_id, variant_type_id into v_card, v_variant
    from public.pokemon_listings where id = p_source_id;
  else
    select card_id, variant_type_id into v_card, v_variant
    from public.onepiece_listings where id = p_source_id;
  end if;

  if v_card is null then
    raise exception 'Listing source introuvable';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_card::text || v_variant::text, 0));

  if p_universe = 'pokemon' then
    -- Repli : d'abord la fratrie, puis le visuel d'éditeur de la carte.
    select coalesce(
      (select l.image_api from public.pokemon_listings l
        where l.card_id = v_card and l.variant_type_id = v_variant
          and l.image_api is not null limit 1),
      (select c.image_url from public.pokemon_cards c where c.id = v_card)
    ) into v_image;

    select coalesce(max(copy_index), 0) + 1 into v_next
    from public.pokemon_listings
    where card_id = v_card and variant_type_id = v_variant and condition = p_condition;

    insert into public.pokemon_listings
      (card_id, variant_type_id, condition, copy_index, quantity, price, image_api, is_active)
    values (v_card, v_variant, p_condition, v_next, 1, p_price, v_image, true)
    returning id into v_new;
  else
    select coalesce(
      (select l.image_api from public.onepiece_listings l
        where l.card_id = v_card and l.variant_type_id = v_variant
          and l.image_api is not null limit 1),
      (select c.image_url from public.onepiece_cards c where c.id = v_card)
    ) into v_image;

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