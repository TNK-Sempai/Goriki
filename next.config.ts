import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Durée de vie des segments préchargés dans le cache client.
   *
   * Mesuré avant ce réglage : l'accueil déclenchait à lui seul 26 requêtes RSC
   * de préchargement… et une navigation vers le catalogue mettait quand même
   * 788 ms. Depuis Next 15, `staleTimes.dynamic` vaut **0 par défaut** — tout
   * ce qui est préchargé sur une route dynamique est jeté à l'arrivée. Le site
   * payait donc le préchargement en requêtes serveur sans jamais en toucher le
   * bénéfice.
   *
   * `static` n'est pas touché : sa valeur par défaut (5 min) s'applique aux
   * frontières `loading.tsx`, et la raccourcir irait contre le but.
   *
   * Contrepartie assumée, à connaître : un retour arrière dans les 30 s
   * réaffiche le stock et le prix tels qu'ils étaient au premier passage. Sur
   * un catalogue où les quantités bougent à la vente, c'est le compromis
   * habituel ; la fiche est de toute façon revalidée au-delà.
   */
  experimental: {
    staleTimes: { dynamic: 30 },
  },

  images: {
    // Hôtes d'images du catalogue. `assets.tcgdex.net` sert les 25 225 visuels
    // de cartes ; `res.cloudinary.com` les photos réelles uploadées en admin.
    remotePatterns: [
      { protocol: 'https', hostname: 'assets.tcgdex.net' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
};

export default nextConfig;
