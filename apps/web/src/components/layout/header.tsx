// apps/web/src/components/layout/header.tsx
"use client"

import Link from "next/link"

import { useQueryClient } from "@tanstack/react-query"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react"

import { FotocorpLogoLink } from "@/components/layout/fotocorp-logo-link"
import { authClient } from "@/lib/auth-client"
import { SHARED_AUTH_SESSION_QUERY_KEY, useSharedAuthSession } from "@/lib/use-shared-auth-session"
import { cn } from "@/lib/utils"
import {
  Archive,
  Camera,
  ChevronDown,
  CloudUpload,
  Download,
  Gauge,
  Image,
  Inbox,
  LogOut,
  Menu,
  Shield,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react"

/** Editorial masthead: seamless white canvas, no shadow (design.md). */
const HEADER_SHELL_CLASS =
  "sticky top-0 z-50 w-full bg-background text-foreground"

/** Apercu-role label = Monument Grotesk, uppercase, structural. */
const NAV_LABEL_CLASS = "font-sans text-[11px] font-semibold uppercase tracking-[0.1em]"

/** Square black CTA (button-primary from design.md). */
const PRIMARY_BTN_CLASS =
  "inline-flex items-center justify-center gap-2 border border-primary bg-primary px-5 py-2.5 font-sans text-sm font-bold uppercase tracking-[0.04em] text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

/** Square white outline CTA (button-outline from design.md). */
const OUTLINE_BTN_CLASS =
  "inline-flex items-center justify-center gap-2 border border-foreground bg-background px-5 py-2.5 font-sans text-sm font-bold uppercase tracking-[0.04em] text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

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

interface ShellProps extends HeaderProps {
  pathname: string
  sortParam: string | null
  modeParam: string | null
  tabParam: string | null
  categoryIdParam: string | null
}

/** Browse nav — title case, Getty-inspired hover panels. */
const BROWSE_NAV_TRIGGER_CLASS =
  "flex items-center gap-1 px-3 py-2 font-sans text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

const EDITORIAL_LINKS: HeaderLink[] = [
  { label: "Entertainment", href: "/categories/entertainment" },
  { label: "News", href: "/categories/news" },
  { label: "Fashion", href: "/categories/fashion" },
  { label: "Sports", href: "/categories/sports" },
  { label: "Business", href: "/categories/business" },
  { label: "Retro", href: "/categories/retro" },
  { label: "Royalty Free", href: "/?tab=royalty-free" },
]

type BrowseDropdownId = "editorial" | "video" | "caricature"

const HOVER_CLOSE_DELAY_MS = 150

export function Header({ userProfile, staffBrief }: HeaderProps) {
  return (
    <Suspense fallback={<HeaderStatic userProfile={userProfile} staffBrief={staffBrief} />}>
      <HeaderContent userProfile={userProfile} staffBrief={staffBrief} />
    </Suspense>
  )
}

function HeaderContent({ userProfile, staffBrief }: HeaderProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (
    <HeaderShell
      userProfile={userProfile}
      staffBrief={staffBrief}
      pathname={pathname}
      sortParam={searchParams.get("sort")}
      modeParam={searchParams.get("mode")}
      tabParam={searchParams.get("tab")}
      categoryIdParam={searchParams.get("categoryId") ?? searchParams.get("category")}
    />
  )
}

function HeaderStatic({ userProfile, staffBrief }: HeaderProps) {
  return (
    <HeaderShell
      userProfile={userProfile}
      staffBrief={staffBrief}
      pathname="/"
      sortParam={null}
      modeParam={null}
      tabParam={null}
      categoryIdParam={null}
    />
  )
}

function HeaderShell({
  userProfile,
  staffBrief,
  pathname,
  sortParam,
  modeParam,
  tabParam,
  categoryIdParam,
}: ShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<BrowseDropdownId | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false)
        setOpenDropdown(null)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  function scheduleCloseDropdown() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = setTimeout(() => setOpenDropdown(null), HOVER_CLOSE_DELAY_MS)
  }

  function cancelCloseDropdown() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  function openBrowseDropdown(id: BrowseDropdownId) {
    cancelCloseDropdown()
    setOpenDropdown(id)
  }

  const editorialActive = isEditorialNavActive(pathname, categoryIdParam)
  const royaltyFreeActive = isRoyaltyFreeNavActive(pathname, tabParam)

  return (
    <header
      className={cn(HEADER_SHELL_CLASS, "relative")}
      onMouseLeave={() => scheduleCloseDropdown()}
    >
      <div className="mx-auto flex w-full max-w-[1600px] items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 lg:px-8">
        <FotocorpLogoLink className="pr-1" priority />

        <nav
          className="hidden min-w-0 flex-1 items-center lg:flex"
          aria-label="Primary navigation"
        >
          <BrowseNavTrigger
            label="Editorial"
            active={editorialActive}
            expanded={openDropdown === "editorial"}
            onOpen={() => openBrowseDropdown("editorial")}
            onCloseSchedule={scheduleCloseDropdown}
            onCloseCancel={cancelCloseDropdown}
          />
          <BrowseNavTrigger
            label="Video"
            active={false}
            expanded={openDropdown === "video"}
            onOpen={() => openBrowseDropdown("video")}
            onCloseSchedule={scheduleCloseDropdown}
            onCloseCancel={cancelCloseDropdown}
          />
          <BrowseNavTrigger
            label="Caricature"
            active={false}
            expanded={openDropdown === "caricature"}
            onOpen={() => openBrowseDropdown("caricature")}
            onCloseSchedule={scheduleCloseDropdown}
            onCloseCancel={cancelCloseDropdown}
          />
          <BrowseNavLink
            label="Royalty Free"
            href="/?tab=royalty-free"
            active={royaltyFreeActive}
          />
          <RoleMainLinks
            userProfile={userProfile}
            staffBrief={staffBrief}
            pathname={pathname}
            sortParam={sortParam}
            modeParam={modeParam}
          />
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-4 sm:gap-6">
          <Link
            href="/fotobox"
            className={cn(
              NAV_LABEL_CLASS,
              "hidden items-center gap-2 text-muted-foreground transition-colors hover:text-foreground lg:flex",
            )}
          >
            <Archive size={14} />
            Fotobox
          </Link>

          <div className="hidden lg:flex">
            <AccountMenu userProfile={userProfile} staffBrief={staffBrief} />
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            className="inline-flex h-10 w-10 items-center justify-center border border-border text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-panel"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {openDropdown === "editorial" && (
        <BrowseDropdownPanel onMouseEnter={cancelCloseDropdown} onMouseLeave={scheduleCloseDropdown}>
          <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
            <h2 className="font-heading text-lg font-normal text-foreground">Editorial</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Licensed news photography across entertainment, sports, fashion, and archive coverage.
            </p>
            <ul className="mt-4 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {EDITORIAL_LINKS.map((link) => (
                <li key={link.href + link.label}>
                  <Link
                    href={link.href}
                    className="block px-2 py-2 font-sans text-sm font-medium text-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </BrowseDropdownPanel>
      )}

      {openDropdown === "video" && (
        <BrowseDropdownPanel onMouseEnter={cancelCloseDropdown} onMouseLeave={scheduleCloseDropdown}>
          <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
            <h2 className="font-heading text-lg font-normal text-foreground">Video</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Video licensing is coming soon.</p>
          </div>
        </BrowseDropdownPanel>
      )}

      {openDropdown === "caricature" && (
        <BrowseDropdownPanel onMouseEnter={cancelCloseDropdown} onMouseLeave={scheduleCloseDropdown}>
          <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
            <h2 className="font-heading text-lg font-normal text-foreground">Caricature</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Caricature licensing is coming soon.</p>
          </div>
        </BrowseDropdownPanel>
      )}

      {/* Mobile panel */}
      <div
        id="mobile-nav-panel"
        className={cn(
          "overflow-hidden border-t border-border bg-background transition-all duration-200 lg:hidden",
          mobileOpen
            ? "max-h-[calc(100vh-4rem)] overflow-y-auto opacity-100"
            : "pointer-events-none max-h-0 opacity-0",
        )}
      >
        <nav
          className="mx-auto grid max-w-[1600px] gap-6 px-4 py-5 sm:px-6"
          aria-label="Mobile navigation"
        >
          <MobileBrowseNav pathname={pathname} tabParam={tabParam} />
          <MobileRoleLinks
            userProfile={userProfile}
            staffBrief={staffBrief}
            pathname={pathname}
            sortParam={sortParam}
            modeParam={modeParam}
          />
          <MobileAccountMenu userProfile={userProfile} staffBrief={staffBrief} />
        </nav>
      </div>
    </header>
  )
}

function BrowseNavLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        BROWSE_NAV_TRIGGER_CLASS,
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {label}
    </Link>
  )
}

function BrowseNavTrigger({
  label,
  active,
  expanded,
  onOpen,
  onCloseSchedule,
  onCloseCancel,
}: {
  label: string
  active: boolean
  expanded: boolean
  onOpen: () => void
  onCloseSchedule: () => void
  onCloseCancel: () => void
}) {
  return (
    <div
      onMouseEnter={() => {
        onCloseCancel()
        onOpen()
      }}
      onMouseLeave={onCloseSchedule}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-haspopup="true"
        className={cn(
          BROWSE_NAV_TRIGGER_CLASS,
          active || expanded ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <ChevronDown
          size={14}
          className={cn("text-muted-foreground transition-transform", expanded && "rotate-180")}
        />
      </button>
    </div>
  )
}

function BrowseDropdownPanel({
  children,
  onMouseEnter,
  onMouseLeave,
}: {
  children: ReactNode
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  return (
    <div
      className="absolute left-0 right-0 top-full z-40 hidden border-t border-border bg-background lg:block"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  )
}

function MobileBrowseNav({ pathname, tabParam }: { pathname: string; tabParam: string | null }) {
  const royaltyFreeActive = isRoyaltyFreeNavActive(pathname, tabParam)

  return (
    <section>
      <h2 className="mb-2 font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Browse</h2>
      <div className="grid gap-4">
        <div>
          <h3 className="mb-1 px-3 font-sans text-xs font-semibold uppercase tracking-wider text-foreground">Editorial</h3>
          <div className="grid gap-1">
            {EDITORIAL_LINKS.map((link) => (
              <MobileNavLink
                key={link.href + link.label}
                link={link}
                pathname={pathname}
                sortParam={null}
                modeParam={null}
              />
            ))}
          </div>
        </div>
        <div className="grid gap-1">
          <span className="border-l-2 border-transparent px-3 py-2 font-sans text-xs font-medium text-muted-foreground/50">
            Video — Coming soon
          </span>
          <span className="border-l-2 border-transparent px-3 py-2 font-sans text-xs font-medium text-muted-foreground/50">
            Caricature — Coming soon
          </span>
          <Link
            href="/?tab=royalty-free"
            aria-current={royaltyFreeActive ? "page" : undefined}
            className={cn(
              "border-l-2 px-3 py-2 font-sans text-xs font-medium transition-colors hover:bg-secondary hover:text-foreground",
              royaltyFreeActive ? "border-foreground bg-secondary text-foreground" : "border-transparent text-muted-foreground",
            )}
          >
            Royalty Free
          </Link>
        </div>
      </div>
    </section>
  )
}

function SectionNavLink({
  link,
  pathname,
  sortParam,
  modeParam,
}: {
  link: HeaderLink
  pathname: string
  sortParam: string | null
  modeParam: string | null
}) {
  const active = isActivePath(pathname, link.href, sortParam, modeParam)

  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        NAV_LABEL_CLASS,
        "flex items-center px-2.5 py-2 transition-colors hover:text-foreground",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {link.label}
    </Link>
  )
}

function RoleMainLinks({
  staffBrief,
  pathname,
  sortParam,
  modeParam,
}: {
  userProfile?: HeaderUserProfile | null
  staffBrief?: StaffBrief | null
  pathname: string
  sortParam: string | null
  modeParam: string | null
}) {
  if (!staffBrief) return null

  return (
    <SectionNavLink
      link={{ label: "Staff", href: "/staff/dashboard" }}
      pathname={pathname}
      sortParam={sortParam}
      modeParam={modeParam}
    />
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
  const queryClient = useQueryClient()
  const { data: session, isPending } = useSharedAuthSession()
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
    queryClient.setQueryData(SHARED_AUTH_SESSION_QUERY_KEY, null)
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
    return <div className="h-10 w-32 bg-muted" aria-hidden />
  }

  if (!user) {
    if (staffBrief) {
      const staffLabel = staffBrief.displayName.trim() || staffBrief.username
      return (
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex h-10 max-w-56 items-center gap-2 border border-border bg-background px-2 pr-3 font-sans text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={open}
            aria-haspopup="menu"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
              {getUserInitial(staffLabel)}
            </span>
            <span className="truncate">{staffLabel}</span>
            <ChevronDown className={cn("text-muted-foreground transition-transform", open && "rotate-180")} size={16} />
          </button>
          {open && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-2 w-72 border border-border bg-background p-2"
            >
              <div className="border-b border-border px-3 py-2">
                <p className="truncate font-sans text-sm font-semibold text-foreground">{staffLabel}</p>
                <p className="truncate font-sans text-xs text-muted-foreground">Staff · {staffBrief.role}</p>
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
                  className="flex items-center gap-2 px-3 py-2 font-sans text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  <UserRound className="h-4 w-4" />
                  Customer sign in
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleStaffSignOut()}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left font-sans text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <LogOut size={16} />
                  Staff sign out
                </button>
              </div>
            </div>
          )}
        </div>
      )
    }

    return (
      <Link href="/sign-in" className={cn(PRIMARY_BTN_CLASS, "px-6 py-2")}>
        Sign In
      </Link>
    )
  }

  const displayName = getUserDisplayName(userProfile, user)
  const menuItems = getAccountLinks(userProfile, staffBrief)

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 max-w-56 items-center gap-2 border border-border bg-background px-2 pr-3 font-sans text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
          {getUserInitial(displayName)}
        </span>
        <span className="truncate">{displayName}</span>
        <ChevronDown className={cn("text-muted-foreground transition-transform", open && "rotate-180")} size={16} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-72 border border-border bg-background p-2"
        >
          <div className="border-b border-border px-3 py-2">
            <p className="truncate font-sans text-sm font-semibold text-foreground">{displayName}</p>
            <p className="truncate font-sans text-xs text-muted-foreground">{userProfile?.email ?? user.email}</p>
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
              className="flex w-full items-center gap-2 px-3 py-2 text-left font-sans text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <LogOut size={16} />
              Staff sign out
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 px-3 py-2 text-left font-sans text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut size={16} />
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
  modeParam,
}: {
  group: { title: string; links: HeaderLink[] }
  pathname: string
  sortParam: string | null
  modeParam: string | null
}) {
  return (
    <section>
      <h2 className="mb-2 font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{group.title}</h2>
      <div className="grid gap-1">
        {group.links.map((link) => (
          <MobileNavLink key={link.href + link.label} link={link} pathname={pathname} sortParam={sortParam} modeParam={modeParam} />
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
  modeParam,
}: {
  userProfile?: HeaderUserProfile | null
  staffBrief?: StaffBrief | null
  pathname: string
  sortParam: string | null
  modeParam: string | null
}) {
  const staffRoleLinks = staffBrief ? getStaffRoleLinks() : []

  if (!userProfile) {
    if (staffRoleLinks.length === 0) return null
    return (
      <MobileLinkGroup group={{ title: "Staff", links: staffRoleLinks }} pathname={pathname} sortParam={sortParam} modeParam={modeParam} />
    )
  }

  const roleLinks = getRoleLinks(userProfile, staffBrief)
  const subscriber = isActiveSubscriber(userProfile)
  const accountLinks: HeaderLink[] = [
    { label: "My account", href: "/account" },
    { label: "Fotobox", href: "/fotobox" },
    subscriber ? { label: "Downloads", href: "/account/downloads" } : { label: "Subscription", href: "/account/subscription" },
  ]

  return (
    <>
      <MobileLinkGroup group={{ title: "Account", links: accountLinks }} pathname={pathname} sortParam={sortParam} modeParam={modeParam} />
      {staffRoleLinks.length > 0 && (
        <MobileLinkGroup group={{ title: "Staff", links: staffRoleLinks }} pathname={pathname} sortParam={sortParam} modeParam={modeParam} />
      )}
      {roleLinks.length > 0 && (
        <MobileLinkGroup
          group={{
            title: userProfile.role === "PHOTOGRAPHER" ? "Contributor" : "Workspace",
            links: roleLinks,
          }}
          pathname={pathname}
          sortParam={sortParam}
          modeParam={modeParam}
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
  const queryClient = useQueryClient()
  const { data: session, isPending } = useSharedAuthSession()
  const user = session?.user

  async function handleSignOut() {
    await authClient.signOut()
    queryClient.setQueryData(SHARED_AUTH_SESSION_QUERY_KEY, null)
    router.push("/sign-in")
    router.refresh()
  }

  async function handleStaffSignOut() {
    await fetch("/api/staff/auth/logout", { method: "POST", credentials: "include" })
    router.refresh()
  }

  if (isPending) {
    return <div className="h-16 bg-muted" aria-hidden />
  }

  if (!user) {
    if (staffBrief) {
      const staffLabel = staffBrief.displayName.trim() || staffBrief.username
      return (
        <section className="border border-border bg-secondary p-3">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
              {getUserInitial(staffLabel)}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-sans text-sm font-semibold text-foreground">{staffLabel}</span>
              <span className="block truncate font-sans text-xs text-muted-foreground">Staff session</span>
            </span>
          </div>
          <div className="grid gap-2">
            <Link href="/staff/dashboard" className={cn(OUTLINE_BTN_CLASS, "w-full")}>
              Staff dashboard
            </Link>
            <button type="button" onClick={() => void handleStaffSignOut()} className={cn(OUTLINE_BTN_CLASS, "w-full text-muted-foreground")}>
              <LogOut size={16} />
              Staff sign out
            </button>
            <Link href="/sign-in" className={cn(PRIMARY_BTN_CLASS, "w-full")}>
              Customer sign in
            </Link>
          </div>
        </section>
      )
    }

    return (
      <section>
        <h2 className="mb-2 font-sans text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Account</h2>
        <Link href="/sign-in" className={cn(PRIMARY_BTN_CLASS, "w-full")}>
          Sign In
        </Link>
      </section>
    )
  }

  const displayName = getUserDisplayName(userProfile, user)

  return (
    <section className="border border-border bg-secondary p-3">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
          {getUserInitial(displayName)}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-sans text-sm font-semibold text-foreground">{displayName}</span>
          <span className="block truncate font-sans text-xs text-muted-foreground">{userProfile?.email ?? user.email}</span>
        </span>
      </div>
      <div className="grid gap-2">
        {staffBrief ? (
          <button type="button" onClick={() => void handleStaffSignOut()} className={cn(OUTLINE_BTN_CLASS, "w-full text-muted-foreground")}>
            <LogOut size={16} />
            Staff sign out
          </button>
        ) : null}
        <button type="button" onClick={handleSignOut} className={cn(OUTLINE_BTN_CLASS, "w-full text-muted-foreground")}>
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </section>
  )
}

function MobileNavLink({
  link,
  pathname,
  sortParam,
  modeParam,
}: {
  link: HeaderLink
  pathname: string
  sortParam: string | null
  modeParam: string | null
}) {
  const active = isActivePath(pathname, link.href, sortParam, modeParam)

  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "border-l-2 px-3 py-2 font-sans text-xs font-medium transition-colors hover:bg-secondary hover:text-foreground",
        active ? "border-foreground bg-secondary text-foreground" : "border-transparent text-muted-foreground",
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
      className="flex items-center gap-2 px-3 py-2 font-sans text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
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
      { label: "Uploads", href: "/contributor/uploads", icon: CloudUpload },
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

function isEditorialNavActive(pathname: string, categoryIdParam: string | null) {
  if (pathname === "/search" && categoryIdParam) return true
  if (pathname.startsWith("/categories/")) return true
  return false
}

function isRoyaltyFreeNavActive(pathname: string, tabParam: string | null) {
  return pathname === "/" && tabParam?.toLowerCase() === "royalty-free"
}

function isActivePath(pathname: string, href: string, sortParam: string | null, modeParam: string | null) {
  const normalizedSort = sortParam?.toLowerCase() ?? null
  const normalizedMode = modeParam?.toLowerCase() ?? null

  if (pathname === "/search") {
    if (href === "/search?mode=events") {
      return normalizedMode === "events"
    }
    if (href === "/search") {
      return normalizedMode !== "events"
    }
    if (href === "/search?sort=latest") {
      return normalizedMode !== "events" && normalizedSort === "latest"
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
