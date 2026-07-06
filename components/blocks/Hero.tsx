import Link from 'next/link'

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Fond ambre dégradé subtil */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(212,144,12,0.12) 0%, transparent 70%)',
        }}
      />

      <div className="container-goriki relative py-24 md:py-36 text-center">
        {/* Badge */}
        <span className="badge badge-amber mb-6 inline-flex">
          Pokémon & One Piece TCG · FR
        </span>

        {/* Titre */}
        <h1 className="font-display text-cream mb-6">
          La force brute<br />
          <span className="text-amber">du collectionneur sérieux.</span>
        </h1>

        {/* Sous-titre */}
        <p className="text-muted text-lg max-w-xl mx-auto mb-10 leading-relaxed">
          Singles, scellés et accessoires — sélectionnés, conditionnés et
          livrés depuis Bruxelles.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/catalogue/pokemon" className="btn btn-primary btn-lg">
            Catalogue Pokémon
          </Link>
          <Link href="/catalogue/onepiece" className="btn btn-outline btn-lg">
            One Piece TCG
          </Link>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-center gap-10 mt-16">
          {[
            { label: 'Sets disponibles', value: '10+' },
            { label: 'Singles en stock', value: '1 000+' },
            { label: 'Expédition', value: 'BE · EU' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-display text-2xl text-amber">{stat.value}</p>
              <p className="text-muted text-xs mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
