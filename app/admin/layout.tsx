import { redirect } from 'next/navigation'
import { Bebas_Neue, DM_Mono, DM_Serif_Display, Instrument_Sans } from 'next/font/google'
import { createClient } from '@/lib/supabase/server'
import Rail, { type Compteurs } from '@/components/admin/Rail'
import '@/styles/admin.css'

/**
 * Coque du back-office — refonte intégrale d'après
 * `docs/design-reference/Goriki Admin.dc (2).html`.
 *
 * Les quatre polices de la maquette sont chargées ICI et non dans le layout
 * racine : le parcours public n'a aucune raison de les télécharger. Elles ne
 * remplacent pas Archivo Black / Inter / JetBrains Mono, qui restent la
 * typographie du site — l'admin est un espace à part, comme l'attestaient déjà
 * ses propres paliers de radius.
 *
 * Les compteurs du rail sont lus en base à chaque rendu. Les figer aux valeurs
 * de la maquette aurait produit un outil qui ment dès le premier import.
 *
 * ⚠️ DÉPENDANCE INVISIBLE : la structure `height:100dvh; overflow:hidden` de
 * `.gk` (voir `styles/admin.css`) ne défile que si Lenis reste exclu de
 * `/admin` — le lissage capte la molette sur `window` et aucun conteneur
 * interne ne la reçoit plus. Le préfixe est tenu par `PREFIXE_ADMIN`
 * (`lib/constants.ts`), dont le commentaire porte la mesure. Toute route
 * d'administration doit rester sous ce préfixe.
 */

const bebas = Bebas_Neue({ subsets: ['latin'], weight: '400', variable: '--font-bebas', display: 'swap' })
const dmMono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-dmmono', display: 'swap' })
const dmSerif = DM_Serif_Display({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-dmserif', display: 'swap' })
const instrument = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument', display: 'swap' })

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?redirect=/admin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/')

  const [sets, variantes, exemplaires, commandes, scelles, verifications] = await Promise.all([
    supabase.from('pokemon_sets').select('id', { count: 'exact', head: true }),
    supabase.from('pokemon_card_variants').select('id', { count: 'exact', head: true }),
    supabase.from('pokemon_listings').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('sealed_products').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('identity_status', 'pending'),
  ])

  const compteurs: Compteurs = {
    sets: sets.count ?? 0,
    variantes: variantes.count ?? 0,
    exemplaires: exemplaires.count ?? 0,
    commandes: commandes.count ?? 0,
    scelles: scelles.count ?? 0,
    verifications: verifications.count ?? 0,
  }

  return (
    <div
      data-theme="dark"
      className={`gk ${bebas.variable} ${dmMono.variable} ${dmSerif.variable} ${instrument.variable}`}
    >
      {/* Décor : grain et halos. Hors du flux, jamais cliquables. */}
      <div className="gk-grain" aria-hidden />
      <div className="gk-halo gk-halo-1" aria-hidden />
      <div className="gk-halo gk-halo-2" aria-hidden />

      <Rail compteurs={compteurs} email={profile.email ?? user.email ?? ''} />

      <main className="gk-main">{children}</main>
    </div>
  )
}
