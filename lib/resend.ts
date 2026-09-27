import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY manquant')
}

export const resend = new Resend(process.env.RESEND_API_KEY)

export const FROM_EMAIL = 'Goriki <noreply@goriki.be>'
/**
 * Adresse de RÉPONSE.
 *
 * ⚠️ Elle était exportée sans être branchée : un client qui répondait à un
 * email de commande écrivait à `noreply@`, c'est-à-dire à personne. Les trois
 * envois la posent désormais en `replyTo`.
 */
export const REPLY_TO = 'contact@tanuki-corporation.com'
