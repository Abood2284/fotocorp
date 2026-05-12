"use client"

import Link from "next/link"
import { Download, Heart, CalendarDays, BadgeCheck } from "lucide-react"
import { useMockSession } from "@/features/session/mock-session-provider"
import { EntitlementBanner } from "@/components/entitlement/entitlement-banner"
import { EntitlementCtaBlock } from "@/components/entitlement/entitlement-cta-block"
import { EmptyState } from "@/components/shared/empty-state"
import { AssetGrid } from "@/components/search/asset-grid"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getDownloadsByTier, getFavoritesByTier } from "@/lib/fixtures/library"

interface LibraryShellProps {
  mode: "downloads" | "favorites"
}

export function LibraryShell({ mode }: LibraryShellProps) {
  const { tier, entitlementState } = useMockSession()

  const downloads = getDownloadsByTier(tier)
  const favorites = getFavoritesByTier(tier)

  if (mode === "downloads") {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your downloads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fixture-backed library shell for licensed original downloads.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="space-y-4">
            <EntitlementBanner state={entitlementState} />

            {downloads.length === 0 ? (
              <EmptyState
                icon={Download}
                title="No downloads yet"
                description="Downloaded originals will appear here once your account has entitlement."
                action={{ label: "Browse assets", href: "/search" }}
              />
            ) : (
              <>
                <AssetGrid assets={downloads.map((item) => item.asset)} />
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Recent license activity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {downloads.map((item) => (
                      <div key={`${item.asset.id}-${item.downloadedAt}`} className="flex items-center justify-between rounded-md border border-border p-2.5 text-sm">
                        <div>
                          <p className="font-medium">{item.asset.title ?? item.asset.filename}</p>
                          <p className="text-xs text-muted-foreground">{item.license} license</p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {item.downloadedAt}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </>
            )}
          </section>

          <aside className="space-y-4">
            <EntitlementCtaBlock state={entitlementState} />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Library status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  Current tier: <span className="font-medium text-foreground capitalize">{tier}</span>
                </p>
                <p className="text-muted-foreground">
                  Total downloaded: <span className="font-medium text-foreground">{downloads.length}</span>
                </p>
                <Link href="/favorites" className="inline-flex items-center gap-1 text-primary hover:underline">
                  <Heart className="h-3.5 w-3.5" />
                  View favorites
                </Link>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Favorites</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Save assets you want to review, license, or download later.
        </p>
      </header>

      <div className="space-y-4">
        <EntitlementBanner state={entitlementState} />

        {favorites.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="No favorites saved"
            description="Heart assets from search results to build your shortlist."
            action={{ label: "Explore search", href: "/search" }}
          />
        ) : (
          <>
            <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{favorites.length}</span> saved assets
              </p>
              <Badge variant="secondary">
                <BadgeCheck className="h-3.5 w-3.5" />
                Synced in mock session
              </Badge>
            </div>
            <AssetGrid assets={favorites} />
          </>
        )}
      </div>
    </div>
  )
}
