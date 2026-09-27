-- ═══════════════════════════════════════════════════════════════════════════
-- 0044 — Reprise des 29 210 variantes vers le modèle à trois axes
--
-- Les contrôles ci-dessous sont des ASSERTIONS, pas un rapport. Une divergence
-- lève une exception, la transaction est annulée et la base reste dans son état
-- d'avant. C'est la seule façon d'obtenir « toute divergence → arrêt » sur une
-- reprise de 29 210 lignes : un rapport qu'on lit après coup arrive trop tard.
--
-- ⚠️ PIÈGE RENCONTRÉ, ET C'EST L'ASSERTION QUI L'A ATTRAPÉ. Une première
-- version calculait la finition par `lateral (select … where t.code = 'HOLO')`
-- placé dans le FROM de l'UPDATE. Un `lateral` y est une jointure INTERNE :
-- pour toute ligne non-HOLO il ne renvoyait rien, et la ligne était donc exclue
-- de la mise à jour. 23 159 variantes seraient restées sans tirage. Le contrôle
-- a levé, la transaction a été annulée, et la base est restée intacte — d'où
-- les sous-requêtes scalaires ci-dessous, qui rendent NULL sans filtrer.
--
-- Vérifié avant d'écrire : la conversion produit 29 210 combinaisons
-- (card_id, tirage, finition) DISTINCTES, donc zéro collision avec la
-- contrainte d'unicité posée en fin de fichier.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_total        int;
  v_sans_tirage  int;
  v_attendu      int;
  v_obtenu       int;
  attendus text[][] := array[
    ['NORMALE',            '20935'],  -- 14 884 NORMAL modernes + 6 051 HOLO
    ['ILLIMITE',             '568'],  -- NORMAL sur set antérieur au 01/03/2002
    ['PREMIERE_EDITION',     '676'],
    ['REVERSE',             '7017'],
    ['REVERSE_POKEBALL',       '8'],
    ['REVERSE_COPAIN',         '2'],
    ['REVERSE_LOVE',           '2'],
    ['REVERSE_RAPIDE',         '1'],
    ['REVERSE_SOMBRE',         '1']
  ];
begin
  select count(*) into v_total from public.pokemon_card_variants;
  if v_total <> 29210 then
    raise exception 'Reprise annulée : % lignes avant reprise, 29 210 attendues.', v_total;
  end if;

  -- ── La conversion ────────────────────────────────────────────────────────
  -- `NORMAL` n'a pas UN sens mais deux, selon l'époque du set. Avant le
  -- 01/03/2002, les checklists Wizards ne portent que deux tirages — 1ère
  -- édition et Illimité — et « Normale » n'y existe pas : y convertir NORMAL
  -- en « Normale » aurait inventé un tirage jamais imprimé.
  update public.pokemon_card_variants v
     set tirage_id = (
           select ti.id from public.pokemon_variant_tirages ti
            where ti.code = case
              when t.code = 'NORMAL' and s.release_date < date '2002-03-01' then 'ILLIMITE'
              when t.code = 'NORMAL'        then 'NORMALE'
              when t.code = 'FIRST_EDITION' then 'PREMIERE_EDITION'
              when t.code = 'HOLO'          then 'NORMALE'
              when t.code = 'REVERSE'       then 'REVERSE'
              when t.code = 'POKEBALL'      then 'REVERSE_POKEBALL'
              when t.code = 'COPAIN'        then 'REVERSE_COPAIN'
              when t.code = 'LOVE'          then 'REVERSE_LOVE'
              when t.code = 'RAPIDE'        then 'REVERSE_RAPIDE'
              when t.code = 'SOMBRE'        then 'REVERSE_SOMBRE'
            end
         ),
         -- Seul `HOLO` porte une finition connue. Partout ailleurs la source ne
         -- dit rien : on laisse NULL — « non déterminée » — plutôt que de
         -- supposer « non-holo », qui serait une affirmation sans preuve.
         finition_id = case when t.code = 'HOLO'
           then (select fi.id from public.pokemon_variant_finitions fi where fi.code = 'HOLO')
         end
    from public.pokemon_variant_types t,
         public.pokemon_cards c,
         public.pokemon_sets s
   where t.id = v.variant_type_id
     and c.id = v.card_id
     and s.id = c.set_id;

  -- ── Contrôle 1 — aucune ligne sans tirage ────────────────────────────────
  select count(*) into v_sans_tirage from public.pokemon_card_variants where tirage_id is null;
  if v_sans_tirage <> 0 then
    raise exception 'Reprise annulée : % variante(s) sans tirage.', v_sans_tirage;
  end if;

  -- ── Contrôle 2 — total strictement inchangé ──────────────────────────────
  select count(*) into v_total from public.pokemon_card_variants;
  if v_total <> 29210 then
    raise exception 'Reprise annulée : % lignes après reprise, 29 210 attendues.', v_total;
  end if;

  -- ── Contrôle 3 — répartition par tirage, ligne à ligne ───────────────────
  for i in 1 .. array_length(attendus, 1) loop
    v_attendu := attendus[i][2]::int;
    select count(*) into v_obtenu
      from public.pokemon_card_variants v
      join public.pokemon_variant_tirages ti on ti.id = v.tirage_id
     where ti.code = attendus[i][1];
    if v_obtenu <> v_attendu then
      raise exception 'Reprise annulée : tirage % → % lignes, % attendues.',
        attendus[i][1], v_obtenu, v_attendu;
    end if;
  end loop;

  -- ── Contrôle 4 — finitions : seules les ex-HOLO en portent une ───────────
  select count(*) into v_obtenu from public.pokemon_card_variants where finition_id is not null;
  if v_obtenu <> 6051 then
    raise exception 'Reprise annulée : % finition(s) posée(s), 6 051 attendues.', v_obtenu;
  end if;

  -- ── Contrôle 5 — aucun exemplaire orphelin ───────────────────────────────
  -- La reprise ne touche aucune ligne de `pokemon_listings`, mais c'est
  -- précisément ce qu'il faut PROUVER : un exemplaire dont la variante a
  -- disparu est un objet physique devenu invendable sans que rien ne le dise.
  select count(*) into v_obtenu
    from public.pokemon_listings l
   where not exists (select 1 from public.pokemon_card_variants v where v.id = l.variant_id);
  if v_obtenu <> 0 then
    raise exception 'Reprise annulée : % exemplaire(s) orphelin(s).', v_obtenu;
  end if;

  raise notice 'Reprise vérifiée : 29 210 lignes, 0 sans tirage, 6 051 finitions, 0 orphelin.';
end $$;

-- ── Les deux contraintes, posées SEULEMENT maintenant ──────────────────────
-- Elles étaient impossibles en 0043 : `NOT NULL` sur une colonne vide, et
-- l'unicité sur quatre colonnes toutes à NULL aurait vu autant de doublons que
-- de cartes à plusieurs variantes.
alter table public.pokemon_card_variants
  alter column tirage_id set not null;

-- `NULLS NOT DISTINCT` est le cœur de la contrainte : par défaut Postgres tient
-- deux NULL pour différents, et deux lignes `(carte, Normale, NULL, NULL)`
-- passeraient toutes les deux — c'est exactement le doublon qu'on interdit.
alter table public.pokemon_card_variants
  drop constraint if exists pokemon_card_variants_trois_axes_key;

alter table public.pokemon_card_variants
  add constraint pokemon_card_variants_trois_axes_key
  unique nulls not distinct (card_id, tirage_id, finition_id, tampon_id);

notify pgrst, 'reload schema';
