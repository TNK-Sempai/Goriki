import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import SetDetail from '@/components/catalogue/SetDetail'

interface Props {
  params: Promise<{ set: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function OnePieceSetPage({ params, searchParams }: Props) {
  const { set } = await params
  const sp = await searchParams

  return (
    <>
      <SiteHeader />
      <SetDetail universe="onepiece" setId={set} searchParams={sp} />
      <SiteFooter />
    </>
  )
}
