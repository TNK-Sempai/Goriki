import Navbar from '@/components/blocks/Navbar'
import Footer from '@/components/blocks/Footer'
import Link from 'next/link'

export default function RachatPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-base flex items-center justify-center">
        <div className="text-center max-w-sm">
          <span className="badge badge-muted mb-4 inline-flex">Bientôt disponible</span>
          <h1 className="font-display text-2xl text-cream mb-3">Rachat de cartes</h1>
          <p className="text-muted text-sm mb-6">
            Cette fonctionnalité sera disponible prochainement.
            Revenez bientôt !
          </p>
          <Link href="/compte" className="btn btn-outline btn-sm">← Retour au compte</Link>
        </div>
      </main>
      <Footer />
    </>
  )
}
