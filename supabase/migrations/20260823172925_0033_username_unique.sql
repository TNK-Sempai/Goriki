-- ─────────────────────────────────────────────────────────────────────────────
-- `display_name` → `username`, et unicité
--
-- POURQUOI RENOMMER : sur Goriki, « display » désigne déjà une BOÎTE DE
-- BOOSTERS (`sealed_products.type = 'display'`). Une colonne `display_name`
-- dans ce vocabulaire se lit spontanément « nom du display », pas « pseudo ».
--
-- POURQUOI `username` ET NON `pseudo` : toutes les colonnes de `profiles` sont
-- en anglais snake_case (full_name, avatar_url, store_credit, identity_status,
-- identity_document_path). `pseudo` y serait la seule colonne française.
--
-- ÉTAT AVANT MIGRATION : 1 profil, 0 valeur renseignée, donc 0 doublon —
-- vérifié en strict ET à la casse près avant de poser la contrainte.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles rename column display_name to username;

-- La contrainte de longueur suit le renommage.
alter table public.profiles
  rename constraint profiles_display_name_len to profiles_username_len;

-- UNICITÉ INSENSIBLE À LA CASSE. Un index sur la valeur brute laisserait
-- coexister « Tanuki » et « tanuki » : deux comptes indiscernables à l'œil d'un
-- acheteur, ce qui est exactement l'usurpation que l'unicité doit empêcher.
-- On indexe aussi sans espaces de bord, pour la même raison.
-- Index partiel : NULL n'est pas un pseudo, et plusieurs comptes sans pseudo
-- doivent rester possibles.
create unique index if not exists profiles_username_unique
  on public.profiles (lower(btrim(username)))
  where username is not null;

comment on column public.profiles.username is
  'Pseudonyme public, unique (casse et espaces de bord ignorés). Seul champ de '
  'profil destiné à devenir visible des autres membres. Ne doit jamais recevoir '
  'd''identité réelle — celle-ci vit dans full_name, jamais exposé.';