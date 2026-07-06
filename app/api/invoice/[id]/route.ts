import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// Styles PDF
const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    padding: 48,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  brand: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    color: '#C8860A',
    letterSpacing: 3,
  },
  brandSub: {
    fontSize: 10,
    color: '#7A6E5C',
    marginTop: 4,
  },
  invoiceTitle: {
    fontSize: 10,
    color: '#7A6E5C',
    textAlign: 'right',
  },
  invoiceNumber: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#0C0A07',
    textAlign: 'right',
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 9,
    color: '#7A6E5C',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 11,
    color: '#2C1A0E',
    lineHeight: 1.5,
  },
  table: {
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomColor: '#D4900C',
    borderBottomWidth: 1,
    paddingBottom: 6,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomColor: '#EDE0C4',
    borderBottomWidth: 1,
  },
  colName: { flex: 3, fontSize: 11, color: '#2C1A0E' },
  colQty:  { flex: 1, fontSize: 11, color: '#2C1A0E', textAlign: 'center' },
  colPrice:{ flex: 1, fontSize: 11, color: '#2C1A0E', textAlign: 'right' },
  colHeaderText: { fontSize: 9, color: '#7A6E5C', textTransform: 'uppercase', letterSpacing: 0.5 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopColor: '#C8860A',
    borderTopWidth: 1,
  },
  totalLabel: { fontSize: 12, color: '#7A6E5C', marginRight: 24 },
  totalAmount: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#C8860A' },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 48,
    right: 48,
    borderTopColor: '#EDE0C4',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  footerText: { fontSize: 9, color: '#7A6E5C', textAlign: 'center' },
})

// Composant PDF
function InvoicePDF({ order, items, profile }: {
  order: { id: string; total: number; created_at: string; shipping_address: Record<string, string> | null }
  items: { id: string; item_snapshot: { name?: string } | null; item_type: string; quantity: number; price_at_purchase: number }[]
  profile: { email: string; full_name: string | null }
}) {
  const date = new Date(order.created_at).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  return createElement(Document, {},
    createElement(Page, { size: 'A4', style: styles.page },

      // Header
      createElement(View, { style: styles.header },
        createElement(View, {},
          createElement(Text, { style: styles.brand }, 'GORIKI'),
          createElement(Text, { style: styles.brandSub }, 'Tanuki Corporation · Bruxelles, Belgique'),
          createElement(Text, { style: styles.brandSub }, 'contact@goriki.be'),
        ),
        createElement(View, {},
          createElement(Text, { style: styles.invoiceTitle }, 'FACTURE'),
          createElement(Text, { style: styles.invoiceNumber }, `#${order.id.slice(0, 8).toUpperCase()}`),
          createElement(Text, { style: { ...styles.invoiceTitle, marginTop: 4 } }, date),
        ),
      ),

      // Client
      createElement(View, { style: styles.section },
        createElement(Text, { style: styles.sectionTitle }, 'Facturé à'),
        createElement(Text, { style: styles.bodyText }, profile.full_name ?? profile.email),
        createElement(Text, { style: styles.bodyText }, profile.email),
        order.shipping_address ? createElement(View, {},
          createElement(Text, { style: styles.bodyText }, order.shipping_address.line1 ?? ''),
          createElement(Text, { style: styles.bodyText },
            `${order.shipping_address.postal_code ?? ''} ${order.shipping_address.city ?? ''}`),
          createElement(Text, { style: styles.bodyText }, order.shipping_address.country ?? ''),
        ) : null,
      ),

      // Articles
      createElement(View, { style: styles.section },
        createElement(Text, { style: styles.sectionTitle }, 'Articles'),
        createElement(View, { style: styles.table },
          createElement(View, { style: styles.tableHeader },
            createElement(Text, { style: { ...styles.colName, ...styles.colHeaderText } }, 'Désignation'),
            createElement(Text, { style: { ...styles.colQty, ...styles.colHeaderText } }, 'Qté'),
            createElement(Text, { style: { ...styles.colPrice, ...styles.colHeaderText } }, 'Total'),
          ),
          ...items.map(item =>
            createElement(View, { key: item.id, style: styles.tableRow },
              createElement(Text, { style: styles.colName },
                item.item_snapshot?.name ?? item.item_type),
              createElement(Text, { style: styles.colQty }, String(item.quantity)),
              createElement(Text, { style: styles.colPrice },
                `${(item.price_at_purchase * item.quantity).toFixed(2)} €`),
            )
          ),
        ),
        createElement(View, { style: styles.totalRow },
          createElement(Text, { style: styles.totalLabel }, 'Total TTC'),
          createElement(Text, { style: styles.totalAmount }, `${order.total.toFixed(2)} €`),
        ),
      ),

      // Footer
      createElement(View, { style: styles.footer },
        createElement(Text, { style: styles.footerText },
          'Goriki — Tanuki Corporation · TVA non applicable selon l\'article 283 du CGI · Bruxelles, Belgique'
        ),
      ),
    )
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(cs) { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const { data: order } = await supabase
    .from('orders')
    .select('id, total, created_at, shipping_address, user_id, order_items(*)')
    .eq('id', id)
    .single()

  if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })

  // Vérifier que la commande appartient à l'user (ou admin)
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name, role')
    .eq('id', user.id)
    .single()

  if (order.user_id !== user.id && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const invoiceElement = createElement(InvoicePDF, {
    order: {
      id: order.id,
      total: order.total,
      created_at: order.created_at,
      shipping_address: order.shipping_address as Record<string, string> | null,
    },
    items: order.order_items ?? [],
    profile: {
      email: profile?.email ?? user.email ?? '',
      full_name: profile?.full_name ?? null,
    },
  }) as Parameters<typeof renderToBuffer>[0]

  const pdfBuffer = await renderToBuffer(invoiceElement)

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="facture-goriki-${order.id.slice(0, 8)}.pdf"`,
    },
  })
}
