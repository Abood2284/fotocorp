import { redirect } from "next/navigation"

interface LegacyAdminCatalogAssetRouteProps {
  params: Promise<{ id: string }>
}

export default async function LegacyAdminCatalogAssetRoute({ params }: LegacyAdminCatalogAssetRouteProps) {
  const { id } = await params
  redirect(`/staff/assets/${id}`)
}
