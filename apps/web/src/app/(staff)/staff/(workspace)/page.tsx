import { redirect } from "next/navigation"

export default function AdminRootRedirectPage() {
  redirect("/staff/dashboard")
}
