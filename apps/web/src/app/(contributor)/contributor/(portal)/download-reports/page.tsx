import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata = {
  title: "Download Reports",
}

export default function ContributorDownloadReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Download reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">Contributor reporting shell.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
            Download report data is not implemented yet.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
