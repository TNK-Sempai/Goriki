import type { Metadata } from 'next'
import DocumentLegal from '@/components/legal/DocumentLegal'
import { lireDocumentLegal } from '@/lib/legal.server'
import { pageLegale } from '@/lib/legal'

const SLUG = 'mentions-legales'
const page = pageLegale(SLUG)!

export const metadata: Metadata = {
  title: page.titre,
  description: page.description,
}

export default async function Page() {
  return <DocumentLegal markdown={await lireDocumentLegal(SLUG)} />
}
