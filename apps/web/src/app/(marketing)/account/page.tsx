import Link from "next/link"
import { Archive, Download, KeyRound, Mail, ShieldCheck } from "lucide-react"

import { AccountShell } from "@/components/account/account-shell"
import { AccountSection, AccountStoryLink } from "@/components/account/account-section"
import { requireAuth } from "@/lib/app-user"
import {
  buildAccountCapabilities,
  formatAccountDisplayName,
  formatQuotaSummary,
  resolveAccessHeadline,
} from "@/lib/account-access-summary"
import { getActiveSubscriberEntitlementQuota } from "@/lib/app-user-profile-store"

export const metadata = {
  title: "Account",
}

export default async function AccountPage() {
  const appUser = await requireAuth()
  const subscriber = appUser.isSubscriber && appUser.subscriptionStatus === "ACTIVE"
  const entitlementQuota = await getActiveSubscriberEntitlementQuota(appUser.authUserId)
  const downloadUsed = entitlementQuota?.used ?? appUser.downloadQuotaUsed
  const downloadLimit = entitlementQuota ? entitlementQuota.limit : appUser.downloadQuotaLimit
  const accessHeadline = resolveAccessHeadline(appUser)
  const capabilities = buildAccountCapabilities(appUser)
  const displayName = formatAccountDisplayName(appUser)

  return (
    <AccountShell
      title={displayName}
      description="Your Fotocorp workspace — browse the archive, save to Fotobox, and manage download access."
    >
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <AccountSection
            eyebrow="Your account"
            title="Profile"
            description="Contact details tied to licensing and email notifications from our team."
          >
            <dl className="grid gap-px border border-border bg-border sm:grid-cols-2">
              <ProfileField label="Name" value={displayName} />
              <ProfileField label="Email" value={appUser.email} />
              {subscriber ? (
                <ProfileField
                  label="Downloads this period"
                  value={formatQuotaSummary(downloadUsed, downloadLimit)}
                />
              ) : null}
            </dl>
          </AccountSection>

          <AccountSection
            eyebrow="What you can do"
            title={accessHeadline.title}
            description={accessHeadline.description}
          >
            <ul className="divide-y divide-border border border-border">
              {capabilities.map((capability) => (
                <li
                  key={capability.id}
                  className="flex gap-4 px-5 py-4 sm:px-6"
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border text-xs font-bold ${
                      capability.enabled
                        ? "border-border-strong bg-background text-foreground"
                        : "border-border bg-secondary/50 text-muted-foreground"
                    }`}
                    aria-hidden
                  >
                    {capability.enabled ? "✓" : "—"}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-foreground">{capability.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{capability.description}</p>
                  </div>
                </li>
              ))}
            </ul>
            {!subscriber ? (
              <div className="mt-5">
                <Link
                  href="/request-access"
                  className="button-primary-square inline-flex h-10 items-center justify-center px-6 text-sm font-bold"
                >
                  Request download access
                </Link>
              </div>
            ) : null}
          </AccountSection>

          <AccountSection eyebrow="Security" title="Sign-in and password">
            <p className="text-sm leading-6 text-muted-foreground">
              Update your password while signed in, or recover access from the sign-in page if you forgot it.
            </p>
            <Link
              href="/account/security"
              className="button-outline-square mt-4 inline-flex h-10 items-center justify-center gap-2 border border-border-strong px-5 text-sm font-bold"
            >
              <KeyRound size={16} aria-hidden />
              Account security
            </Link>
          </AccountSection>
        </div>

        <div className="space-y-6">
          <section className="border border-border bg-background">
            <header className="border-b border-border px-5 py-4 sm:px-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Your workspace</p>
              <h2 className="mt-2 text-lg font-semibold text-foreground">Shortcuts</h2>
            </header>
            <AccountStoryLink
              href="/account/fotobox"
              title="My Fotobox"
              description="Saved archive images you are reviewing before licensing."
            />
            <AccountStoryLink
              href="/account/downloads"
              title="My Downloads"
              description="Download history and re-download where your access allows."
            />
            <AccountStoryLink
              href={subscriber ? "/account/subscription" : "/request-access"}
              title={subscriber ? "Download access" : "Request access"}
              description={
                subscriber
                  ? "Quota summary and entitlement status."
                  : "Tell our team what you need; we follow up by email."
              }
            />
            <AccountStoryLink
              href="/search"
              title="Search the archive"
              description="Editorial photos, events, and categories across the Fotocorp library."
            />
          </section>

          <AccountSection
            eyebrow="Need help?"
            title="Licensing and support"
            description="Our team arranges subscriber access privately. Reach out if your needs change."
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/contact"
                className="button-outline-square inline-flex h-10 items-center justify-center gap-2 border border-border-strong px-5 text-sm font-bold"
              >
                <Mail size={16} aria-hidden />
                Contact Fotocorp
              </Link>
              {!subscriber ? (
                <Link
                  href="/request-access"
                  className="inline-flex h-10 items-center justify-center gap-2 px-5 text-sm font-bold text-foreground underline-offset-4 hover:underline"
                >
                  <ShieldCheck size={16} aria-hidden />
                  Request access
                </Link>
              ) : (
                <Link
                  href="/account/subscription"
                  className="inline-flex h-10 items-center justify-center gap-2 px-5 text-sm font-bold text-foreground underline-offset-4 hover:underline"
                >
                  <Download size={16} aria-hidden />
                  View access details
                </Link>
              )}
            </div>
          </AccountSection>

          <section className="border border-border bg-secondary/30 px-5 py-4 sm:px-6">
            <div className="flex items-start gap-3">
              <Archive size={20} className="mt-0.5 shrink-0 text-foreground" aria-hidden />
              <p className="text-sm leading-6 text-muted-foreground">
                Fotocorp is a news photo agency. Browse watermarked previews freely; clean downloads require
                staff-approved entitlements.
              </p>
            </div>
          </section>
        </div>
      </div>
    </AccountShell>
  )
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-4">
      <dt className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{value}</dd>
    </div>
  )
}
