import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatPrice } from '@/lib/utils'

export const metadata = { title: 'Mes commandes' }

/**
 * Commandes — case 9 de la planche de référence.
 *
 * Composition de la planche : grand titre « MES COMMANDES », puis un TABLEAU
 * de lignes régulières — référence · date · nombre d'articles · total · état.
 * Aucune carte, aucun panneau : c'est une liste dense qu'on lit en colonne.
 *
 * Cette page n'avait JAMAIS été portée : elle rendait encore le vocabulaire
 * sombre d'origine (`container-goriki`, `card`, `badge`, `text-cream`) et
 * ouvrait un second `<main>` à l'intérieur de celui du layout de compte.
 *
 * Référence affichée : la planche montre « #GKI-1267 », un compteur séquentiel.
 * `orders` n'a pas de numéro de commande — seulement un UUID. On en dérive une
 * référence courte STABLE plutôt que d'inventer une numérotation qui n'existe
 * nulle part en base.
 */

const ETATS: Record<string, { label: string; tone: 'done' | 'transit' | 'wait' }> = {
  pending: { label: 'En attente', tone: 'wait' },
  paid: { label: 'Payée', tone: 'transit' },
  preparing: { label: 'Préparation', tone: 'transit' },
  shipped: { label: 'Expédiée', tone: 'transit' },
  delivered: { label: 'Livrée', tone: 'done' },
  cancelled: { label: 'Annulée', tone: 'wait' },
  refunded: { label: 'Remboursée', tone: 'wait' },
}

const reference = (id: string) => `#GKI-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`

export default async function CommandesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, total, created_at, order_items(id)')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  const rows = (orders ?? []).map(o => ({
    id: o.id,
    status: o.status as string,
    total: o.total as number,
    date: new Date(o.created_at as string),
    articles: Array.isArray(o.order_items) ? o.order_items.length : 0,
  }))

  return (
    <>
      <h1 className="display-section m-0 mb-7 lg:mb-9">Mes commandes</h1>

      {rows.length === 0 ? (
        <div className="glass rounded-block px-8 py-16 text-center">
          <p className="m-0 mb-5 text-[14px] text-ink-70">Aucune commande pour l&apos;instant.</p>
          <Link
            href="/catalogue"
            className="btn-ochre inline-flex px-6 py-3 font-mono text-[11px] uppercase tracking-[0.14em]"
          >
            Voir le catalogue
          </Link>
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-panel-lg">
          {/* En-tête de tableau — masqué en mobile, où chaque ligne s'empile. */}
          <div className="hidden items-center gap-4 border-b border-[rgba(26,22,17,0.12)] px-5 py-3 sm:grid sm:grid-cols-[130px_1fr_110px_110px_110px]">
            <span className="data text-[9px]">Référence</span>
            <span className="data text-[9px]">Date</span>
            <span className="data text-[9px]">Articles</span>
            <span className="data text-[9px] sm:text-right">Total</span>
            <span className="data text-[9px] sm:text-right">État</span>
          </div>

          {rows.map(o => {
            const e = ETATS[o.status] ?? { label: o.status, tone: 'wait' as const }
            return (
              <Link
                key={o.id}
                href={`/compte/commandes/${o.id}`}
                className="flex flex-col gap-2 border-b border-[rgba(26,22,17,0.09)] px-5 py-3.5 transition-colors last:border-0 hover:bg-[rgba(255,255,255,0.5)] sm:grid sm:grid-cols-[130px_1fr_110px_110px_110px] sm:items-center sm:gap-4"
              >
                <span className="font-mono text-[12px] font-medium tracking-[0.04em] text-ink">
                  {reference(o.id)}
                </span>
                <span className="text-[13px] text-ink-70">
                  {o.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                <span className="text-[13px] text-ink-70">
                  {o.articles} article{o.articles > 1 ? 's' : ''}
                </span>
                <span className="text-[14px] font-semibold text-ink sm:text-right">
                  {formatPrice(o.total)}
                </span>
                <span className="sm:text-right">
                  <span className="status" data-tone={e.tone}>{e.label}</span>
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
