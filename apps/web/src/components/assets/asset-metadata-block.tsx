import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AssetListItem } from "@/types"

interface AssetMetadataBlockProps {
  asset: AssetListItem
}

function getOrientationLabel(asset: AssetListItem): string {
  if (!asset.orientation) return "Unknown"
  if (asset.orientation === "landscape") return "Landscape"
  if (asset.orientation === "portrait") return "Portrait"
  return "Square"
}

export function AssetMetadataBlock({ asset }: AssetMetadataBlockProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Asset metadata</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md bg-muted p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Asset ID</p>
            <p className="mt-1 font-medium">{asset.id}</p>
          </div>
          <div className="rounded-md bg-muted p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Category</p>
            <p className="mt-1 font-medium capitalize">{asset.category ?? "—"}</p>
          </div>
          <div className="rounded-md bg-muted p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Dimensions</p>
            <p className="mt-1 font-medium">
              {asset.width && asset.height
                ? `${asset.width.toLocaleString()} × ${asset.height.toLocaleString()}`
                : "Unknown"}
            </p>
          </div>
          <div className="rounded-md bg-muted p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Orientation</p>
            <p className="mt-1 font-medium">{getOrientationLabel(asset)}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Keywords</p>
          <div className="flex flex-wrap gap-2">
            {asset.keywords.map((keyword, keywordIndex) => (
              <Badge key={`${keyword}-${keywordIndex}`} variant="secondary" className="capitalize">
                {keyword}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
