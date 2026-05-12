import { redirect } from "next/navigation"

export const metadata = {
  title: "Contributor Workspace",
}

export default function ContributorIndexPage() {
  redirect("/contributor/dashboard")
}
