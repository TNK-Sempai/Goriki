-- Groupe 3 volet B1 — stockage du document d'identité.
--
-- Décision KAEL : bucket Supabase Storage PRIVÉ (`public = false`), chemin
-- `<user_id>/<uuid>.<ext>`. Aucune URL publique n'existe : la lecture ne se fait
-- que par URL signée, générée côté serveur après contrôle du demandeur.
-- Le premier segment du chemin EST l'identifiant du propriétaire : c'est lui que
-- les policies comparent à `auth.uid()`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'identity-documents',
  'identity-documents',
  false,
  5242880, -- 5 Mo
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Dépôt : uniquement dans SON propre dossier.
drop policy if exists "Identité — dépôt propriétaire" on storage.objects;
create policy "Identité — dépôt propriétaire" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'identity-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lecture : le propriétaire ou un admin. Personne d'autre, jamais.
drop policy if exists "Identité — lecture propriétaire ou admin" on storage.objects;
create policy "Identité — lecture propriétaire ou admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'identity-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- Remplacement d'un document refusé : le propriétaire peut écraser le sien.
drop policy if exists "Identité — remplacement propriétaire" on storage.objects;
create policy "Identité — remplacement propriétaire" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'identity-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Identité — suppression propriétaire" on storage.objects;
create policy "Identité — suppression propriétaire" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'identity-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );