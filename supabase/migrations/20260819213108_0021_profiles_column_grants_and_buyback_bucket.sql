-- ── Élévation de privilèges sur `profiles` (préexistante, critique) ───────
-- La policy « Profiles — update propriétaire » autorise `auth.uid() = id`, mais
-- RLS ne restreint PAS les colonnes : `authenticated` détenait le UPDATE sur
-- TOUTES les colonnes. N'importe quel utilisateur connecté pouvait donc se
-- passer `role = 'admin'`, se créditer un `store_credit` arbitraire — et, depuis
-- la migration 0019, se déclarer `identity_verified = true`, ce qui viderait le
-- KYC de tout sens.
--
-- Correctif : privilèges au niveau COLONNE. Seuls les champs réellement
-- éditables par leur propriétaire restent ouverts. Tout le reste (rôle, avoir,
-- statut d'identité) ne se modifie plus que côté serveur, en service-role.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, avatar_url) on public.profiles to authenticated;

-- ── B2. Photos de rachat ──────────────────────────────────────────────────
-- Même doctrine que le document d'identité : bucket privé, chemin préfixé par
-- l'identifiant du propriétaire, lecture propriétaire ou admin uniquement.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'buyback-photos',
  'buyback-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Rachat — dépôt propriétaire" on storage.objects;
create policy "Rachat — dépôt propriétaire" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'buyback-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Rachat — lecture propriétaire ou admin" on storage.objects;
create policy "Rachat — lecture propriétaire ou admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'buyback-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists "Rachat — suppression propriétaire" on storage.objects;
create policy "Rachat — suppression propriétaire" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'buyback-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );