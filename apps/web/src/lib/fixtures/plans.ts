/**
 * Fixture pricing plans — provisional frontend contract.
 * Prices are in USD whole dollars (not cents) for display simplicity.
 * Replace with API adapter when billing is integrated.
 */
import type { Plan } from "@/types"

export const FIXTURE_PLANS: Plan[] = [
  {
    id: "plan-free",
    name: "Free",
    tagline: "Try before you subscribe",
    priceMonthly: 0,
    priceAnnual: 0,
    currency: "USD",
    ctaLabel: "Get started",
    features: [
      { label: "10 watermarked previews / month", included: true },
      { label: "Standard resolution downloads", included: false },
      { label: "Commercial license", included: false },
      { label: "Priority support", included: false },
      { label: "Bulk download", included: false },
      { label: "API access", included: false },
    ],
  },
  {
    id: "plan-pro",
    name: "Pro",
    tagline: "For creators and small teams",
    priceMonthly: 29,
    priceAnnual: 22,
    currency: "USD",
    popular: true,
    ctaLabel: "Start free trial",
    features: [
      { label: "250 downloads / month", included: true },
      { label: "Full resolution downloads", included: true },
      { label: "Commercial license", included: true },
      { label: "Priority support", included: true },
      { label: "Bulk download", included: false },
      { label: "API access", included: false },
    ],
  },
  {
    id: "plan-enterprise",
    name: "Enterprise",
    tagline: "Unlimited scale for studios & agencies",
    priceMonthly: null,
    priceAnnual: null,
    currency: "USD",
    ctaLabel: "Contact sales",
    features: [
      { label: "Unlimited downloads", included: true },
      { label: "Full resolution downloads", included: true },
      { label: "Extended commercial license", included: true },
      { label: "Dedicated account manager", included: true },
      { label: "Bulk download", included: true },
      { label: "API access", included: true },
    ],
  },
]
