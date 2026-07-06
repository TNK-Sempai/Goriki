import Link from 'next/link'

interface SetGridProps {
  sets: { id: string; code: string; name_fr: string; image_url: string | null; card_count: number | null }[]
  basePath: string
}

export default function SetGrid({ sets, basePath }: SetGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {sets.map((set) => (
        <Link
          key={set.id}
          href={`${basePath}/${set.id}`}
          className="card hover:border-goriki transition-all group"
        >
          {set.image_url && (
            <img
              src={set.image_url}
              alt={set.name_fr}
              className="h-12 object-contain mb-3 opacity-80 group-hover:opacity-100 transition-opacity"
              loading="lazy"
            />
          )}
          <p className="text-cream text-sm font-medium">{set.name_fr}</p>
          <p className="text-muted text-xs mt-1">{set.code} · {set.card_count ?? '?'} cartes</p>
        </Link>
      ))}
      {sets.length === 0 && (
        <p className="text-muted text-sm col-span-full text-center py-10">
          Aucun set disponible — importez des cartes depuis l&apos;admin.
        </p>
      )}
    </div>
  )
}
