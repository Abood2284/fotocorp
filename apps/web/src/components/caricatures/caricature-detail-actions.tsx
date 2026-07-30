"use client"

import { Download, ExternalLink, Pencil } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import { buildStaffCaricatureReviewHref } from "@/lib/caricatures/caricature-public-display"
import { useCaricatureClearAccess } from "@/lib/caricatures/use-caricature-clear-access"
import { buildSignInHref } from "@/lib/auth-sign-in-gateway"
import { getStaffCaricatureOriginalUrl } from "@/lib/search/caricature-search"
import { useSharedAuthSession } from "@/lib/use-shared-auth-session"
import { cn } from "@/lib/utils"

export type CaricatureDetailAccessState =
  | "logged-out"
  | "signed-in-no-entitlement"
  | "entitled"
  | "staff"

interface CaricatureDetailActionsProps {
  assetId: string
  detailHref: string
  className?: string
}

export function CaricatureDetailActions({ assetId, detailHref, className }: CaricatureDetailActionsProps) {
  const { data: session, isPending: isSessionPending } = useSharedAuthSession()
  const { hasClearAccess, isPending: isAccessPending } = useCaricatureClearAccess()
  const isPending = isSessionPending || isAccessPending

  const accessState = useMemo((): CaricatureDetailAccessState => {
    if (session?.kind === "staff") return "staff"
    if (session?.kind === "user") {
      // Clear browse access uses ACTIVE CARICATURE entitlement.
      // Download original remains disabled until the dedicated download endpoint ships.
      return hasClearAccess ? "entitled" : "signed-in-no-entitlement"
    }
    return "logged-out"
  }, [hasClearAccess, session])

  const signInHref = buildSignInHref({ callbackUrl: detailHref })
  const requestAccessHref = "/request-access"
  const staffOriginalHref = getStaffCaricatureOriginalUrl(assetId)
  const staffEditHref = buildStaffCaricatureReviewHref(assetId)

  const showLicensingContext =
    accessState === "logged-out" || accessState === "signed-in-no-entitlement"

  return (
    <div className={cn("space-y-2", className)}>
      {showLicensingContext ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Original high-resolution artwork available to licensed subscribers.
        </p>
      ) : null}

      {accessState === "logged-out" ? (
        <>
          <Button asChild className="h-11 w-full rounded-none font-sans text-xs font-bold uppercase tracking-wider">
            <Link href={signInHref}>Sign in to download</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-11 w-full rounded-none border-border-strong font-sans text-xs font-bold uppercase tracking-wider"
          >
            <Link href={requestAccessHref}>Request access</Link>
          </Button>
        </>
      ) : null}

      {accessState === "signed-in-no-entitlement" ? (
        <Button
          asChild
          className="h-11 w-full rounded-none font-sans text-xs font-bold uppercase tracking-wider"
          disabled={isPending}
        >
          <Link href={requestAccessHref}>Request download access</Link>
        </Button>
      ) : null}

      {accessState === "entitled" ? (
        <Button
          type="button"
          className="h-11 w-full rounded-none font-sans text-xs font-bold uppercase tracking-wider"
          disabled
          aria-disabled
        >
          <Download size={16} className="mr-2" aria-hidden />
          Download original
        </Button>
      ) : null}

      {accessState === "staff" ? (
        <>
          <Button asChild className="h-11 w-full rounded-none font-sans text-xs font-bold uppercase tracking-wider">
            <a href={staffOriginalHref} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={16} className="mr-2" aria-hidden />
              View original
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-11 w-full rounded-none border-border-strong font-sans text-xs font-bold uppercase tracking-wider"
          >
            <Link href={staffEditHref}>
              <Pencil size={16} className="mr-2" aria-hidden />
              Edit caricature
            </Link>
          </Button>
        </>
      ) : null}

      {accessState === "signed-in-no-entitlement" ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Download access requires staff approval.
        </p>
      ) : null}
    </div>
  )
}
