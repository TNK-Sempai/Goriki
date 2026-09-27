-- ═══════════════════════════════════════════════════════════════════════════
-- 0056 — Minimum de commande
--
-- Le réglage rejoint `shipping_settings` plutôt qu'une constante du code : comme
-- les tarifs, c'est une décision commerciale qui doit pouvoir changer sans
-- redéploiement. `MIN_ORDER_AMOUNT` avait justement été supprimé de
-- `lib/constants.ts` en mission 2 pour cette raison.
--
-- ─── CE QUE LE MINIMUM MESURE ─────────────────────────────────────────────
-- La valeur des ARTICLES, hors livraison et hors forfait. Un panier de 0,90 €
-- accompagné de 1,63 € de port ne le franchit pas : ce qui est visé, c'est la
-- taille de la commande, pas le montant encaissé.
--
-- `0` désactive le minimum. Le défaut est 1,00 €, valeur décidée par le
-- propriétaire.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.shipping_settings
  add column if not exists min_order_value numeric(10,2) not null default 1.00
    check (min_order_value >= 0);

comment on column public.shipping_settings.min_order_value is
  'Minimum de commande sur la VALEUR DES ARTICLES, hors port et hors forfait. '
  '0 désactive le minimum.';
