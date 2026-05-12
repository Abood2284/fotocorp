"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  CalendarDays,
  Camera,
  ChevronDown,
  KeyRound,
  LayoutDashboard,
  LogOut,
  UploadCloud,
  UserRound,
  type LucideIcon,
} from "lucide-react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { logoutContributor, type ContributorAuthResponse } from "@/lib/api/contributor-api"
import { cn } from "@/lib/utils"

const navLinks: {
  label: string
  href: string
  icon: LucideIcon
  activePrefix?: string
  emphasize?: boolean
}[] = [
  { label: "Dashboard", href: "/contributor/dashboard", icon: LayoutDashboard },
  {
    label: "Uploads",
    href: "/contributor/uploads",
    icon: UploadCloud,
    activePrefix: "/contributor/uploads",
  },
  { label: "New Upload", href: "/contributor/uploads/new", icon: UploadCloud },
  { label: "Events", href: "/contributor/events", icon: CalendarDays, activePrefix: "/contributor/events" },
  { label: "Account / Security", href: "/contributor/change-password", icon: KeyRound },
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
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="max-w-40 truncate sm:max-w-56">{session.contributor.displayName}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-border bg-card py-2 shadow-lg"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate font-medium text-foreground">{session.contributor.displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{session.account.username}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Status: <span className="font-medium text-foreground">{session.contributor.status}</span>
            </p>
          </div>
          <Link
            href="/contributor/change-password"
            role="menuitem"
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
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
            <LogOut className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            Log out
          </button>
        </div>
      ) : null}
    </div>
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
  const showNewBatchShortcut = !pathname.startsWith("/contributor/uploads/new")

  async function handleLogout() {
    await logoutContributor().catch(() => null)
    router.push("/contributor/login")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {session.account.mustChangePassword ? (
        <div
          className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-center text-sm text-black dark:border-amber-400/25 dark:bg-amber-500/15 dark:text-amber-100"
          role="status"
        >
          <Link
            href="/contributor/change-password"
            className="font-semibold text-black underline underline-offset-2 dark:text-amber-100"
          >
            Update your password
          </Link>
          <span className="text-black/90 dark:text-amber-100/90">
            {" "}
            (your account still uses a temporary or reset password).
          </span>
        </div>
      ) : null}
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:px-8">
          <Link href="/contributor/dashboard" className="flex shrink-0 items-center gap-2">
            <Camera className="h-5 w-5 text-accent" />
            <span className="fc-brand text-lg font-semibold">
              foto<span className="text-accent">corp</span>
            </span>
            <span className="rounded-full border border-border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Contributor
            </span>
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-1 lg:justify-center" aria-label="Contributor navigation">
            {navLinks.map((item) => {
              const { label, href, icon: Icon, activePrefix } = item
              const active = activePrefix ? pathname.startsWith(activePrefix) : pathname === href
              const defaultStyle = active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors",
                    defaultStyle,
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              )
            })}
          </nav>
          <div className="flex flex-wrap items-center justify-end gap-2 lg:shrink-0">
            {showNewBatchShortcut ? (
              <Link
                href="/contributor/uploads/new"
                className="inline-flex items-center rounded-full bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground shadow hover:bg-primary/90 sm:text-sm"
              >
                New batch
              </Link>
            ) : null}
            <ContributorProfileMenu session={session} onLogout={handleLogout} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}
