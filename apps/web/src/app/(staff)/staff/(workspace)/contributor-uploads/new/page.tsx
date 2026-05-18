import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { StaffUploadFlow } from "@/components/staff/staff-upload-flow"
import { assertStaffRouteAccess, requireStaff } from "@/lib/staff-session"

export const metadata = {
  title: "New contributor upload — Staff",
}

export const dynamic = "force-dynamic"

export default async function StaffNewContributorUploadPage() {
  const staff = await requireStaff()
  await assertStaffRouteAccess(staff.role)

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/staff/contributor-uploads"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to contributor uploads
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">New upload batch</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create an event, upload JPEGs on behalf of a photographer, then submit for review — same flow as the contributor portal.
        </p>
      </div>

      <StaffUploadFlow />
    </div>
  )
}
