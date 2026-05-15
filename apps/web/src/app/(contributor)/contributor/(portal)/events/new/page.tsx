import { redirect } from "next/navigation"

export const metadata = {
  title: "Create Event",
}

export default function ContributorNewEventPage() {
  redirect("/contributor/uploads/new")
}
