// apps/web/src/components/layout/header.tsx
"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Suspense } from "react"
import {
  Archive,
  Camera,
  ChevronDown,
  Download,
  Gauge,
  HardDrive,
  Image,
  Inbox,
  LogOut,
  Menu,
  Shield,
  UploadCloud,
  UserRound,
  Users,
  X,
} from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

/** Matches homepage hero (`--surface-warm` / #faf8f5) */
const HEADER_SHELL_CLASS =
  "relative z-50 w-full bg-[#faf8f5] text-foreground"

export type HeaderUserProfile = {
  email: string
  displayName: string | null
  role: "USER" | "PHOTOGRAPHER" | "ADMIN" | "SUPER_ADMIN"
  isSubscriber: boolean
  subscriptionStatus: "NONE" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED"
}

export type StaffBrief = {
  displayName: string
  username: string
  role: string
}

interface HeaderProps {
  userProfile?: HeaderUserProfile | null
  staffBrief?: StaffBrief | null
}

interface HeaderLink {
  label: string
  href: string
}

const PRIMARY_NAV_LINKS: HeaderLink[] = [
  { label: "Creative", href: "/search" },
  { label: "Editorial", href: "/search?sort=latest" },
  { label: "Video", href: "/video" },
  { label: "Collections", href: "/categories" },
]

const MOBILE_GROUPS: Array<{ title: string; links: HeaderLink[] }> = [
  {
    title: "Browse",
    links: [
      { label: "Search", href: "/search" },
      { label: "Latest", href: "/search?sort=latest" },
      { label: "Categories", href: "/categories" },
      { label: "Events", href: "/events" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Services", href: "/services" },
      { label: "Contact", href: "/contact" },
    ],
  },
]

export function Header({ userProfile, staffBrief }: HeaderProps) {
  return (
    <Suspense fallback={<HeaderFallback userProfile={userProfile} staffBrief={staffBrief} />}>
      <HeaderContent userProfile={userProfile} staffBrief={staffBrief} />
    </Suspense>
  )
}

function HeaderContent({ userProfile, staffBrief }: HeaderProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [mobileOpen, setMobileOpen] = useState(false)
  const sortParam = searchParams.get("sort")

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <header className={HEADER_SHELL_CLASS}>
      <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="fc-brand flex shrink-0 items-center gap-2 rounded-md py-1 pr-3 font-semibold tracking-tight transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Fotocorp home"
        >
          <Camera className="h-7 w-7 text-primary" />
          <span className="hidden text-2xl sm:inline-block">
            foto<span className="text-accent">corp</span>
          </span>
        </Link>

        <nav
          className="hidden min-w-0 flex-1 items-center gap-1 lg:flex"
          aria-label="Primary navigation"
        >
          {PRIMARY_NAV_LINKS.map((link) => (
            <MegaMenu
              key={link.href}
              link={link}
              pathname={pathname}
              sortParam={sortParam}
            />
          ))}
          <RoleMainLinks
            userProfile={userProfile}
            staffBrief={staffBrief}
            pathname={pathname}
            sortParam={sortParam}
          />
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-4 sm:gap-6">
          <Link
            href="/account/fotobox"
            className="hidden items-center gap-2 fc-label text-[#6b7280] transition-colors hover:text-foreground lg:flex"
          >
            <Archive className="h-4.5 w-4.5" />
            Fotobox
          </Link>

          <div className="hidden items-center gap-2 lg:flex">
            <AccountMenu userProfile={userProfile} staffBrief={staffBrief} />
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-panel"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div
        id="mobile-nav-panel"
        className={cn(
          "overflow-hidden border-t border-[#ede9e0] bg-[#faf8f5] transition-all duration-200 lg:hidden",
          mobileOpen
            ? "max-h-[calc(100vh-4rem)] overflow-y-auto opacity-100"
            : "pointer-events-none max-h-0 opacity-0",
        )}
      >
        <nav
          className="mx-auto grid max-w-[1600px] gap-5 px-4 py-5 sm:px-6"
          aria-label="Mobile navigation"
        >
          {MOBILE_GROUPS.map((group) => (
            <MobileLinkGroup
              key={group.title}
              group={group}
              pathname={pathname}
              sortParam={sortParam}
            />
          ))}
          <MobileRoleLinks
            userProfile={userProfile}
            staffBrief={staffBrief}
            pathname={pathname}
            sortParam={sortParam}
          />
          <MobileAccountMenu userProfile={userProfile} staffBrief={staffBrief} />
        </nav>
      </div>
    </header>
  )
}

