export function orderConfirmedHtml({
  orderNumber,
  customerName,
  items,
  total,
  shippingAddress,
}: {
  orderNumber: string
  customerName: string
  items: { name: string; quantity: number; price: number }[]
  total: number
  shippingAddress?: Record<string, string> | null
}): string {
  const itemsHtml = items.map(i => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #1C180E;color:#EEE4CC;font-size:14px;">${i.name}</td>
      <td style="padding:8px 0;border-bottom:1px solid #1C180E;color:#7A6E5C;font-size:14px;text-align:center;">×${i.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #1C180E;color:#D4900C;font-size:14px;text-align:right;">${(i.price * i.quantity).toFixed(2)} €</td>
    </tr>
  `).join('')

  const addressHtml = shippingAddress ? `
    <p style="color:#7A6E5C;font-size:13px;margin:0;">
      ${shippingAddress.line1 ?? ''}<br/>
      ${shippingAddress.city ?? ''} ${shippingAddress.postal_code ?? ''}<br/>
      ${shippingAddress.country ?? ''}
    </p>
  ` : ''

  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0C0A07;font-family:'DM Sans',system-ui,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">

    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="font-family:Georgia,serif;color:#D4900C;font-size:28px;margin:0;letter-spacing:2px;">GORIKI</h1>
    </div>

    <div style="background:#141108;border:1px solid rgba(212,144,12,0.18);border-radius:8px;padding:32px;margin-bottom:24px;">
      <h2 style="color:#EEE4CC;font-family:Georgia,serif;font-size:20px;margin:0 0 8px;">Commande confirmée ✓</h2>
      <p style="color:#7A6E5C;font-size:14px;margin:0 0 24px;">Bonjour ${customerName}, merci pour votre commande.</p>

      <p style="color:#7A6E5C;font-size:12px;margin:0 0 16px;text-transform:uppercase;letter-spacing:1px;">Référence</p>
      <p style="color:#EEE4CC;font-family:monospace;font-size:13px;margin:0 0 24px;">${orderNumber.slice(0, 8).toUpperCase()}</p>

      <p style="color:#7A6E5C;font-size:12px;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px;">Articles</p>
      <table style="width:100%;border-collapse:collapse;">
        ${itemsHtml}
      </table>

      <div style="border-top:1px solid rgba(212,144,12,0.18);margin-top:16px;padding-top:16px;display:flex;justify-content:space-between;">
        <span style="color:#7A6E5C;font-size:14px;">Total</span>
        <span style="color:#D4900C;font-size:18px;font-family:Georgia,serif;">${total.toFixed(2)} €</span>
      </div>
    </div>

    ${shippingAddress ? `
    <div style="background:#141108;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:24px;margin-bottom:24px;">
      <p style="color:#7A6E5C;font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Livraison</p>
      ${addressHtml}
    </div>
    ` : ''}

    <div style="text-align:center;margin-top:32px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/compte/commandes/${orderNumber}"
         style="display:inline-block;background:#D4900C;color:#0C0A07;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;">
        Suivre ma commande
      </a>
    </div>

    <p style="color:#7A6E5C;font-size:12px;text-align:center;margin-top:32px;">
      Goriki · Tanuki Corporation · Bruxelles, Belgique
    </p>
  </div>
</body>
</html>`
}
