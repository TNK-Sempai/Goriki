import type { SupabaseClient } from '@supabase/supabase-js'
import { resend, FROM_EMAIL } from '@/lib/resend'
import { orderConfirmedHtml } from '@/lib/emails/order-confirmed'

export interface StockFailure {
  item_id: string
  label: string
  reason: string
  requested?: number
}

export interface FinalizeOrderInput {
  orderId: string
  paymentId: string | null
  sessionId: string | null
  total: number
  shippingCost: number
  shippingAddress: Record<string, unknown> | null
  storeCreditUsed: number
}

export interface FinalizeOrderResult {
  ok: boolean
  alreadyFinalized: boolean
  stockFailures: StockFailure[]
  error?: string
}

/**
 * Chemin UNIQUE de passage d'une commande `pending` à `paid`.
 *
 * Appelé par le webhook Stripe (`checkout.session.completed`) ET par le bypass 0 €
 * du checkout — aucune logique de création dupliquée entre les deux (addendum §F4).
 *
 * Tout ce qui doit être atomique (verrou de la commande, décrément du stock, déduction
 * du crédit boutique, écriture de la commande) vit dans la RPC `finalize_paid_order` :
 * une seule transaction Postgres. Il ne reste ici que l'email, non transactionnel par nature.
 *
 * @param supabase client SERVICE-ROLE obligatoire (l'EXECUTE de la RPC n'est accordé qu'à lui)
 */
export async function finalizeOrder(
  supabase: SupabaseClient,
  input: FinalizeOrderInput
): Promise<FinalizeOrderResult> {
  const { data, error } = await supabase.rpc('finalize_paid_order', {
    p_order_id: input.orderId,
    p_payment_id: input.paymentId,
    p_session_id: input.sessionId,
    p_total: input.total,
    p_shipping_cost: input.shippingCost,
    p_shipping_address: input.shippingAddress,
    p_store_credit_used: input.storeCreditUsed,
  })

  if (error) {
    console.error('[finalizeOrder] RPC finalize_paid_order:', error.message)
    return { ok: false, alreadyFinalized: false, stockFailures: [], error: error.message }
  }

  const result = data as {
    ok: boolean
    already_finalized?: boolean
    stock_failures?: StockFailure[]
    error?: string
  }

  if (!result.ok) {
    console.error('[finalizeOrder] refusée:', result.error)
    return { ok: false, alreadyFinalized: false, stockFailures: [], error: result.error }
  }

  // Rejeu Stripe ou double appel : la commande était déjà finalisée, on ne renvoie pas d'email.
  if (result.already_finalized) {
    return { ok: true, alreadyFinalized: true, stockFailures: [] }
  }

  const stockFailures = result.stock_failures ?? []
  if (stockFailures.length > 0) {
    console.error(
      `[finalizeOrder] commande ${input.orderId} marquée needs_review — décrément incomplet :`,
      JSON.stringify(stockFailures)
    )
  }

  await sendConfirmationEmail(supabase, input)

  return { ok: true, alreadyFinalized: false, stockFailures }
}

/**
 * Email de confirmation — jamais bloquant : une commande payée reste payée
 * même si Resend est indisponible (ou si la clé API est un placeholder).
 */
async function sendConfirmationEmail(supabase: SupabaseClient, input: FinalizeOrderInput) {
  try {
    const { data: order } = await supabase
      .from('orders')
      .select('user_id, order_items(quantity, price_at_purchase, item_snapshot)')
      .eq('id', input.orderId)
      .single()

    if (!order?.user_id) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', order.user_id)
      .single()

    if (!profile?.email) return

    const items = (order.order_items ?? []) as {
      quantity: number
      price_at_purchase: number
      item_snapshot: { name?: string } | null
    }[]

    await resend.emails.send({
      from: FROM_EMAIL,
      to: profile.email,
      subject: 'Commande confirmée — Goriki',
      html: orderConfirmedHtml({
        orderNumber: input.orderId,
        customerName: profile.full_name ?? profile.email,
        items: items.map(i => ({
          name: i.item_snapshot?.name ?? 'Article',
          quantity: i.quantity,
          price: i.price_at_purchase,
        })),
        total: input.total,
        shippingAddress: (input.shippingAddress as Record<string, string> | null) ?? null,
      }),
    })
  } catch (emailError) {
    console.error('[finalizeOrder] envoi email de confirmation échoué:', emailError)
  }
}
