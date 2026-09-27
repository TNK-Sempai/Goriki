-- ═══════════════════════════════════════════════════════════════════════════
-- 0054 — Want to Buy : une seule demande ACTIVE par carte et par client
--
-- ─── POURQUOI L'INDEX EST PARTIEL, ET SUR TROIS COLONNES ──────────────────
--
-- `status = 'active'` : une demande satisfaite ou annulée ne doit PAS bloquer
-- une nouvelle recherche sur la même carte. Un client qui a trouvé sa carte
-- puis la recherche à nouveau (autre état, autre exemplaire) doit pouvoir
-- redemander. Un index total l'en empêcherait pour toujours.
--
-- `card_id is not null` : une recherche libre n'a pas de référence. Deux
-- descriptions en texte libre ne sont jamais « la même carte » — les comparer
-- n'aurait aucun sens. Postgres considère déjà deux NULL comme distincts
-- (NULLS DISTINCT par défaut), donc le prédicat ne change pas le résultat : il
-- rend l'intention lisible et garde l'index petit.
--
-- `card_type` fait partie de la clé : rien ne garantit qu'un uuid de carte
-- Pokémon ne puisse pas croiser un uuid One Piece.
--
-- Reprise : AUCUNE. La table compte 0 ligne au moment de cette migration —
-- vérifié, pas supposé. Sur une table peuplée, il aurait fallu résorber les
-- doublons actifs AVANT, sinon la création échoue.
-- ═══════════════════════════════════════════════════════════════════════════

create unique index if not exists want_to_buy_actif_unique
  on public.want_to_buy_requests (user_id, card_type, card_id)
  where status = 'active' and card_id is not null;

comment on index public.want_to_buy_actif_unique is
  'Interdit deux demandes ACTIVES sur la même carte pour un même client. '
  'Les recherches libres (card_id NULL) et les demandes trouvées ou annulées '
  'en sont volontairement exclues.';

-- ─── LA POLICY UPDATE N'AVAIT PAS DE `WITH CHECK` ─────────────────────────
--
-- `USING` décide quelles lignes on a le droit de MODIFIER ; `WITH CHECK` décide
-- ce que la ligne a le droit de DEVENIR. Sans le second, le propriétaire d'une
-- demande pouvait réécrire `user_id` et déplacer sa ligne dans la liste d'un
-- autre client — la lecture de l'autre compte l'aurait alors affichée.
--
-- L'écran /compte/want-to-buy commence ici à faire des UPDATE ; on ferme avant,
-- pas après. La condition est la copie exacte de `USING` : aucune écriture
-- jusqu'ici légitime n'est refusée, seul le changement de propriétaire l'est.
drop policy if exists "WTB — update propriétaire" on public.want_to_buy_requests;
create policy "WTB — update propriétaire" on public.want_to_buy_requests
  for update
  using       ((auth.uid() = user_id) or public.is_admin())
  with check  ((auth.uid() = user_id) or public.is_admin());
