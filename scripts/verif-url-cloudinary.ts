// VÉRIFICATION — garde-fou sur une URL de scan collée (lib/admin/photo-url).
// Pur, sans réseau ni base. `npx tsx scripts/verif-url-cloudinary.ts`
import fs from 'node:fs'
import path from 'node:path'

// Le garde-fou lit `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` au chargement du module :
// il faut donc peupler l'environnement AVANT de l'importer.
for (const ligne of fs.readFileSync(path.resolve(__dirname, '..', '.env.local'), 'utf-8').split('\n')) {
  const l = ligne.trim()
  if (!l || l.startsWith('#') || !l.includes('=')) continue
  const k = l.slice(0, l.indexOf('=')).trim()
  if (!(k in process.env)) process.env[k] = l.slice(l.indexOf('=') + 1).trim()
}

async function main() {
  const { verifierUrlCloudinary } = await import('../lib/admin/photo-url')
  const compte = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!

  const CAS: { attendu: boolean; quoi: string; url: string }[] = [
    // ── Doit passer ────────────────────────────────────────────────────────
    { attendu: true, quoi: 'URL réelle du compte (relevée en base)',
      url: `https://res.cloudinary.com/${compte}/image/upload/v1787529492/Goriki/pokemon/variantes/5afeb143-98b9-4225-a415-e2f5c7ec012c.webp` },
    { attendu: true, quoi: 'avec transformations dans le chemin',
      url: `https://res.cloudinary.com/${compte}/image/upload/w_600,h_840,c_limit,q_auto:good/Goriki/pokemon/front/abc_front.jpg` },
    { attendu: true, quoi: 'sans numéro de version',
      url: `https://res.cloudinary.com/${compte}/image/upload/Goriki/pokemon/back/abc_back.png` },
    { attendu: true, quoi: 'espaces autour (collage depuis le presse-papier)',
      url: `  https://res.cloudinary.com/${compte}/image/upload/v1/x.jpg  ` },

    // ── Doit être refusé ───────────────────────────────────────────────────
    { attendu: false, quoi: 'autre compte Cloudinary',
      url: 'https://res.cloudinary.com/quelquun-dautre/image/upload/v1/x.jpg' },
    { attendu: false, quoi: 'autre domaine',
      url: 'https://i.imgur.com/abc.jpg' },
    { attendu: false, quoi: 'domaine qui imite',
      url: 'https://cloudinary.com.pirate.net/x/image/upload/v1/x.jpg' },
    { attendu: false, quoi: 'http et non https',
      url: `http://res.cloudinary.com/${compte}/image/upload/v1/x.jpg` },
    { attendu: false, quoi: 'pas une URL',
      url: 'Goriki/pokemon/front/abc.jpg' },
    { attendu: false, quoi: 'chaîne vide', url: '   ' },
    { attendu: false, quoi: 'bon domaine mais pas un média',
      url: `https://res.cloudinary.com/${compte}/console/settings` },
  ]

  let ko = 0
  for (const c of CAS) {
    const v = verifierUrlCloudinary(c.url)
    const bon = v.ok === c.attendu
    if (!bon) ko++
    console.log(
      `${bon ? '  ok ' : '  KO '} ${(c.attendu ? 'accepté' : 'refusé ').padEnd(8)} ${c.quoi.padEnd(42)}` +
      `${v.ok ? '' : '→ ' + v.raison}`
    )
  }

  console.log(`\n${CAS.length - ko}/${CAS.length} cas conformes`)
  process.exitCode = ko === 0 ? 0 : 1
}

main()
