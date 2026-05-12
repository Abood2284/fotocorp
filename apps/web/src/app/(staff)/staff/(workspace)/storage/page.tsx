import { STORAGE_SUMMARY, STORAGE_OBJECTS } from "@/lib/fixtures/admin"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export const metadata = {
  title: "Admin Storage — Fotocorp",
}

export default function AdminStoragePage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Storage status</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Bucket health and object inspection shell for operations workflows.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {STORAGE_SUMMARY.map((item) => (
          <Card key={item.environment}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base capitalize">
                {item.environment}
                <Badge variant={item.healthy ? "success" : "destructive"}>
                  {item.healthy ? "Healthy" : "Attention"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Bucket:</span> {item.bucket}</p>
              <p><span className="text-muted-foreground">Objects:</span> {item.totalObjects.toLocaleString()}</p>
              <p><span className="text-muted-foreground">Size:</span> {item.totalSizeGb.toLocaleString()} GB</p>
              <p><span className="text-muted-foreground">Last sync:</span> {item.lastSyncAt}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Object inspection shell</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Object key</th>
                  <th className="px-3 py-2 text-left font-medium">Content type</th>
                  <th className="px-3 py-2 text-left font-medium">Size</th>
                  <th className="px-3 py-2 text-left font-medium">ETag</th>
                  <th className="px-3 py-2 text-left font-medium">Last modified</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {STORAGE_OBJECTS.map((object) => (
                  <tr key={object.key} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{object.key}</td>
                    <td className="px-3 py-2 text-muted-foreground">{object.contentType}</td>
                    <td className="px-3 py-2 text-muted-foreground">{object.sizeMb.toFixed(2)} MB</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{object.etag}</td>
                    <td className="px-3 py-2 text-muted-foreground">{object.lastModifiedAt}</td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={
                          object.status === "available"
                            ? "success"
                            : object.status === "stale"
                              ? "warning"
                              : "secondary"
                        }
                      >
                        {object.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
