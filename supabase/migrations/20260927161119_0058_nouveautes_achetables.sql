-- 0058 : Nouveautés, uniquement des sets réellement achetables
--
-- CE QUE CORRIGE CETTE MIGRATION
-- La vitrine du hero mettait en avant les 2 sets les plus récents de chaque
-- univers, achetables ou non. Elle affichait donc « Bientôt » sur des sets sans
-- une seule carte en vente, et pour DP-12, dont les deux seules cartes sont des
-- DON!! portant le filigrane SAMPLE de l'éditeur, elle affichait ce filigrane.
--
-- POURQUOI UNE FONCTION ET PAS DES REQUÊTES
-- La sélection est un « top 2 par univers » assorti, pour chaque set retenu,
-- d'un « top 3 des cartes achetables ». PostgREST ne sait pas exprimer ce
-- classement par groupe : il aurait fallu rapatrier toutes les annonces en
-- vente pour les regrouper côté serveur Node, soit 1 533 lignes aujourd'hui,
-- au-dessus du plafond `db-max-rows` de 1 000 qui tronque SANS erreur. La page
-- passe de six requêtes à une seule, et le tri se fait là où sont les données.
--
-- SECURITY INVOKER, volontairement : la fonction n'a aucun privilège propre.
-- Elle filtre `is_active` explicitement, donc un administrateur connecté voit
-- exactement la même vitrine qu'un visiteur, alors que sa policy RLS lui
-- donnerait accès aux annonces masquées.

create or replace function public.nouveautes_achetables(
  p_sets_par_univers integer default 2,
  p_apercus integer default 3
)
returns table (
  universe     text,
  set_id       uuid,
  code         text,
  name_fr      text,
  release_date date,
  achetables   bigint,
  images       text[]
)
language sql
stable
security invoker
set search_path to 'public'
as $function$
  with ventes as (
    -- Pokémon : depuis ARCHI-01 l'exemplaire rejoint la carte par sa VARIANTE,
    -- et c'est la variante qui porte le visuel généré.
    select 'pokemon'::text                            as universe,
           coalesce(s.display_parent_id, s.id)        as set_affiche,
           c.id                                       as card_id,
           c.rarity                                   as rarity,
           c.number                                   as number,
           l.price                                    as price,
           -- Même ordre de préférence que `visuelDuListing` : le scan réel de
           -- la pièce passe devant l'illustration de référence.
           coalesce(l.front_photo_url, v.image_url, c.image_url) as visuel,
           true                                       as apercuable
      from public.pokemon_listings l
      join public.pokemon_card_variants v on v.id = l.variant_id
      join public.pokemon_cards c        on c.id = v.card_id
      join public.pokemon_sets s         on s.id = c.set_id
     where l.is_active and l.quantity > 0 and l.price > 0

    union all

    select 'onepiece'::text,
           coalesce(s.display_parent_id, s.id),
           c.id,
           c.rarity,
           c.number,
           l.price,
           coalesce(l.front_photo_url, l.image_api, c.image_url),
           -- Les DON!! ne sont pas des cartes de collection et leur visuel
           -- d'éditeur porte un filigrane SAMPLE. Jamais en vitrine, même
           -- vendus. Le test porte sur les deux colonnes : `card_type` et
           -- `rarity` valent toutes deux « DON!! » en base, et une source qui
           -- n'en renseignerait qu'une seule serait quand même écartée.
           coalesce(c.card_type, '') <> 'DON!!'
             and coalesce(c.rarity, '') <> 'DON!!'
      from public.onepiece_listings l
      join public.onepiece_cards c on c.id = l.card_id
      join public.onepiece_sets s  on s.id = c.set_id
     where l.is_active and l.quantity > 0 and l.price > 0
  ),

  -- Une carte peut avoir plusieurs exemplaires en vente : la vitrine ne doit
  -- pas montrer trois fois le même visuel. On garde le plus cher, qui est
  -- l'exemplaire le mieux conservé dans la pratique de la boutique.
  cartes as (
    select distinct on (universe, set_affiche, card_id)
           universe, set_affiche, card_id, rarity, number, price, visuel, apercuable
      from ventes
     order by universe, set_affiche, card_id, price desc
  ),

  -- Une carte est montrable si elle n'est pas un DON!!, si elle a un visuel, et
  -- si ce visuel n'est pas un fichier d'échantillon.
  montrables as (
    select * from cartes
     where apercuable
       and visuel is not null
       and visuel not ilike '%sample%'
  ),

  comptes as (
    select v.universe, v.set_affiche,
           count(*)                                as achetables,
           count(*) filter (where m.card_id is not null) as montrables
      from ventes v
      left join montrables m
        on m.universe = v.universe and m.set_affiche = v.set_affiche and m.card_id = v.card_id
     group by v.universe, v.set_affiche
  ),

  -- Rareté la moins fréquente EN VENTE dans le set, pas dans le catalogue :
  -- l'aperçu doit représenter ce qu'on peut acheter.
  frequence as (
    select universe, set_affiche, rarity, count(*) as n
      from montrables
     where rarity is not null
     group by universe, set_affiche, rarity
  ),

  classe as (
    select m.universe, m.set_affiche, m.visuel,
           row_number() over (
             partition by m.universe, m.set_affiche
             order by coalesce(f.n, 2147483647) asc, m.price desc, m.number asc
           ) as rn
      from montrables m
      left join frequence f
        on f.universe = m.universe
       and f.set_affiche = m.set_affiche
       and f.rarity is not distinct from m.rarity
  ),

  -- Les sets RATTACHÉS (migration 0057) n'ont pas de page à eux : ils ne sont
  -- jamais candidats, et leur stock a déjà été reporté sur leur parent par le
  -- `coalesce(display_parent_id, id)` ci-dessus.
  candidats as (
    select 'pokemon'::text as u, s.id, s.code, s.name_fr, s.release_date
      from public.pokemon_sets s
     where s.is_active and s.release_date is not null and s.display_parent_id is null
    union all
    select 'onepiece'::text, s.id, s.code, s.name_fr, s.release_date
      from public.onepiece_sets s
     where s.is_active and s.release_date is not null and s.display_parent_id is null
  ),

  retenus as (
    select cd.u, cd.id, cd.code, cd.name_fr, cd.release_date, cp.achetables,
           row_number() over (
             partition by cd.u order by cd.release_date desc, cd.code asc
           ) as rang
      from candidats cd
      join comptes cp on cp.universe = cd.u and cp.set_affiche = cd.id
     -- Au moins une carte MONTRABLE, et pas seulement achetable : un set dont
     -- les seules pièces en vente seraient des DON!! n'aurait aucun aperçu et
     -- reproduirait l'éventail vide qu'on corrige ici.
     where cp.montrables > 0
  )

  select r.u, r.id, r.code, r.name_fr, r.release_date, r.achetables,
         coalesce(
           (select array_agg(cl.visuel order by cl.rn)
              from classe cl
             where cl.universe = r.u and cl.set_affiche = r.id and cl.rn <= p_apercus),
           '{}'::text[]
         )
    from retenus r
   where r.rang <= p_sets_par_univers
   order by r.u, r.release_date desc, r.code;
$function$;

comment on function public.nouveautes_achetables(integer, integer) is
  'Vitrine Nouveautés : les N sets les plus récents de chaque univers ayant au moins une carte achetable et montrable, avec leur nombre d''annonces en vente et jusqu''à N aperçus pris parmi ces seules cartes.';