function HeaderFallback({ userProfile, staffBrief }: HeaderProps) {
  return <HeaderStatic userProfile={userProfile} staffBrief={staffBrief} />
}

function HeaderStatic({ userProfile, staffBrief }: HeaderProps) {
  const pathname = "/"
  const sortParam = null
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className={HEADER_SHELL_CLASS}>
      <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="fc-brand flex shrink-0 items-center gap-2 rounded-md py-1 pr-3 font-semibold tracking-tight transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Fotocorp home"
        >
          <Camera className="h-7 w-7 text-primary" />
          <span className="hidden text-2xl sm:inline-block">
            foto<span className="text-accent">corp</span>
          </span>
        </Link>

        <nav
          className="hidden min-w-0 flex-1 items-center gap-1 lg:flex"
          aria-label="Primary navigation"
        >
          {PRIMARY_NAV_LINKS.map((link) => (
            <MegaMenu
              key={link.href}
              link={link}
              pathname={pathname}
              sortParam={sortParam}
            />
          ))}
          <RoleMainLinks
            userProfile={userProfile}
            staffBrief={staffBrief}
            pathname={pathname}
            sortParam={sortParam}
          />
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-4 sm:gap-6">
          <Link
            href="/account/fotobox"
            className="hidden items-center gap-2 fc-label text-[#6b7280] transition-colors hover:text-foreground lg:flex"
          >
            <Archive className="h-4.5 w-4.5" />
            Fotobox
          </Link>

          <div className="hidden items-center gap-2 lg:flex">
            <AccountMenu userProfile={userProfile} staffBrief={staffBrief} />
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-panel"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </header>
  )
}


const MEGA_MENU_ITEMS: Record<string, { label: string; href: string }[]> = {
  Creative: [
    { label: "All creative", href: "/search" },
    { label: "Photography", href: "/search?type=photo" },
    { label: "Illustrations", href: "/search?type=illustration" },
  ],
  Editorial: [
    { label: "Latest", href: "/search?sort=latest" },
    { label: "Sports", href: "/search?category=sports" },
    { label: "Celebrity", href: "/search?category=celebrity" },
    { label: "News", href: "/search?category=news" },
  ],
  Video: [
    { label: "All video", href: "/video" },
    { label: "News footage", href: "/video?category=news" },
    { label: "Sports footage", href: "/video?category=sports" },
  ],
  Collections: [
    { label: "Browse all", href: "/categories" },
    { label: "Archive collections", href: "/categories?type=archive" },
    { label: "Curated sets", href: "/categories?type=curated" },
  ],
}

function MegaMenu({ link, pathname, sortParam }: { link: HeaderLink; pathname: string; sortParam: string | null }) {
  const active = isActivePath(pathname, link.href, sortParam)
  const items = MEGA_MENU_ITEMS[link.label] ?? []

  return (
    <div className="group relative flex items-center">
      <Link
        href={link.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "fc-label flex items-center gap-1 px-3 py-2 transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-[#6b7280]",
        )}
      >
        {link.label}
        <ChevronDown className="h-3 w-3 opacity-60 transition-transform duration-200 group-hover:rotate-180" />
      </Link>

      {/* Dropdown panel */}
      <div className="pointer-events-none absolute top-full left-0 z-50 translate-y-1 opacity-0 transition-all duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
        <div className="mt-1 min-w-[180px] overflow-hidden rounded-xl border border-[#e5dfd3] bg-[#faf8f5] shadow-[0_8px_32px_rgba(26,37,64,0.10)]">
          <div className="p-1.5">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3.5 py-2 text-[13px] font-medium leading-snug text-[#4b5563] transition-colors hover:bg-white hover:text-[#0d0f1a]"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}


function NavLink({ link, pathname, sortParam }: { link: HeaderLink; pathname: string; sortParam: string | null }) {
  const active = isActivePath(pathname, link.href, sortParam)

  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-full items-center px-1 text-sm font-medium transition-colors hover:text-foreground",
        active ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-foreground" : "text-muted-foreground",
      )}
    >
      {link.label}
    </Link>
  )
}

