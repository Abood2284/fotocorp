"use client"

import {
  CalendarDays,
  Camera,
  ChevronDown,
  CloudUpload,
  FileText,
  Image,
  Key,
  LayoutGrid,
  LogOut,
  Menu,
  UserRound,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { logoutContributor, type ContributorAuthResponse } from "@/lib/api/contributor-api"
import { buildSignInHref } from "@/lib/auth-sign-in-gateway"
import { cn } from "@/lib/utils"

const NAV_LINKS: {
  label: string
  href: string
  icon: LucideIcon
  activePrefix?: string
}[] = [
  { label: "Dashboard", href: "/contributor/dashboard", icon: LayoutGrid },
  { label: "Uploads", href: "/contributor/uploads", icon: CloudUpload, activePrefix: "/contributor/uploads" },
  { label: "Images", href: "/contributor/images", icon: Image, activePrefix: "/contributor/images" },
  { label: "Events", href: "/contributor/events", icon: CalendarDays, activePrefix: "/contributor/events" },
  { label: "Download Reports", href: "/contributor/download-reports", icon: FileText },
  { label: "Account", href: "/contributor/change-password", icon: Key, activePrefix: "/contributor/change-password" },
]

function SidebarNav({ pathname, onLinkClick }: { pathname: string; onLinkClick?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5 px-3" aria-label="Contributor navigation">
      {NAV_LINKS.map((item) => {
        const { label, href, icon: Icon, activePrefix } = item
        const active = activePrefix ? pathname.startsWith(activePrefix) : pathname === href
        return (
          <Link
            key={href}
            href={href}
            onClick={onLinkClick}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
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

function UserMenu({
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
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UserRound className="h-4 w-4" aria-hidden />
        </span>
        <span className="truncate text-left">{session.contributor.displayName}</span>
        <ChevronDown
          className={cn("ml-auto shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden
          size={14}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute bottom-full left-3 right-3 z-50 mb-1 rounded-xl border border-border bg-card py-2 shadow-lg"
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

/** Desktop sidebar — always visible on lg+, hidden on smaller screens. */
function DesktopSidebar({
  pathname,
  session,
  onLogout,
}: {
  pathname: string
  session: ContributorAuthResponse
  onLogout: () => void | Promise<void>
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card lg:flex">
      {/* Brand */}
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-5">
        <Link href="/contributor/dashboard" className="flex items-center gap-2.5">
          <Camera className="text-accent" aria-hidden size={20} />
          <span className="fc-brand text-lg font-semibold leading-none">
            foto<span className="text-accent">corp</span>
          </span>
        </Link>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-widest text-muted-foreground">
          Contributor
        </span>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-4">
        <SidebarNav pathname={pathname} />
      </div>

      {/* User */}
      <div className="border-t border-border p-3">
        <UserMenu session={session} onLogout={onLogout} />
      </div>
    </aside>
  )
}

/** Mobile sidebar — slides in as an overlay when `open` is true. */
function MobileSidebar({
  open,
  onClose,
  pathname,
  session,
  onLogout,
}: {
  open: boolean
  onClose: () => void
  pathname: string
  session: ContributorAuthResponse
  onLogout: () => void | Promise<void>
}) {
  return (
    <>
      {/* Backdrop */}
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      ) : null}

      {/* Panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-border bg-card shadow-xl transition-transform duration-200 lg:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
          <Link href="/contributor/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <Camera className="text-accent" aria-hidden size={20} />
            <span className="fc-brand text-lg font-semibold leading-none">
              foto<span className="text-accent">corp</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav pathname={pathname} onLinkClick={onClose} />
        </div>

        <div className="border-t border-border p-3">
          <UserMenu session={session} onLogout={onLogout} />
        </div>
      </aside>
    </>
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
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = useCallback(async () => {
    await logoutContributor().catch(() => null)
    router.push(buildSignInHref())
    router.refresh()
  }, [router])

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <DesktopSidebar pathname={pathname} session={session} onLogout={handleLogout} />

      {/* Mobile sidebar */}
      <MobileSidebar
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        pathname={pathname}
        session={session}
        onLogout={handleLogout}
      />

      {/* Main content area — offset by sidebar width on desktop */}
      <div className="lg:pl-60">
        {/* Password change banner */}
        {session.account.mustChangePassword ? (
          <div
            className="border-b border-red-800 bg-red-700 px-4 py-2 text-center text-sm text-red-50"
            role="status"
          >
            <Link
              href="/contributor/change-password"
              className="font-semibold text-white underline underline-offset-2"
            >
              Update your password
            </Link>
            <span className="text-red-100"> before continuing.</span>
          </div>
        ) : null}

        {/* Mobile header bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Open sidebar"
          >
            <Menu size={20} />
          </button>
          <Link href="/contributor/dashboard" className="flex items-center gap-2">
            <Camera className="text-accent" aria-hidden size={18} />
            <span className="fc-brand text-base font-semibold leading-none">
              foto<span className="text-accent">corp</span>
            </span>
          </Link>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
