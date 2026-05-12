import { ShieldCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata = {
  title: "Admin Audit — Fotocorp",
}

export default function AdminAuditPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Audit</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Asset editorial and publish-state changes are recorded in API audit logs.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit trail foundation</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <div className="inline-flex items-center gap-2 rounded border border-border bg-background px-2.5 py-1.5 text-xs">
            <ShieldCheck className="h-3.5 w-3.5" />
            Read endpoint UI is pending. Logs are being written server-side.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
