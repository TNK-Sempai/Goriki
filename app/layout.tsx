import type { Metadata } from 'next'
import { Archivo_Black, Inter, JetBrains_Mono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import LenisProvider from '@/components/providers/LenisProvider'
import { UniverseProvider } from '@/components/universe/UniverseProvider'
import AtmosphereLayer from '@/components/atmosphere/AtmosphereLayer'
import FondNeutreAuto from '@/components/fond/FondNeutreAuto'
import { SITE_NAME, SITE_DESCRIPTION } from '@/lib/constants'
import '@/styles/globals.css'
import '@/styles/components.css'

// Typographie FINALE (CLAUDE.md — identité 2026-08-21).
// TT Hoves de la planche de référence est une police payante : Archivo Black
// est son substitut libre pour les titres. Playfair Display, DM Sans et
// Instrument Serif sont abandonnées — plus jamais chargées.
const archivo = Archivo_Black({
  subsets: ['latin'],
  weight: '400', // Archivo Black n'a QUE ce poids : il est déjà « black ».
  variable: '--font-archivo',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

// Donnée technique : réf, prix, coordonnées, eyebrows.
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://goriki.be'),
  openGraph: {
    type: 'website',
    locale: 'fr_BE',
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: process.env.NEXT_PUBLIC_APP_URL,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${archivo.variable} ${inter.variable} ${jetbrains.variable}`}
    >
      <body>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="light"
          enableSystem={false}
          themes={['dark', 'light']}
        >
          <LenisProvider>
            <UniverseProvider>
              {/* Les deux fonds globaux, dans l'ordre de profondeur : la nappe
                  illustrée des pages neutres, puis le canvas d'atmosphère qui
                  ne reste que sur l'accueil, au-dessus d'elle. Chacun lit la
                  même fonction de `lib/fond.ts` et ne peut donc pas empiéter
                  sur l'autre. */}
              <FondNeutreAuto />
              <AtmosphereLayer />
              {children}
            </UniverseProvider>
          </LenisProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
