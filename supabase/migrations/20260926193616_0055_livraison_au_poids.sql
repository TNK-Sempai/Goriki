-- ═══════════════════════════════════════════════════════════════════════════
-- 0055 — Livraison au poids, avec choix du transporteur
--
-- Remplace la grille forfaitaire (BE 5 € / autres 8 € / offerte dès 60 €) codée
-- en dur dans `lib/constants.ts`. Les tarifs deviennent des DONNÉES : ils
-- changent au gré des grilles transporteur, et une grille en dur oblige à
-- redéployer pour corriger un prix.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Réglages, une seule ligne ──────────────────────────────────────────────
-- Le singleton est imposé par la base (`id = 1`) et non par convention : deux
-- lignes de réglages, et le calcul dépendrait de l'ordre de lecture.
create table if not exists public.shipping_settings (
  id                 int primary key default 1 check (id = 1),
  -- Libellé client imposé : « Frais de préparation et d'emballage ».
  -- JAMAIS « frais bancaires » ni « frais Stripe » — ce forfait couvre
  -- l'enveloppe, la protection et le temps de préparation, pas le paiement.
  handling_fee       numeric(10,2) not null default 1.00 check (handling_fee >= 0),
  letter_max_value   numeric(10,2) not null default 25.00 check (letter_max_value >= 0),
  letter_max_weight_g int          not null default 100   check (letter_max_weight_g > 0),
  -- ⚠️ PROVISOIRES, à corriger après pesée réelle.
  card_weight_g      int not null default 11 check (card_weight_g > 0),
  envelope_weight_g  int not null default 12 check (envelope_weight_g >= 0),
  updated_at         timestamptz not null default now()
);

insert into public.shipping_settings (id) values (1) on conflict (id) do nothing;

comment on table public.shipping_settings is
  'Réglages de livraison — une seule ligne (id = 1). card_weight_g et '
  'envelope_weight_g sont PROVISOIRES tant que la pesée réelle n''est pas faite.';

-- ── Grille tarifaire ───────────────────────────────────────────────────────
create table if not exists public.shipping_rates (
  id                     uuid primary key default gen_random_uuid(),
  code                   text not null unique,
  label                  text not null,
  carrier                text not null check (carrier in ('bpost', 'mondial_relay')),
  kind                   text not null check (kind in ('letter', 'service_point', 'home')),
  country                text not null check (country in ('BE', 'FR', 'LU', 'NL', 'DE')),
  max_weight_g           int  not null check (max_weight_g > 0),
  price                  numeric(10,2) not null check (price >= 0),
  sendcloud_method_code  text,
  needs_service_point    boolean not null default false,
  tracked                boolean not null default true,
  is_active              boolean not null default true,
  sort_order             int not null default 0,

  -- La lettre simple est timbrée à la main : elle n'a pas de méthode Sendcloud,
  -- n'est pas suivie et n'a pas de point relais. Les trois vont ensemble ;
  -- séparées, une ligne incohérente saisie à l'écran ferait échouer la mission 3
  -- au moment de générer l'étiquette, c'est-à-dire trop tard.
  constraint shipping_rates_lettre_coherente check (
    (kind = 'letter'
       and sendcloud_method_code is null
       and tracked = false
       and needs_service_point = false)
    or (kind <> 'letter' and sendcloud_method_code is not null)
  ),
  -- Le point relais n'est pas une option : c'est ce qui DÉFINIT le type.
  constraint shipping_rates_point_relais_coherent check (
    needs_service_point = (kind = 'service_point')
  )
);

create index if not exists shipping_rates_pays_actif_idx
  on public.shipping_rates (country, is_active, max_weight_g);

comment on table public.shipping_rates is
  'Grille de livraison. Le calcul ne retient qu''une ligne par couple '
  '(carrier, kind) : la moins chère parmi celles dont max_weight_g couvre le colis.';

-- ── RLS : lecture publique des lignes actives, écriture admin ──────────────
alter table public.shipping_settings enable row level security;
alter table public.shipping_rates    enable row level security;

drop policy if exists "Réglages livraison — lecture" on public.shipping_settings;
create policy "Réglages livraison — lecture" on public.shipping_settings
  for select using (true);
drop policy if exists "Réglages livraison — écriture admin" on public.shipping_settings;
create policy "Réglages livraison — écriture admin" on public.shipping_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- Une ligne désactivée ne doit pas être lisible du public : elle trahirait un
-- tarif retiré de la vente, et surtout le client pourrait tenter de la choisir.
drop policy if exists "Tarifs livraison — lecture des actifs" on public.shipping_rates;
create policy "Tarifs livraison — lecture des actifs" on public.shipping_rates
  for select using (is_active or public.is_admin());
drop policy if exists "Tarifs livraison — écriture admin" on public.shipping_rates;
create policy "Tarifs livraison — écriture admin" on public.shipping_rates
  for all using (public.is_admin()) with check (public.is_admin());

-- ── Poids des scellés ──────────────────────────────────────────────────────
-- NULL et non 0 : « pas encore pesé » n'est pas « ne pèse rien ». Un scellé
-- sans poids BLOQUE le devis plutôt que de sous-estimer le port.
alter table public.sealed_products
  add column if not exists weight_g int check (weight_g is null or weight_g > 0);

comment on column public.sealed_products.weight_g is
  'Poids unitaire en grammes. NULL = non pesé : le devis de livraison est refusé '
  'tant que ce produit est au panier.';

