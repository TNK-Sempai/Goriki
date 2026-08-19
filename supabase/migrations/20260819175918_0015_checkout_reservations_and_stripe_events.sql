-- Mission 03 — cycle de checkout serveur, réservation de stock, idempotence Stripe.
-- Décision d'archi #15 (KAEL) : le panier vit dans une commande `pending` créée AVANT
-- la session Stripe ; seule sa référence transite par metadata (limite 500 car.).

-- 1. Colonnes de cycle de vie du checkout
alter table public.orders
  add column if not exists checkout_expires_at timestamptz,
  add column if not exists needs_review boolean not null default false,
  add column if not exists review_reason text;

comment on column public.orders.checkout_expires_at is
  'TTL de la commande pending : au-delà, la réservation de stock est libérée et la commande purgée. NULL dès que payée.';
comment on column public.orders.needs_review is
  'Commande payée dont le décrément de stock a échoué — à arbitrer par l''admin (jamais de stock négatif silencieux).';

-- 2. Idempotence webhook : une session Stripe ne peut porter qu'une commande
create unique index if not exists orders_stripe_session_id_key
  on public.orders (stripe_session_id)
  where stripe_session_id is not null;

-- 3. Balayage des checkouts expirés
create index if not exists orders_pending_expiry_idx
  on public.orders (checkout_expires_at)
  where status = 'pending';

-- 4. Réservations de stock (polymorphe : pokemon / onepiece / sealed)
create table if not exists public.stock_reservations (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  item_type text not null check (item_type in ('pokemon', 'onepiece', 'sealed')),
  item_id uuid not null,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index if not exists stock_reservations_item_idx
  on public.stock_reservations (item_type, item_id);

create unique index if not exists stock_reservations_order_item_key
  on public.stock_reservations (order_id, item_type, item_id);

comment on table public.stock_reservations is
  'Réservation courte le temps du checkout. Disponible = quantity - somme des réservations dont la commande est pending et non expirée.';

-- 5. Journal des événements Stripe (idempotence + trace des échecs de paiement)
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  order_id uuid references public.orders(id) on delete set null,
  received_at timestamptz not null default now(),
  payload jsonb
);

create index if not exists stripe_events_type_idx on public.stripe_events (type, received_at desc);

comment on table public.stripe_events is
  'Un événement Stripe traité une seule fois (PK = event.id). Sert aussi de trace pour payment_intent.payment_failed.';

-- 6. RLS : ces deux tables sont purement serveur (écrites en service-role, qui bypasse RLS).
--    Aucune policy publique : seul l'admin peut lire depuis un client authentifié.
alter table public.stock_reservations enable row level security;
alter table public.stripe_events enable row level security;

drop policy if exists "Stock reservations — admin" on public.stock_reservations;
create policy "Stock reservations — admin" on public.stock_reservations
  for all using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

drop policy if exists "Stripe events — admin" on public.stripe_events;
create policy "Stripe events — admin" on public.stripe_events
  for all using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

-- 7. Nettoyage : fonction orpheline (rattachée à aucun trigger), remplacée par les RPC de 0016.
drop function if exists public.decrement_stock_on_paid_order();