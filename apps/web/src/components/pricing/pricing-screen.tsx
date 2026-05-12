"use client"

import { ArrowRight, Check, Minus } from "lucide-react"
import { FIXTURE_PLANS } from "@/lib/fixtures/plans"
import { useMockSession } from "@/features/session/mock-session-provider"
import { EntitlementBanner } from "@/components/entitlement/entitlement-banner"
import { EntitlementCtaBlock } from "@/components/entitlement/entitlement-cta-block"
import { Section, SectionHeader } from "@/components/layout/section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { Plan } from "@/types"

function getPlanCtaState({
  plan,
  tier,
}: {
  plan: Plan
  tier: ReturnType<typeof useMockSession>["tier"]
}): { label: string; variant: "accent" | "secondary" | "outline" } {
  if (tier === "paid" && plan.id === "plan-pro")
    return { label: "Current plan", variant: "secondary" }
  if (tier === "free" && plan.id === "plan-free")
    return { label: "Current plan", variant: "secondary" }
  if (plan.id === "plan-enterprise")
    return { label: "Contact sales", variant: "outline" }
  return { label: "Choose plan", variant: "accent" }
}

function PlanCard({ plan, tier }: { plan: Plan; tier: ReturnType<typeof useMockSession>["tier"] }) {
  const cta = getPlanCtaState({ plan, tier })
  const price = plan.priceMonthly === null ? "Custom" : plan.priceMonthly === 0 ? "Free" : `$${plan.priceMonthly}`

  return (
    <Card className={plan.popular ? "border-primary shadow-lg shadow-primary/10" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="fc-heading-3 text-2xl">{plan.name}</CardTitle>
          {plan.popular && <Badge variant="accent">Most popular</Badge>}
        </div>
        <CardDescription className="fc-body-sm">{plan.tagline}</CardDescription>
        <div className="pt-2">
          <p className="fc-display text-3xl">{price}</p>
          <p className="fc-caption text-muted-foreground">
            {plan.priceMonthly === null ? "Tailored enterprise pricing" : "per month"}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button variant={cta.variant} className="fc-label w-full">
          {cta.label}
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Separator />
        <ul className="space-y-2">
          {plan.features.map((feature) => (
            <li key={feature.label} className="fc-body-sm flex items-start gap-2">
              {feature.included ? (
                <Check className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Minus className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className={feature.included ? "text-foreground" : "text-muted-foreground"}>
                {feature.label}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

export function PricingScreen() {
  const { tier, entitlementState } = useMockSession()

  return (
    <>
      <Section className="pb-8">
        <SectionHeader
          eyebrow="Pricing"
          title="Plans built for preview-to-license workflows"
          description="Preview access is always available. Downloadable original files unlock with paid plans."
          align="center"
        />
        <div className="mx-auto mb-6 grid max-w-4xl gap-3 sm:grid-cols-2">
          <EntitlementBanner state={entitlementState} />
          <EntitlementBanner state={tier === "paid" ? "subscribed" : "not-subscribed"} />
        </div>
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
          {FIXTURE_PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} tier={tier} />
          ))}
        </div>
      </Section>

      <Section className="border-y border-border bg-muted/30">
        <SectionHeader
          eyebrow="Feature comparison"
          title="Preview access vs downloadable originals"
          description="A shell comparison view mirroring eventual licensing-aware entitlement checks."
        />
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="fc-label px-4 py-3">Capability</th>
                <th className="fc-label px-4 py-3">Guest</th>
                <th className="fc-label px-4 py-3">Free user</th>
                <th className="fc-label px-4 py-3">Paid user</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Search & browse assets", "Yes", "Yes", "Yes"],
                ["Protected previews", "Yes", "Yes", "Yes"],
                ["Download originals", "No", "Limited", "Yes"],
                ["Commercial licensing", "No", "No", "Yes"],
                ["Library management", "No", "Basic", "Advanced"],
              ].map((row) => (
                <tr key={row[0]} className="border-t border-border">
                  <td className="fc-body px-4 py-3 font-medium">{row[0]}</td>
                  <td className="fc-body-sm px-4 py-3 text-muted-foreground">{row[1]}</td>
                  <td className="fc-body-sm px-4 py-3 text-muted-foreground">{row[2]}</td>
                  <td className="fc-body-sm px-4 py-3 text-muted-foreground">{row[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-lg">
          <EntitlementCtaBlock state={entitlementState} />
        </div>
      </Section>
    </>
  )
}
