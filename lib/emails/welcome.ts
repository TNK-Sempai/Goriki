export function welcomeHtml({ customerName }: { customerName: string }): string {
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
      <h2 style="color:#EEE4CC;font-family:Georgia,serif;font-size:20px;margin:0 0 8px;">Bienvenue, ${customerName} 力</h2>
      <p style="color:#7A6E5C;font-size:14px;margin:0 0 20px;line-height:1.6;">
        Votre compte Goriki est créé. Explorez notre catalogue de singles Pokémon et One Piece TCG,
        tous vérifiés et expédiés depuis Bruxelles.
      </p>

      <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;">
        <p style="color:#7A6E5C;font-size:13px;margin:0 0 4px;">✓ Photos réelles pour toutes les cartes ≥ 1€</p>
        <p style="color:#7A6E5C;font-size:13px;margin:0 0 4px;">✓ Condition garantie — Mint/Near Mint</p>
        <p style="color:#7A6E5C;font-size:13px;margin:0;">✓ Expédition soignée — toute l&apos;Europe</p>
      </div>
    </div>

    <div style="text-align:center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/catalogue"
         style="display:inline-block;background:#D4900C;color:#0C0A07;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;">
        Voir le catalogue
      </a>
    </div>

    <p style="color:#7A6E5C;font-size:12px;text-align:center;margin-top:32px;">
      Goriki · Tanuki Corporation · Bruxelles, Belgique
    </p>
  </div>
</body>
</html>`
}