-- ── Ce que la commande fige au moment de l'achat ───────────────────────────
alter table public.orders
  -- `on delete set null` : un tarif retiré de la grille ne doit pas emporter la
  -- commande. Le libellé est recopié à côté précisément pour survivre à ça.
  add column if not exists shipping_rate_id     uuid references public.shipping_rates(id) on delete set null,
  add column if not exists shipping_label       text,
  add column if not exists shipping_country     text,
  add column if not exists shipping_weight_g    int,
  add column if not exists handling_fee         numeric(10,2) not null default 0,
  add column if not exists service_point        jsonb,
  add column if not exists sendcloud_parcel_id  text,
  add column if not exists label_url            text;

comment on column public.orders.shipping_label is
  'Libellé du mode de livraison FIGÉ à la commande. Le tarif peut changer ou '
  'disparaître ensuite : la facture, elle, ne doit pas bouger.';
comment on column public.orders.service_point is
  'Point relais choisi : { id, nom, adresse, transporteur }. NULL hors point relais.';

-- ── Grille initiale ────────────────────────────────────────────────────────
-- Prix Sendcloud formule gratuite relevés le 26/09/2026, hors forfait.
-- Les lignes « lettre » sont PROVISOIRES : à confirmer au simulateur bpost
-- selon l'épaisseur réelle de l'enveloppe.
insert into public.shipping_rates
  (code, label, carrier, kind, country, max_weight_g, price, sendcloud_method_code, needs_service_point, tracked, sort_order)
values
  ('letter_be',         'Lettre simple bpost',         'bpost',         'letter',        'BE',   100,  3.26, null, false, false, 10),
  ('letter_fr',         'Lettre simple bpost',         'bpost',         'letter',        'FR',   100,  3.30, null, false, false, 10),
  ('letter_lu',         'Lettre simple bpost',         'bpost',         'letter',        'LU',   100,  3.30, null, false, false, 10),
  ('letter_nl',         'Lettre simple bpost',         'bpost',         'letter',        'NL',   100,  3.30, null, false, false, 10),
  ('letter_de',         'Lettre simple bpost',         'bpost',         'letter',        'DE',   100,  3.30, null, false, false, 10),

  ('mr_sp_be',          'Mondial Relay point relais',  'mondial_relay', 'service_point', 'BE',   250,  3.89, 'mondial_relay:service_point,dualapi/size=l,kg=0-0.25,c2c',               true,  true, 20),
  ('mr_sp_lu',          'Mondial Relay point relais',  'mondial_relay', 'service_point', 'LU',   250,  3.77, 'mondial_relay:service_point,international_dualapi/kg=0-0.25,c2c',        true,  true, 20),
  ('mr_sp_nl',          'Mondial Relay point relais',  'mondial_relay', 'service_point', 'NL',   250,  3.88, 'mondial_relay:service_point,international_dualapi/kg=0-0.25,c2c',        true,  true, 20),
  ('mr_sp_fr',          'Mondial Relay point relais',  'mondial_relay', 'service_point', 'FR',   250,  9.04, 'mondial_relay:service_point,international_dualapi/kg=0-0.25,c2c',        true,  true, 20),

  ('bp_sp_be',          'bpost point relais',          'bpost',         'service_point', 'BE', 10000,  5.44, 'bpost:atbpost-bpack/kg=0-10',                                            true,  true, 30),
  ('bp_sp_fr',          'bpost point relais',          'bpost',         'service_point', 'FR',  2000,  9.35, 'bpost:bpackinternational/kg=0-2',                                        true,  true, 30),
  ('bp_sp_lu',          'bpost point relais',          'bpost',         'service_point', 'LU',  2000,  8.44, 'bpost:bpackinternational/kg=0-2',                                        true,  true, 30),
  ('bp_sp_nl',          'bpost point relais',          'bpost',         'service_point', 'NL',  2000,  8.44, 'bpost:bpackinternational/kg=0-2',                                        true,  true, 30),

  ('bp_home_be',        'bpost à domicile',            'bpost',         'home',          'BE', 10000,  6.19, 'bpost:athome-bpack24hpro/kg=0-10',                                       false, true, 40),
  ('bp_home_fr_light',  'bpost à domicile',            'bpost',         'home',          'FR',   200,  7.68, 'bpost:mailbox,eu/kg=0-0.2',                                              false, true, 40),
  ('bp_home_lu_light',  'bpost à domicile',            'bpost',         'home',          'LU',   200,  7.85, 'bpost:mailbox,eu/kg=0-0.2',                                              false, true, 40),
  ('bp_home_de_light',  'bpost à domicile',            'bpost',         'home',          'DE',   200,  7.74, 'bpost:mailbox,eu/kg=0-0.2',                                              false, true, 40),
  ('bp_home_nl_box',    'bpost boîte aux lettres',     'bpost',         'home',          'NL',  2000,  6.70, 'bpost:mailbox,nl/kg=0-2',                                                false, true, 40),
  ('bp_home_fr_heavy',  'bpost à domicile',            'bpost',         'home',          'FR',  2000, 15.94, 'bpost:international-bpackworldbusiness/kg=0-2',                          false, true, 50),
  ('bp_home_lu_heavy',  'bpost à domicile',            'bpost',         'home',          'LU',  2000, 11.33, 'bpost:international-bpackworldbusiness/kg=0-2',                          false, true, 50),
  ('bp_home_nl_heavy',  'bpost à domicile',            'bpost',         'home',          'NL',  2000, 11.25, 'bpost:international-bpackworldbusiness/kg=0-2',                          false, true, 50),
  ('bp_home_de_heavy',  'bpost à domicile',            'bpost',         'home',          'DE',  2000, 12.20, 'bpost:international-bpackworldbusiness/kg=0-2',                          false, true, 50)
on conflict (code) do nothing;
