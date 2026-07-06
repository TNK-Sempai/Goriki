import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY manquant')
}

export const resend = new Resend(process.env.RESEND_API_KEY)

export const FROM_EMAIL = 'Goriki <noreply@goriki.be>'
export const REPLY_TO = 'contact@goriki.be'
