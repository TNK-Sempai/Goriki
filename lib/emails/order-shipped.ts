export function orderShippedHtml({
  orderNumber,
  customerName,
  trackingNumber,
}: {
  orderNumber: string
  customerName: string
  trackingNumber: string
}): string {
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
      <h2 style="color:#EEE4CC;font-family:Georgia,serif;font-size:20px;margin:0 0 8px;">Votre commande est expédiée 📦</h2>
      <p style="color:#7A6E5C;font-size:14px;margin:0 0 24px;">Bonjour ${customerName}, votre colis est en route.</p>

      <p style="color:#7A6E5C;font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Numéro de suivi</p>
      <p style="color:#D4900C;font-family:monospace;font-size:16px;margin:0 0 24px;letter-spacing:1px;">${trackingNumber}</p>

      <p style="color:#7A6E5C;font-size:13px;margin:0;">
        Utilisez ce numéro sur le site de votre transporteur pour suivre votre colis.
      </p>
    </div>

    <div style="text-align:center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/compte/commandes/${orderNumber}"
         style="display:inline-block;background:#D4900C;color:#0C0A07;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;">
        Voir ma commande
      </a>
    </div>

    <p style="color:#7A6E5C;font-size:12px;text-align:center;margin-top:32px;">
      Goriki · Tanuki Corporation · Bruxelles, Belgique
    </p>
  </div>
</body>
</html>`
}