function MoreMenu() {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  return (
    <div ref={menuRef} className="relative flex h-full items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-full items-center gap-1 px-1 text-sm font-medium transition-colors hover:text-foreground",
          open ? "text-foreground" : "text-muted-foreground"
        )}
      >
        More <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute top-full right-0 z-50 mt-1 w-48 rounded-xl border border-border bg-background p-2 shadow-xl">
          <Link href="/about" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">About</Link>
          <Link href="/contact" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">Contact</Link>
          <Link href="/services" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">Services</Link>
        </div>
      )}
    </div>
  )
}

function RoleMainLinks({
  userProfile,
  staffBrief,
  pathname,
  sortParam,
}: {
  userProfile?: HeaderUserProfile | null
  staffBrief?: StaffBrief | null
  pathname: string
  sortParam: string | null
}) {
  const staffLinks: HeaderLink[] = []
  if (staffBrief) staffLinks.push({ label: "Staff", href: "/staff/dashboard" })

  if (!userProfile) {
    if (staffLinks.length === 0) return null
    return (
      <>
        {staffLinks.map((link) => (
          <NavLink key={link.href} link={link} pathname={pathname} sortParam={sortParam} />
        ))}
      </>
    )
  }

  const links: HeaderLink[] = [...staffLinks]

  return (
    <>
      {links.map((link) => (
        <NavLink key={link.href} link={link} pathname={pathname} sortParam={sortParam} />
      ))}
    </>
  )
}

function AccountMenu({
  userProfile,
  staffBrief,
}: {
  userProfile?: HeaderUserProfile | null
  staffBrief?: StaffBrief | null
}) {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const user = session?.user

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  async function handleSignOut() {
    await authClient.signOut()
    setOpen(false)
    router.push("/sign-in")
    router.refresh()
  }

  async function handleStaffSignOut() {
    await fetch("/api/staff/auth/logout", { method: "POST", credentials: "include" })
    setOpen(false)
    router.refresh()
  }

  if (isPending) {
    return <div className="h-9 w-32 rounded-full bg-muted" aria-hidden />
  }

  if (!user) {
    if (staffBrief) {
      const staffLabel = staffBrief.displayName.trim() || staffBrief.username
      return (
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex h-10 max-w-56 items-center gap-2 rounded-full border border-border bg-background px-2 pr-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={open}
            aria-haspopup="menu"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-white">
              {getUserInitial(staffLabel)}
            </span>
            <span className="truncate">{staffLabel}</span>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
          </button>
          {open && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-border bg-background p-2 shadow-xl"
            >
              <div className="border-b border-border px-3 py-2">
                <p className="truncate text-sm font-semibold text-foreground">{staffLabel}</p>
                <p className="truncate text-xs text-muted-foreground">Staff · {staffBrief.role}</p>
              </div>
              <div className="py-2">
                {getStaffToolAccountLinks().map((item) => (
                  <AccountMenuLink key={item.href} item={item} onNavigate={() => setOpen(false)} />
                ))}
              </div>
              <div className="border-t border-border pt-2">
                <Link
                  href="/sign-in"
                  role="menuitem"
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  <UserRound className="h-4 w-4" />
                  Customer sign in
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleStaffSignOut()}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  Staff sign out
                </button>
              </div>
            </div>
          )}
        </div>
      )
    }

    return (
      <>
        <Link
          href="/sign-in"
          className={cn(buttonVariants({ size: "sm" }), "rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-6 font-semibold")}
        >
          Sign In
        </Link>
      </>
    )
  }

  const displayName = getUserDisplayName(userProfile, user)
  const menuItems = getAccountLinks(userProfile, staffBrief)

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 max-w-56 items-center gap-2 rounded-full border border-border bg-background px-2 pr-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
          {getUserInitial(displayName)}
        </span>
        <span className="truncate">{displayName}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-border bg-background p-2 shadow-xl"
        >
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{userProfile?.email ?? user.email}</p>
          </div>
          <div className="py-2">
            {menuItems.map((item) => (
              <AccountMenuLink key={item.href} item={item} onNavigate={() => setOpen(false)} />
            ))}
          </div>
          {staffBrief ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => void handleStaffSignOut()}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Staff sign out
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function MobileLinkGroup({
  group,
  pathname,
  sortParam,
}: {
  group: { title: string; links: HeaderLink[] }
  pathname: string
  sortParam: string | null
}) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{group.title}</h2>
      <div className="grid gap-1">
        {group.links.map((link) => (
          <MobileNavLink key={link.href} link={link} pathname={pathname} sortParam={sortParam} />
        ))}
      </div>
    </section>
  )
}

