-- Mission 03 (suite) — fermeture de la lecture publique des profils.
-- La policy « Profiles — lecture publique » était en USING (true) : n'importe quel
-- visiteur, même non connecté, pouvait lire tous les emails, `store_credit` et `role`
-- via /rest/v1/profiles.
--
-- `public.is_admin()` est SECURITY DEFINER + STABLE : le SELECT interne sur profiles
-- ne repasse pas par RLS, donc pas de récursion de policy. Son EXECUTE doit RESTER
-- accordé à anon/authenticated — la policy l'évalue avec les droits de l'appelant.

drop policy if exists "Profiles — lecture publique" on public.profiles;

create policy "Profiles — lecture propriétaire ou admin" on public.profiles
  for select
  using (auth.uid() = id or public.is_admin());