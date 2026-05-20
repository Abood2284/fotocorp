"use client"

import { CalendarDays, Camera, ChevronDown, Key, LayoutGrid, LogOut, CloudUpload, UserRound } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { type ReactNode, useEffect, useRef, useState } from "react"
import { logoutContributor, type ContributorAuthResponse } from "@/lib/api/contributor-api"
import { cn } from "@/lib/utils"

const navLinks: {
  label: string
  href: string
  icon: LucideIcon
  activePrefix?: string
}[] = [
  { label: "Dashboard", href: "/contributor/dashboard", icon: LayoutGrid },
  {
    label: "Uploads",
    href: "/contributor/uploads",
    icon: CloudUpload,
    activePrefix: "/contributor/uploads",
  },
  { label: "Events", href: "/contributor/events", icon: CalendarDays, activePrefix: "/contributor/events" },
  {
    label: "Account",
    href: "/contributor/change-password",
    icon: Key,
    activePrefix: "/contributor/change-password",
  },
]

function ContributorProfileMenu({
  session,
  onLogout,
}: {
  session: ContributorAuthResponse
  onLogout: () => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-[min(100%,12rem)] items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-none sm:px-3 sm:py-2"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UserRound className="h-4 w-4" aria-hidden />
        </span>
        <span className="hidden truncate sm:inline">{session.contributor.displayName}</span>
        <ChevronDown
          className={cn(" shrink-0 text-muted-foreground transition-transform", open &&"rotate-180")}
          aria-hidden size={16} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-border bg-card py-2 shadow-lg"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate font-medium text-foreground">{session.contributor.displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{session.account.username}</p>
          </div>
          <Link
            href="/contributor/change-password"
            role="menuitem"
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            <Key className="shrink-0 text-muted-foreground" aria-hidden size={16} />
            Change password
          </Link>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted"
            onClick={() => {
              setOpen(false)
              void onLogout()
            }}
          >
            <LogOut className="shrink-0 text-muted-foreground" aria-hidden size={16} />
            Log out
          </button>
        </div>
      ) : null}
    </div>
  )
}

function ContributorNav({ pathname }: { pathname: string }) {
  return (
    <nav
      className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:justify-center"
      aria-label="Contributor navigation"
    >
      {navLinks.map((item) => {
        const { label, href, icon: Icon, activePrefix } = item
        const active = activePrefix ? pathname.startsWith(activePrefix) : pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export function ContributorShell({
  children,
  session,
}: {
  children: ReactNode
  session: ContributorAuthResponse
}) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await logoutContributor().catch(() => null)
    router.push("/contributor/login")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {session.account.mustChangePassword ? (
        <div
          className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-black dark:border-amber-400/25 dark:bg-amber-500/15 dark:text-amber-100"
          role="status"
        >
          <Link
            href="/contributor/change-password"
            className="font-semibold text-black underline underline-offset-2 dark:text-amber-100"
          >
            Update your password
          </Link>
          <span className="text-black/90 dark:text-amber-100/90"> before continuing.</span>
        </div>
      ) : null}

      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between gap-3 sm:gap-4">
            <Link href="/contributor/dashboard" className="flex shrink-0 items-center gap-2.5">
              <Camera className="text-accent" aria-hidden size={20} />
              <span className="fc-brand text-lg font-semibold leading-none">
                foto<span className="text-accent">corp</span>
              </span>
              <span className="hidden rounded-md bg-muted px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-widest text-muted-foreground sm:inline">
                Contributor
              </span>
            </Link>

            <div className="hidden min-w-0 flex-1 md:flex">
              <ContributorNav pathname={pathname} />
            </div>

            <ContributorProfileMenu session={session} onLogout={handleLogout} />
          </div>

          <div className="border-t border-border/60 pb-2 pt-1 md:hidden">
            <ContributorNav pathname={pathname} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}