function MobileRoleLinks({
  userProfile,
  staffBrief,
  pathname,
  sortParam,
}: {
  userProfile?: HeaderUserProfile | null
  staffBrief?: StaffBrief | null
  pathname: string
  sortParam: string | null
}) {
  const staffRoleLinks = staffBrief ? getStaffRoleLinks() : []

  if (!userProfile) {
    if (staffRoleLinks.length === 0) return null
    return (
      <MobileLinkGroup group={{ title: "Staff", links: staffRoleLinks }} pathname={pathname} sortParam={sortParam} />
    )
  }

  const roleLinks = getRoleLinks(userProfile, staffBrief)
  const subscriber = isActiveSubscriber(userProfile)
  const accountLinks: HeaderLink[] = [
    { label: "My account", href: "/account" },
    { label: "Fotobox", href: "/account/fotobox" },
    subscriber ? { label: "Downloads", href: "/account/downloads" } : { label: "Subscription", href: "/account/subscription" },
  ]

  return (
    <>
      <MobileLinkGroup group={{ title: "Account", links: accountLinks }} pathname={pathname} sortParam={sortParam} />
      {staffRoleLinks.length > 0 && (
        <MobileLinkGroup group={{ title: "Staff", links: staffRoleLinks }} pathname={pathname} sortParam={sortParam} />
      )}
      {roleLinks.length > 0 && (
        <MobileLinkGroup
          group={{
            title: userProfile.role === "PHOTOGRAPHER" ? "Contributor" : "Workspace",
            links: roleLinks,
          }}
          pathname={pathname}
          sortParam={sortParam}
        />
      )}
    </>
  )
}

function MobileAccountMenu({
  userProfile,
  staffBrief,
}: {
  userProfile?: HeaderUserProfile | null
  staffBrief?: StaffBrief | null
}) {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const user = session?.user

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  async function handleStaffSignOut() {
    await fetch("/api/staff/auth/logout", { method: "POST", credentials: "include" })
    router.refresh()
  }

  if (isPending) {
    return <div className="h-16 rounded-xl bg-muted" aria-hidden />
  }

  if (!user) {
    if (staffBrief) {
      const staffLabel = staffBrief.displayName.trim() || staffBrief.username
      return (
        <section className="rounded-xl border border-border bg-muted/35 p-3">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-white">
              {getUserInitial(staffLabel)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">{staffLabel}</span>
              <span className="block truncate text-xs text-muted-foreground">Staff session</span>
            </span>
          </div>
          <div className="grid gap-2">
            <Link href="/staff/dashboard" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
              Staff dashboard
            </Link>
            <button
              type="button"
              onClick={() => void handleStaffSignOut()}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Staff sign out
            </button>
            <Link href="/sign-in" className={cn(buttonVariants(), "w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold")}>
              Customer sign in
            </Link>
          </div>
        </section>
      )
    }

    return (
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Account</h2>
        <div className="grid grid-cols-1 gap-2">
          <Link href="/sign-in" className={cn(buttonVariants(), "rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold")}>
            Sign In
          </Link>
        </div>
      </section>
    )
  }

  const displayName = getUserDisplayName(userProfile, user)

  return (
    <section className="rounded-xl border border-border bg-muted/35 p-3">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
          {getUserInitial(displayName)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">{displayName}</span>
          <span className="block truncate text-xs text-muted-foreground">{userProfile?.email ?? user.email}</span>
        </span>
      </div>
      <div className="grid gap-2">
        {staffBrief ? (
          <button
            type="button"
            onClick={() => void handleStaffSignOut()}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Staff sign out
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </section>
  )
}

function MobileNavLink({ link, pathname, sortParam }: { link: HeaderLink; pathname: string; sortParam: string | null }) {
  const active = isActivePath(pathname, link.href, sortParam)

  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground",
        active ? "bg-muted text-foreground underline underline-offset-4" : "text-muted-foreground",
      )}
    >
      {link.label}
    </Link>
  )
}

type AccountLink = HeaderLink & { icon: LucideIcon }

function AccountMenuLink({ item, onNavigate }: { item: AccountLink; onNavigate: () => void }) {
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      role="menuitem"
      onClick={onNavigate}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  )
}

