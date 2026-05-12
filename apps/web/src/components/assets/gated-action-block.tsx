import { Download, Lock, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AssetAccessLevel } from "@/features/assets/access"

interface GatedActionBlockProps {
  accessLevel: AssetAccessLevel
}

export function GatedActionBlock({ accessLevel }: GatedActionBlockProps) {
  const isGated = accessLevel === "free-preview"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Download options</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isGated ? (
          <>
            <Badge variant="warning" className="w-fit">
              <Lock className="h-3 w-3" />
              Free preview only
            </Badge>
            <p className="text-sm text-muted-foreground">
              Original files are locked for non-authenticated and free users. Upgrade
              to unlock licensed high-resolution downloads.
            </p>
            <button
              type="button"
              disabled
              className="inline-flex h-10 w-full cursor-not-allowed items-center justify-center gap-2 rounded-md border border-border bg-muted px-4 text-sm font-semibold text-muted-foreground"
            >
              <Download className="h-4 w-4" />
              Download original (locked)
            </button>
            <Button variant="accent" size="default" className="w-full">
              <Sparkles className="h-4 w-4" />
              Upgrade to unlock original
            </Button>
          </>
        ) : (
          <>
            <Badge variant="success" className="w-fit">Licensed access</Badge>
            <p className="text-sm text-muted-foreground">
              Your plan includes this asset. Download actions are placeholder-only in
              this fixture environment.
            </p>
            <button
              type="button"
              disabled
              className="inline-flex h-10 w-full cursor-not-allowed items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground opacity-70"
            >
              <Download className="h-4 w-4" />
              Download original (coming soon)
            </button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
