-- ─────────────────────────────────────────────────────────────────────────────
-- Aperçus de set : les cartes représentatives d'une extension
--
-- Une tuile de set doit montrer des cartes, qu'il y ait du stock ou non. Les
-- tirer des listings en vente vidait la tuile dès que le stock manquait — ce
-- qui est le cas de presque tout le catalogue aujourd'hui.
--
-- CHOIX DU CRITÈRE : la carte la plus représentative d'un set est la plus rare.
-- Or il existe 47 libellés de rareté distincts entre les deux univers
-- (« SEC », « Hyper rare », « Illustration spéciale rare », « DON!! »…), et la
-- liste bouge à chaque nouvelle extension. Plutôt qu'un classement en dur,
-- on se sert d'un fait mesurable : DANS UN SET DONNÉ, la rareté la moins
-- fréquente est la plus prestigieuse. Un set contient une poignée de SEC et
-- des dizaines de communes.
--
-- Le critère est donc auto-entretenu : il n'a jamais besoin d'être mis à jour,
-- et il fonctionne pour les deux univers sans les distinguer.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.apercus_de_set(p_universe text)
returns table (set_id uuid, image_url text, rang bigint)
language plpgsql
stable
as $$
begin
  if p_universe = 'pokemon' then
    return query
    with frequence as (
      select c.set_id as sid, c.rarity as rar, count(*) as n
      from public.pokemon_cards c
      where c.rarity is not null
      group by c.set_id, c.rarity
    ),
    classe as (
      select c.set_id as sid,
             c.image_url as img,
             row_number() over (
               partition by c.set_id
               order by coalesce(f.n, 2147483647) asc, c.number asc
             ) as rn
      from public.pokemon_cards c
      left join frequence f on f.sid = c.set_id and f.rar = c.rarity
      where c.image_url is not null
    )
    select classe.sid, classe.img, classe.rn from classe where classe.rn <= 3;

  elsif p_universe = 'onepiece' then
    return query
    with frequence as (
      select c.set_id as sid, c.rarity as rar, count(*) as n
      from public.onepiece_cards c
      where c.rarity is not null
      group by c.set_id, c.rarity
    ),
    classe as (
      select c.set_id as sid,
             c.image_url as img,
             row_number() over (
               partition by c.set_id
               order by coalesce(f.n, 2147483647) asc, c.number asc
             ) as rn
      from public.onepiece_cards c
      left join frequence f on f.sid = c.set_id and f.rar = c.rarity
      where c.image_url is not null
    )
    select classe.sid, classe.img, classe.rn from classe where classe.rn <= 3;

  else
    raise exception 'Univers inconnu : %', p_universe;
  end if;
end;
$$;

-- Lecture publique : ce ne sont que des visuels de cartes, déjà publics.
grant execute on function public.apercus_de_set(text) to anon, authenticated;

comment on function public.apercus_de_set(text) is
  'Trois cartes représentatives par set, indépendamment du stock. Classement '
  'auto-entretenu : la rareté la moins fréquente du set passe en tête.';