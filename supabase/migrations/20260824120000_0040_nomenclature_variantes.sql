-- 0040 — Nomenclature complète des variantes (#VAR-01)
--
-- DÉCISION : un tampon ou une distinction de tirage est un TYPE DE VARIANTE à
-- part entière, au même titre que Reverse ou Holo — pas une propriété posée sur
-- une variante existante. Un « Reverse tamponné PreRelease » est une pièce
-- distincte, qui se vend, se stocke et se photographie séparément ; en faire un
-- attribut de la Reverse aurait obligé à dédoubler les exemplaires ailleurs.
--
-- Le constat qui l'impose : sur les huit sets du bloc Méga-Évolution, la
-- comparaison aux checklists PokéCardex donne 264 variantes manquantes. Sur
-- « Héros Transcendants » à elle seule, l'écart de 136 s'explique intégralement
-- par les reverses à ball spéciale — 147 à la checklist, 11 en base.
--
-- CETTE MIGRATION NE TOUCHE PAS `pokemon_card_variants`. Elle n'ouvre que le
-- vocabulaire ; la saisie des variantes manquantes est un travail manuel, set
-- par set, checklist en regard.

-- ── 1. Vocabulaire de `source` ─────────────────────────────────────────────
--
-- La contrainte d'origine acceptait 'api' et 'custom'. 'custom' n'a jamais été
-- employé — aucune ligne ne le porte, aucun fichier TypeScript ne le nomme — et
-- c'était le seul terme anglais d'un schéma qui dit `image_manuelle` et
-- `edition_manuelle`. On le remplace plutôt que d'ajouter 'manuel' à côté :
-- deux synonymes pour la même chose, c'est la garantie que les deux finissent
-- par être utilisés au hasard.
alter table public.pokemon_variant_types
  drop constraint pokemon_variant_types_source_check;

alter table public.pokemon_variant_types
  add constraint pokemon_variant_types_source_check
  check (source in ('api', 'manuel'));

comment on column public.pokemon_variant_types.source is
  'api = venu de TCGdex à l''import · manuel = saisi depuis le back-office. '
  'Sert à distinguer ce qu''un réimport peut reprendre de ce qui n''existe que '
  'par notre relevé des checklists.';

-- ── 2. Les types relevés sur le bloc Méga-Évolution ────────────────────────
--
-- Libellés EXACTEMENT tels qu'ils apparaissent chez PokéCardex : c'est la
-- checklist qu'on a sous les yeux en saisissant, et traduire ou normaliser les
-- libellés obligerait à faire la correspondance de tête à chaque ligne.
--
-- `sort_order` par bandes de dizaines, avec des trous : les 11 types d'API
-- occupent 1–11, l'impression 20–21, les tampons 30–44, les distinctions
-- 60–70. Insérer un type entre deux autres ne demandera donc pas de renuméroter
-- toute la table — et l'ajout depuis l'écran d'administration, lui, se pose
-- simplement à la fin.
--
-- `ROCKET` n'est PAS recréé : il existe déjà (sort_order 11), et le bloc
-- « Reverse (Rocket) » de la checklist s'y rattache.
insert into public.pokemon_variant_types (set_id, code, label, source, sort_order) values
  -- Traitements d'impression
  (null, 'HOLO_COSMOS',                'Holo Cosmos',                      'manuel', 20),
  (null, 'NON_HOLO',                   'Non Holo',                         'manuel', 21),

  -- Tampons
  (null, 'TAMPON_LOGO_EXT',            'Tampon (logo extension)',          'manuel', 30),
  (null, 'TAMPON_LOGO_EXT_GAUCHE',     'Tampon (logo extension gauche)',   'manuel', 31),
  (null, 'TAMPON_EB_GAMES',            'Tampon (EB Games)',                'manuel', 32),
  (null, 'TAMPON_GAMESTOP',            'Tampon (GameStop)',                'manuel', 33),
  (null, 'TAMPON_POKEMON_CENTER',      'Tampon (Pokémon Center)',          'manuel', 34),
  (null, 'TAMPON_PRERELEASE',          'Tampon (PreRelease)',              'manuel', 35),
  (null, 'TAMPON_POKEMON_DAY',         'Tampon (Pokemon Day)',             'manuel', 36),
  (null, 'TAMPON_REGIONAL',            'Tampon (Regional Championships)',  'manuel', 37),
  (null, 'TAMPON_LAIC',                'Tampon (LAIC)',                    'manuel', 38),
  (null, 'TAMPON_NAIC',                'Tampon (NAIC)',                    'manuel', 39),
  (null, 'TAMPON_ULTRA_BALL_LEAGUE',   'Tampon (Ultra Ball League)',       'manuel', 40),
  (null, 'TAMPON_MASTER_BALL_LEAGUE',  'Tampon (Master Ball League)',      'manuel', 41),
  (null, 'TAMPON_TRICK_OR_TRADE',      'Tampon (Trick or Trade)',          'manuel', 42),
  (null, 'TAMPON_PROFESSOR_PROGRAM',   'Tampon (Professor Program)',       'manuel', 43),
  (null, 'TAMPON_PREFERE',             'Tampon (Quel est ton préféré ?)',  'manuel', 44),

  -- Distinctions de tournoi
  (null, 'STAFF_PRERELEASE',           'Staff (PreRelease)',               'manuel', 60),
  (null, 'STAFF_REGIONAL',             'Staff (Regional Championships)',   'manuel', 61),
  (null, 'STAFF_LAIC',                 'Staff (LAIC)',                     'manuel', 62),
  (null, 'STAFF_NAIC',                 'Staff (NAIC)',                     'manuel', 63),
  (null, 'STAFF_PROFESSOR_PROGRAM',    'Staff (Professor Program)',        'manuel', 64),
  (null, 'CHAMPION_LAIC',              'Champion (LAIC)',                  'manuel', 65),
  (null, 'CHAMPION_PROFESSOR_PROGRAM', 'Champion (Professor Program)',     'manuel', 66),
  (null, 'TOP4_PROFESSOR_PROGRAM',     'Top 4 (Professor Program)',        'manuel', 67),
  (null, 'TOP8_LAIC',                  'Top 8 (LAIC)',                     'manuel', 68),
  (null, 'TOP8_PROFESSOR_PROGRAM',     'Top 8 (Professor Program)',        'manuel', 69),
  (null, 'WINNER_PROMO',               'Winner (Promo)',                   'manuel', 70)
on conflict (set_id, code) do nothing;

-- ── 3. Créer un type depuis le back-office, sans migration ─────────────────
--
-- Ces 28 libellés viennent d'UN SEUL bloc de huit sets. Il en apparaîtra
-- d'autres sur les 177 sets restants, et attendre une migration à chaque
-- découverte arrêterait le nettoyage à chaque fois. La nomenclature doit donc
-- rester ouverte depuis l'écran.
--
-- Passe par une RPC et non par un `insert` PostgREST direct, comme toutes les
-- écritures d'administration : la garde `is_admin()` vit alors dans la base et
-- tient même si l'appel était contourné, et le code normalisé est calculé au
-- même endroit pour tout le monde.
create or replace function public.admin_creer_type_variante(
  p_code text,
  p_label text,
  p_sort_order integer default null
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_code text;
  v_label text;
  v_ordre integer;
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  v_label := btrim(coalesce(p_label, ''));
  if v_label = '' then
    raise exception 'Le libellé est obligatoire.' using errcode = 'check_violation';
  end if;

  -- Code normalisé : majuscules, accents retirés, tout ce qui n'est pas
  -- alphanumérique replié en `_`. Un code est un identifiant technique, il ne
  -- doit pas dépendre de la façon dont le libellé a été tapé.
  v_code := coalesce(nullif(btrim(p_code), ''), v_label);
  v_code := upper(translate(v_code,
    'àâäáãåçèêëéìîïíñòôöóõùûüúýÿÀÂÄÁÃÅÇÈÊËÉÌÎÏÍÑÒÔÖÓÕÙÛÜÚÝ',
    'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY'));
  v_code := regexp_replace(v_code, '[^A-Z0-9]+', '_', 'g');
  v_code := btrim(v_code, '_');

  if v_code = '' then
    raise exception 'Le libellé ne produit aucun code exploitable.' using errcode = 'check_violation';
  end if;

  if exists (select 1 from public.pokemon_variant_types t
              where t.set_id is null and t.code = v_code) then
    raise exception 'Un type porte déjà le code % .', v_code using errcode = 'unique_violation';
  end if;

  -- Sans ordre demandé, le type se pose à la fin, sur la dizaine suivante :
  -- il reste ainsi de la place pour l'insérer plus tard au bon endroit.
  v_ordre := coalesce(
    p_sort_order,
    (select ((max(sort_order) / 10) + 1) * 10 from public.pokemon_variant_types where set_id is null)
  );

  insert into public.pokemon_variant_types (set_id, code, label, source, sort_order)
  values (null, v_code, v_label, 'manuel', v_ordre)
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.admin_creer_type_variante(text, text, integer) from public;
grant execute on function public.admin_creer_type_variante(text, text, integer) to authenticated;

-- ── 4. `variantes_autorisees` : dire vraiment « les types globaux » ────────
--
-- La branche de repli renvoyait TOUS les types, y compris ceux rattachés à un
-- set — ce qui ne s'est jamais vu parce qu'aucun type n'est rattaché à un set
-- aujourd'hui. Avec 39 types, laisser cette porte ouverte reviendrait à
-- proposer un jour, sur un set quelconque, un type créé pour un autre.
-- Comportement inchangé sur la base actuelle, vérifié : les 39 ont `set_id`
-- nul.
create or replace function public.variantes_autorisees(p_set_id uuid)
returns setof public.pokemon_variant_types
language sql
stable
as $$
  -- Le set restreint sa liste ? On sert cette liste, telle qu'elle a été posée.
  select t.* from public.pokemon_variant_types t
   where exists (select 1 from public.pokemon_set_variant_types a
                  where a.set_id = p_set_id and a.variant_type_id = t.id)
  union all
  -- Sinon : les types GLOBAUX, plus ceux taillés pour ce set précis.
  select t.* from public.pokemon_variant_types t
   where not exists (select 1 from public.pokemon_set_variant_types a where a.set_id = p_set_id)
     and (t.set_id is null or t.set_id = p_set_id)
$$;