function getStaffToolAccountLinks(): AccountLink[] {
  return [
    { label: "Staff dashboard", href: "/staff/dashboard", icon: Gauge },
    { label: "Contributor uploads", href: "/staff/contributor-uploads", icon: Inbox },
    { label: "Catalog", href: "/staff/catalog", icon: Image },
    { label: "Users", href: "/staff/users", icon: Users },
    { label: "Storage", href: "/staff/storage", icon: HardDrive },
    { label: "Audit", href: "/staff/audit", icon: Shield },
  ]
}

function getStaffRoleLinks(): HeaderLink[] {
  return [
    { label: "Staff dashboard", href: "/staff/dashboard" },
    { label: "Contributor uploads", href: "/staff/contributor-uploads" },
  ]
}

function getAccountLinks(userProfile?: HeaderUserProfile | null, staffBrief?: StaffBrief | null): AccountLink[] {
  const staffPrefix = staffBrief ? getStaffToolAccountLinks() : []

  if (!userProfile) {
    return staffPrefix.length > 0
      ? staffPrefix
      : [
          { label: "My account", href: "/account", icon: UserRound },
          { label: "My Fotobox", href: "/account/fotobox", icon: Archive },
          { label: "My downloads", href: "/account/downloads", icon: Download },
          { label: "Subscription", href: "/account/subscription", icon: Shield },
        ]
  }

  if (userProfile.role === "PHOTOGRAPHER") {
    return [
      ...staffPrefix,
      { label: "Contributor dashboard", href: "/contributor/dashboard", icon: Camera },
      { label: "Uploads", href: "/contributor/uploads", icon: UploadCloud },
      { label: "Download reports", href: "/contributor/download-reports", icon: Download },
      { label: "My account", href: "/account", icon: UserRound },
    ]
  }

  return [
    ...staffPrefix,
    { label: "My account", href: "/account", icon: UserRound },
    { label: "My Fotobox", href: "/account/fotobox", icon: Archive },
    { label: "My downloads", href: "/account/downloads", icon: Download },
    { label: isActiveSubscriber(userProfile) ? "Download access" : "Subscription", href: "/account/subscription", icon: Shield },
  ]
}

function getRoleLinks(userProfile: HeaderUserProfile, staffBrief?: StaffBrief | null): HeaderLink[] {
  if (userProfile.role === "PHOTOGRAPHER") {
    return [
      { label: "Contributor dashboard", href: "/contributor/dashboard" },
      { label: "Uploads", href: "/contributor/uploads" },
      { label: "Download reports", href: "/contributor/download-reports" },
    ]
  }

  if (staffBrief) {
    return [
      { label: "Catalog", href: "/staff/catalog" },
      { label: "Users", href: "/staff/users" },
    ]
  }

  return []
}

function isActiveSubscriber(userProfile: HeaderUserProfile) {
  return userProfile.isSubscriber && userProfile.subscriptionStatus === "ACTIVE"
}

function isActivePath(pathname: string, href: string, sortParam: string | null) {
  const normalizedSort = sortParam?.toLowerCase() ?? null

  if (pathname === "/search") {
    if (href === "/search") {
      return normalizedSort !== "latest"
    }
    if (href === "/search?sort=latest") {
      return normalizedSort === "latest"
    }
  }

  const path = href.split("?")[0]
  if (path === "/") return pathname === "/"
  return pathname === path || pathname.startsWith(`${path}/`)
}

function getUserDisplayName(userProfile: HeaderUserProfile | null | undefined, user: { name?: string | null; email?: string | null }) {
  const profileName = userProfile?.displayName?.trim()
  if (profileName) return profileName

  const name = user.name?.trim()
  if (name) return name

  const email = userProfile?.email?.trim() || user.email?.trim()
  if (email) return email

  return "Your account"
}

function getUserInitial(displayName: string) {
  return displayName.trim().charAt(0).toUpperCase() || "U"
}
