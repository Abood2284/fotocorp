import { ArrowRight, Sparkles } from "lucide-react"
import type { EntitlementState } from "@/features/session/mock-session-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface EntitlementCtaBlockProps {
  state: EntitlementState
}

export function EntitlementCtaBlock({ state }: EntitlementCtaBlockProps) {
  if (state === "subscribed") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan status</CardTitle>
          <CardDescription>You are currently on an active paid plan.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" className="w-full">
            Manage plan
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (state === "upgrade-plan") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Need more downloads?</CardTitle>
          <CardDescription>Upgrade to Pro for original files and higher limits.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="accent" className="w-full">
            <Sparkles className="h-4 w-4" />
            Upgrade plan
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Start with a plan</CardTitle>
        <CardDescription>Continue browsing previews or subscribe to download originals.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button variant="accent" className="w-full">
          Choose plan
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button variant="secondary" className="w-full">
          Continue preview-only
        </Button>
      </CardContent>
    </Card>
  )
}
