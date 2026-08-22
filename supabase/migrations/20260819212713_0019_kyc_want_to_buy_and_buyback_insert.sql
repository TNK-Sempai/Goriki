-- Groupe 3 volet B — vérification d'identité, Want To Buy, soumission de rachat.

-- ── B1. Vérification d'identité (KYC léger) ───────────────────────────────
-- `identity_verified` est la porte d'entrée booléenne (celle que testent les
-- pages et les policies) ; `identity_status` porte les 4 états d'affichage.
-- Les deux sont maintenus cohérents par l'application (verified <=> status).
alter table public.profiles
  add column if not exists identity_verified boolean not null default false,
  add column if not exists identity_status text not null default 'none'
    check (identity_status in ('none', 'pending', 'verified', 'rejected')),
  add column if not exists identity_document_path text,
  add column if not exists identity_submitted_at timestamptz,
  add column if not exists identity_reviewed_at timestamptz,
  add column if not exists identity_rejection_reason text;

comment on column public.profiles.identity_document_path is
  'Chemin dans le bucket privé `identity-documents` (jamais une URL publique). Format : <user_id>/<uuid>.<ext>';

-- ── B3. Want To Buy ───────────────────────────────────────────────────────
-- Référence OPTIONNELLE au catalogue : soit une carte identifiée, soit un
-- champ libre pour ce qui n'existe pas encore en base. Au moins l'un des deux.
create table if not exists public.want_to_buy_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_type text check (card_type in ('pokemon', 'onepiece')),
  card_id uuid,
  free_text text,
  max_price numeric(10, 2) check (max_price is null or max_price >= 0),
  status text not null default 'active' check (status in ('active', 'fulfilled', 'cancelled')),
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint want_to_buy_target check (card_id is not null or free_text is not null)
);

create index if not exists wtb_user_idx on public.want_to_buy_requests (user_id, status);
create index if not exists wtb_card_idx on public.want_to_buy_requests (card_type, card_id)
  where status = 'active';

comment on table public.want_to_buy_requests is
  'Demandes « je cherche cette carte ». N''exige PAS identity_verified — seulement d''être connecté.';

alter table public.want_to_buy_requests enable row level security;

drop policy if exists "WTB — lecture propriétaire" on public.want_to_buy_requests;
create policy "WTB — lecture propriétaire" on public.want_to_buy_requests
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "WTB — insert propriétaire" on public.want_to_buy_requests;
create policy "WTB — insert propriétaire" on public.want_to_buy_requests
  for insert with check (auth.uid() = user_id);

drop policy if exists "WTB — update propriétaire" on public.want_to_buy_requests;
create policy "WTB — update propriétaire" on public.want_to_buy_requests
  for update using (auth.uid() = user_id or public.is_admin());

drop policy if exists "WTB — delete propriétaire" on public.want_to_buy_requests;
create policy "WTB — delete propriétaire" on public.want_to_buy_requests
  for delete using (auth.uid() = user_id);

-- ── B2. Rachat : la table V2 `buyback_requests` existe déjà et convient
-- (items_json porte photos + quantités déclarées + estimation). Il lui manquait
-- seulement le droit d'insertion pour le propriétaire — sans quoi personne ne
-- peut soumettre de demande.
drop policy if exists "Buyback — insert propriétaire" on public.buyback_requests;
create policy "Buyback — insert propriétaire" on public.buyback_requests
  for insert with check (auth.uid() = user_id);