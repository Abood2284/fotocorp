import Link from "next/link"
import type { ReactNode } from "react"
import { Archive, Download, ShieldCheck } from "lucide-react"
import { AccountShell } from "@/components/account/account-shell"
import { requireAuth } from "@/lib/app-user"
import { formatDownloadQuotaLabel, getActiveSubscriberEntitlementQuota } from "@/lib/app-user-profile-store"

export const metadata = {
  title: "Account",
}

export default async function AccountPage() {
  const appUser = await requireAuth()
  const subscriber = appUser.isSubscriber && appUser.subscriptionStatus === "ACTIVE"
  const entitlementQuota = await getActiveSubscriberEntitlementQuota(appUser.authUserId)
  const downloadUsed = entitlementQuota?.used ?? appUser.downloadQuotaUsed
  const downloadLimit = entitlementQuota ? entitlementQuota.limit : appUser.downloadQuotaLimit

  return (
    <AccountShell
      title="Your Fotocorp account"
      description="Manage saved images, download history, and subscriber access from one place."
    >
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-border bg-background p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Account status</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {subscriber
                  ? "Your subscriber access is active."
                  : "Clean downloads require staff-approved access. You can still browse and save images to Fotobox."}
              </p>
            </div>
          </div>
          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            <ProfileField label="Email" value={appUser.email} />
            <ProfileField label="Role" value={appUser.role} />
            <ProfileField label="Profile" value={appUser.status} />
            <ProfileField label="Subscription" value={appUser.subscriptionStatus} />
            <ProfileField label="Downloads used" value={formatDownloadQuotaLabel(downloadUsed, downloadLimit)} />
            <ProfileField label="Subscriber" value={appUser.isSubscriber ? "Yes" : "No"} />
          </dl>
        </section>

        <section className="grid gap-3">
          <QuickLink
            href="/account/fotobox"
            icon={<Archive className="h-5 w-5" />}
            title="My Fotobox"
            description="Review saved archive images and decide what to license."
          />
          <QuickLink
            href="/account/downloads"
            icon={<Download className="h-5 w-5" />}
            title="My Downloads"
            description="See subscriber download history and re-download eligible files."
          />
          <QuickLink
            href={subscriber ? "/account/subscription" : "/request-access"}
            icon={<ShieldCheck className="h-5 w-5" />}
            title={subscriber ? "Download access" : "Request access"}
            description={subscriber ? "Check access status and quota summary." : "Tell our team what you need; we will email you."}
          />
        </section>
      </div>
    </AccountShell>
  )
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/35 p-3">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium text-foreground">{value}</dd>
    </div>
  )
}

function QuickLink({
  href,
  icon,
  title,
  description,
}: {
  href: string
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <Link href={href} className="rounded-2xl border border-border bg-background p-5 transition-colors hover:bg-muted/30">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">{icon}</div>
        <div>
          <h2 className="font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
    </Link>
  )
}

