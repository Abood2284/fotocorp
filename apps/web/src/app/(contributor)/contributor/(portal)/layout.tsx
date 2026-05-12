import { ContributorShell } from "@/components/contributor/contributor-shell"
import { requireContributorPortalSession } from "@/lib/contributor-session"

export default async function ContributorPortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requireContributorPortalSession()

  return <ContributorShell session={session}>{children}</ContributorShell>
}
