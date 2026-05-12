import { Lock, Sparkles, ShieldCheck, Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import type { EntitlementState } from "@/features/session/mock-session-provider"

interface EntitlementBannerProps {
  state: EntitlementState
  className?: string
}

const CONTENT: Record<
  EntitlementState,
  { title: string; description: string; tone: string; icon: typeof Lock }
> = {
  "not-subscribed": {
    title: "Not subscribed",
    description: "You can browse previews, but original high-resolution files are locked.",
    tone: "border-amber-300/40 bg-amber-50 text-amber-900",
    icon: Lock,
  },
  subscribed: {
    title: "Subscription active",
    description: "Your plan allows downloadable originals where licensing permits.",
    tone: "border-emerald-300/40 bg-emerald-50 text-emerald-900",
    icon: ShieldCheck,
  },
  "upgrade-plan": {
    title: "Upgrade recommended",
    description: "Unlock higher monthly download limits and commercial usage coverage.",
    tone: "border-blue-300/40 bg-blue-50 text-blue-900",
    icon: Sparkles,
  },
  "preview-only": {
    title: "Preview-only mode",
    description: "Protected previews are available. Originals remain gated until upgrade.",
    tone: "border-violet-300/40 bg-violet-50 text-violet-900",
    icon: Eye,
  },
}

export function EntitlementBanner({ state, className }: EntitlementBannerProps) {
  const item = CONTENT[state]
  const Icon = item.icon

  return (
    <div className={cn("rounded-lg border p-4", item.tone, className)}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="text-sm font-semibold">{item.title}</p>
          <p className="mt-1 text-sm/relaxed opacity-90">{item.description}</p>
        </div>
      </div>
    </div>
  )
}
