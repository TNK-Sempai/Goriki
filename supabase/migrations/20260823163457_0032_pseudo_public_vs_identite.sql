-- ─────────────────────────────────────────────────────────────────────────────
-- Pseudo public ≠ identité réelle
--
-- ÉTAT TROUVÉ AVANT MIGRATION : `profiles` ne portait qu'UN SEUL champ de nom,
-- `full_name`, et il servait déjà d'identité — c'est lui qui est imprimé sur la
-- facture PDF (`/api/invoice/[id]`) et employé comme `customerName` dans les
-- e-mails de confirmation de commande. Le flux de vérification (mission 10) ne
-- capture, lui, AUCUN nom : seulement un document (`identity_document_path`) et
-- un statut. Il n'existait donc pas de « nom légal » distinct à séparer d'un
-- pseudo : il existait un champ d'identité utilisé sans étiquette claire.
--
-- DÉCISION : on ne renomme pas `full_name` et on ne déplace aucune donnée — ce
-- serait casser la facturation pour un gain cosmétique. On ajoute à côté un
-- champ d'AFFICHAGE, et on donne à chacun un rôle écrit noir sur blanc.
--
--   full_name    → identité. Facture, e-mails, admin. JAMAIS public.
--   display_name → pseudonyme. Le seul champ qu'on pourra un jour exposer.
--
-- EXPOSITION PUBLIQUE : aucune ici, volontairement. La RLS de `profiles` reste
-- « propriétaire ou admin » et n'est pas touchée. Le jour où l'attribution
-- publique d'un dépôt sera voulue, elle passera par une fonction
-- SECURITY DEFINER ne renvoyant que `display_name` — comme `mes_depots()` ou
-- `want_to_buy_radar()`. Ouvrir la table entière exposerait `email`,
-- `full_name` et `store_credit` du même coup.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists display_name text;

-- Un pseudo vide ou d'un seul caractère n'est pas un pseudo ; au-delà de 32 il
-- ne tient plus dans une attribution.
alter table public.profiles
  drop constraint if exists profiles_display_name_len;
alter table public.profiles
  add constraint profiles_display_name_len
  check (display_name is null or char_length(btrim(display_name)) between 2 and 32);

comment on column public.profiles.display_name is
  'Pseudonyme d''affichage. Seul champ de profil destiné à devenir public un '
  'jour (attribution dépôt-vente). Ne doit jamais recevoir d''identité réelle.';

comment on column public.profiles.full_name is
  'Identité — nom porté sur la facture et dans les e-mails de commande. Lié au '
  'flux de vérification : verrouillé dès que identity_status = ''verified''. '
  'Jamais exposé publiquement (RLS : propriétaire ou admin).';

-- Le titulaire peut choisir son pseudo librement. La migration 0021 avait
-- réduit le GRANT UPDATE aux seules colonnes `full_name` et `avatar_url` ;
-- on l'étend, sans rien rouvrir d'autre.
grant update (display_name) on public.profiles to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verrou : le nom d'identité ne se réécrit plus après vérification.
--
-- Sans ce verrou, la séparation serait décorative : un compte vérifié pourrait
-- changer son `full_name` en un clic et le document contrôlé ne correspondrait
-- plus au nom facturé. Le contrôle est en base et non dans le formulaire, car
-- PostgREST est joignable directement.
--
-- Le statut de validation s'appelle 'verified' (et non 'approved') — valeurs
-- réelles de la contrainte : none, pending, verified, rejected.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.profiles_verrou_identite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.full_name is distinct from old.full_name
     and old.identity_status = 'verified'
     and not public.is_admin()
  then
    raise exception
      'Le nom d''identité ne peut plus être modifié une fois la vérification acceptée.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_verrou_identite on public.profiles;
create trigger profiles_verrou_identite
  before update on public.profiles
  for each row execute function public.profiles_verrou_identite();

comment on function public.profiles_verrou_identite() is
  'Empêche la réécriture de profiles.full_name après vérification d''identité. '
  'L''admin reste autorisé, pour corriger une saisie.';