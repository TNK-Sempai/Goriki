import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
