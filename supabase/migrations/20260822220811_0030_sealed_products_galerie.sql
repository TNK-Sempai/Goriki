-- ─────────────────────────────────────────────────────────────────────────────
-- Produits scellés : plusieurs visuels pour un même SKU
--
-- Même produit, même prix, même stock — seulement plusieurs photos à montrer.
-- La colonne devient donc un TABLEAU, et non une table fille : il n'y a aucune
-- donnée propre à chaque image (ni prix, ni stock, ni ordre métier autre que
-- celui de la liste).
--
-- DÉCISION D'ARCHITECTURE (KAEL) sur le sort de `image_url` — trois options :
--   · la garder en parallèle → deux sources de vérité, dérive garantie ;
--   · la supprimer → il faut retoucher tout lecteur, y compris ceux qu'on ne
--     voit pas (SQL manuel, exports) ;
--   · la RENDRE DÉRIVÉE → retenue.
--
-- `image_url` devient une colonne GÉNÉRÉE valant `image_urls[1]`. Conséquences :
--   · tout lecteur existant continue de fonctionner sans modification ;
--   · la dérive est structurellement impossible, ce n'est plus une copie ;
--   · toute ÉCRITURE sur `image_url` échoue désormais — c'est voulu, elle force
--     à passer par `image_urls`, seule source de vérité.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.sealed_products
  add column if not exists image_urls text[] not null default '{}';

-- Reprise des visuels déjà saisis, en première position.
update public.sealed_products
   set image_urls = array[image_url]
 where image_url is not null
   and coalesce(array_length(image_urls, 1), 0) = 0;

-- `image_url` cesse d'être stockée pour devenir un miroir en lecture seule.
alter table public.sealed_products drop column image_url;
alter table public.sealed_products
  add column image_url text generated always as (image_urls[1]) stored;

comment on column public.sealed_products.image_urls is
  'Visuels du produit, dans l''ordre d''affichage. Le premier sert de vignette. '
  'Source de vérité unique — c''est ici qu''on écrit.';
comment on column public.sealed_products.image_url is
  'DÉRIVÉE de image_urls[1], en lecture seule. Conservée pour ne pas casser les '
  'lecteurs existants ; toute écriture doit viser image_urls.';