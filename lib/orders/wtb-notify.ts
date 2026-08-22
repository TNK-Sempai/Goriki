import type { SupabaseClient } from '@supabase/supabase-js'
import { resend, FROM_EMAIL } from '@/lib/resend'
import { SITE_URL } from '@/lib/constants'

/**
 * Point d'ancrage des notifications « Want To Buy ».
 *
 * À appeler quand un listing devient disponible — typiquement depuis le moteur
 * d'import ou l'édition de stock en admin, une fois qu'ils sauront le faire.
 * Rien ne l'appelle encore : c'est volontaire, l'accroche est posée pour que le
 * jour venu il n'y ait qu'un appel à écrire, pas une mécanique à concevoir.
 *
 * ⚠️ `RESEND_API_KEY` est un placeholder connu : l'envoi échoue et l'échec est
 * loggé sans jamais interrompre l'appelant. Ce n'est pas un bug à corriger ici.
 *
 * @param supabase client SERVICE-ROLE (il faut lire les demandes de tous les utilisateurs)
 */
export async function notifyWantToBuyMatches(
  supabase: SupabaseClient,
  match: { cardType: 'pokemon' | 'onepiece'; cardId: string; listingId: string; price: number }
): Promise<number> {
  const { data: requests, error } = await supabase
    .from('want_to_buy_requests')
    .select('id, user_id, max_price')
    .eq('status', 'active')
    .eq('card_type', match.cardType)
    .eq('card_id', match.cardId)
    .is('notified_at', null)

  if (error) {
    console.error('[wtb] lecture des demandes:', error.message)
    return 0
  }

  const targets = (requests ?? []).filter(
    r => r.max_price === null || match.price <= Number(r.max_price)
  )
  if (targets.length === 0) return 0

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', targets.map(t => t.user_id))

  const byId = new Map((profiles ?? []).map(p => [p.id, p]))
  let sent = 0

  for (const target of targets) {
    const profile = byId.get(target.user_id)
    if (!profile?.email) continue
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: profile.email,
        subject: 'Une carte de votre liste vient d’arriver — Goriki',
        html: `<p>Bonjour ${profile.full_name ?? ''},</p>
<p>Une carte que vous recherchez est désormais disponible.</p>
<p><a href="${SITE_URL}/${match.listingId}">Voir la carte</a></p>`,
      })
      sent += 1
    } catch (err) {
      console.error('[wtb] envoi email échoué:', err)
    }
  }

  await supabase
    .from('want_to_buy_requests')
    .update({ notified_at: new Date().toISOString() })
    .in('id', targets.map(t => t.id))

  return sent
}
