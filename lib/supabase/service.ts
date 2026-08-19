import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Client Supabase en service-role — bypasse RLS.
 *
 * À n'utiliser QUE dans du code serveur (route handlers, webhooks). Il est requis pour :
 *  - insérer des `order_items` (aucune policy INSERT propriétaire, seulement admin) ;
 *  - appeler les RPC de stock, dont l'EXECUTE n'est accordé qu'à `service_role`.
 *
 * L'identité de l'utilisateur doit TOUJOURS être vérifiée en amont avec le client anon
 * (`auth.getUser()`) : ce client-ci n'a aucune notion de session.
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant')
  }

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
