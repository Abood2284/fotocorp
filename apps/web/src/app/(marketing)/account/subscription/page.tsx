import Link from "next/link"

import { AccountShell } from "@/components/account/account-shell"
import { AccountSection } from "@/components/account/account-section"
import { requireAuth } from "@/lib/app-user"
import {
  formatDownloadQuotaLabel,
  getActiveSubscriberEntitlementQuota,
  listSubscriberEntitlements,
} from "@/lib/app-user-profile-store"
import {
  formatEntitlementAssetLabel,
  formatEntitlementDownloadsLine,
  formatEntitlementQualityDescription,
  formatEntitlementStatusLabel,
  formatEntitlementValidity,
  partitionSubscriberEntitlements,
} from "@/lib/subscriber-entitlement-display"
import { formatImageQualityPreference } from "@/lib/staff/access-inquiry-labels"

export const metadata = {
  title: "Download access",
}

export default async function AccountSubscriptionPage() {
  const appUser = await requireAuth()
  const subscriber = appUser.isSubscriber && appUser.subscriptionStatus === "ACTIVE"
  const entitlements = await listSubscriberEntitlements(appUser.authUserId)
  const { activeNow, other } = partitionSubscriberEntitlements(entitlements)
  const entitlementQuota = await getActiveSubscriberEntitlementQuota(appUser.authUserId)
  const downloadUsed = entitlementQuota?.used ?? appUser.downloadQuotaUsed
  const downloadLimit = entitlementQuota ? entitlementQuota.limit : appUser.downloadQuotaLimit

  return (
    <AccountShell
      title="Download access"
      description="Staff-approved entitlements control clean downloads by asset type. Contact us if you need changes."
    >
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <AccountSection
            eyebrow="Entitlements"
            title={subscriber ? "Your download limits" : "Download access is not active yet"}
            description={
              subscriber
                ? "Each row is a separate asset type with its own download count and quality cap."
                : "You can browse previews and save to Fotobox. When staff activates access, your limits appear here."
            }
          >
            {activeNow.length > 0 ? (
              <EntitlementsTable rows={activeNow} showStatus={false} />
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                No active entitlements on your account yet.
                {other.length > 0
                  ? " See pending or inactive rows below."
                  : " Request access and our team will set limits per asset type (images, video, caricature)."}
              </p>
            )}

            {subscriber && activeNow.length > 0 ? (
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Combined usage across active entitlements:{" "}
                <span className="font-bold text-foreground">
                  {formatDownloadQuotaLabel(downloadUsed, downloadLimit)}
                </span>
              </p>
            ) : null}
          </AccountSection>

          {other.length > 0 ? (
            <AccountSection
              eyebrow="Other rows"
              title="Pending or inactive entitlements"
              description="These asset types are on your account but are not downloadable until staff activates them."
            >
              <EntitlementsTable rows={other} showStatus />
            </AccountSection>
          ) : null}

          <AccountSection eyebrow="Account" title="Subscription summary">
            <dl className="grid gap-px border border-border bg-border sm:grid-cols-2">
              <SummaryField label="Subscription status" value={formatSubscriptionStatus(appUser.subscriptionStatus)} />
              <SummaryField
                label="Subscriber"
                value={subscriber ? "Yes — downloads enabled" : "No — browse and Fotobox only"}
              />
              <SummaryField label="Started" value={formatDate(appUser.subscriptionStartedAt)} />
              <SummaryField label="Ends" value={formatDate(appUser.subscriptionEndsAt) ?? "No end date"} />
            </dl>
          </AccountSection>
        </div>

        <AccountSection
          eyebrow="Need help?"
          title="Licensing and support"
          description="Our team arranges access privately. Tell us if you need more downloads or a higher quality cap."
        >
          <div className="flex flex-col gap-3">
            <Link
              href="/request-access"
              className="button-primary-square inline-flex h-10 items-center justify-center px-6 text-sm font-bold"
            >
              Request access
            </Link>
            <Link
              href="/contact"
              className="button-outline-square inline-flex h-10 items-center justify-center border border-border-strong px-6 text-sm font-bold"
            >
              Contact Fotocorp
            </Link>
          </div>
        </AccountSection>
      </div>
    </AccountShell>
  )
}

function EntitlementsTable({
  rows,
  showStatus,
}: {
  rows: Awaited<ReturnType<typeof listSubscriberEntitlements>>
  showStatus: boolean
}) {
  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full min-w-lg border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/50">
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Asset type
            </th>
            {showStatus ? (
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Status
              </th>
            ) : null}
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Downloads
            </th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Quality
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const validity = formatEntitlementValidity(row)
            return (
              <tr key={row.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3 align-top">
                  <p className="font-bold text-foreground">{formatEntitlementAssetLabel(row.assetType)}</p>
                  {validity ? <p className="mt-1 text-xs text-muted-foreground">{validity}</p> : null}
                </td>
                {showStatus ? (
                  <td className="px-4 py-3 align-top text-foreground">
                    {formatEntitlementStatusLabel(row.status)}
                  </td>
                ) : null}
                <td className="px-4 py-3 align-top font-medium text-foreground">
                  {formatEntitlementDownloadsLine(row)}
                </td>
                <td className="px-4 py-3 align-top">
                  <p className="font-medium text-foreground">
                    {formatImageQualityPreference(row.qualityAccess)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {formatEntitlementQualityDescription(row.qualityAccess)}
                  </p>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-4">
      <dt className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{value}</dd>
    </div>
  )
}

function formatSubscriptionStatus(status: string) {
  const normalized = status.trim().toUpperCase()
  if (normalized === "ACTIVE") return "Active"
  if (normalized === "NONE") return "None"
  if (normalized === "EXPIRED") return "Expired"
  if (normalized === "SUSPENDED") return "Suspended"
  if (normalized === "CANCELLED") return "Cancelled"
  return status.replace(/_/g, " ")
}

function formatDate(value: Date | string | null) {
  if (!value) return "Not set"
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return "Not set"
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" }).format(date)
}
