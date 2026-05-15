import Link from "next/link"
import { AccountShell } from "@/components/account/account-shell"
import { requireAuth } from "@/lib/app-user"
import { formatDownloadQuotaLabel, getActiveSubscriberEntitlementQuota } from "@/lib/app-user-profile-store"

export const metadata = {
  title: "Download access",
}

export default async function AccountSubscriptionPage() {
  const appUser = await requireAuth()
  const subscriber = appUser.isSubscriber && appUser.subscriptionStatus === "ACTIVE"
  const entitlementQuota = await getActiveSubscriberEntitlementQuota(appUser.authUserId)
  const downloadUsed = entitlementQuota?.used ?? appUser.downloadQuotaUsed
  const downloadLimit = entitlementQuota ? entitlementQuota.limit : appUser.downloadQuotaLimit

  return (
    <AccountShell
      title="Download access"
      description="Staff-approved entitlements control clean downloads. Contact us if you need changes."
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <section className="rounded-2xl border border-border bg-background p-5">
          <h2 className="text-lg font-semibold text-foreground">
            {subscriber ? "Your download access is active." : "Download access is not active yet."}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {subscriber
              ? "Clean large downloads are available where licensing permits."
              : "You can browse previews and save images to Fotobox. After we approve your request, staff will activate your entitlement."}
          </p>
          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            <Field label="Status" value={appUser.subscriptionStatus} />
            <Field label="Plan" value={appUser.subscriptionPlanId ?? "Not assigned"} />
            <Field label="Downloads used" value={formatDownloadQuotaLabel(downloadUsed, downloadLimit)} />
            <Field label="Started" value={formatDate(appUser.subscriptionStartedAt)} />
            <Field label="Ends" value={formatDate(appUser.subscriptionEndsAt) ?? "No end date"} />
            <Field label="Profile" value={appUser.status} />
          </dl>
        </section>

        <section className="rounded-2xl border border-border bg-muted/25 p-5">
          <h2 className="font-semibold text-foreground">Need more access?</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Licensing is arranged privately with our team. Tell us what you need and we will follow up by email.
          </p>
          <div className="mt-5 grid gap-2">
            <Link href="/request-access" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Request access
            </Link>
            <Link href="/contact" className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-muted">
              Contact Fotocorp
            </Link>
          </div>
        </section>
      </div>
    </AccountShell>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/35 p-3">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium text-foreground">{value}</dd>
    </div>
  )
}

function formatDate(value: Date | string | null) {
  if (!value) return "Not set"
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return "Not set"
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" }).format(date)
}
