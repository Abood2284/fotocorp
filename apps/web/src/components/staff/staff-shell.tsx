"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Camera, ChevronUp, LayoutDashboard, LogOut } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { staffNavItemsForRole } from "@/lib/staff/staff-navigation"

interface StaffShellStaff {
  displayName: string
  username: string
  role: string
  userInitial: string
}

interface StaffShellProps {
  children: ReactNode
  staff: StaffShellStaff
}

export function StaffShell({ children, staff }: StaffShellProps) {
  const navItems = staffNavItemsForRole(staff.role)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar navItems={navItems} staff={staff} />
      <main className="flex-1 overflow-y-auto bg-muted/30 p-6">{children}</main>
    </div>
  )
}

function Sidebar({
  navItems,
  staff,
}: {
  navItems: ReturnType<typeof staffNavItemsForRole>
  staff: StaffShellStaff
}) {
  const pathname = usePathname()

  return (
    <aside className="flex w-36 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-2">
        <Camera className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
        <span className="fc-brand min-w-0 truncate text-xs font-semibold leading-none">
          foto<span className="text-accent">corp</span>
        </span>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-1.5" aria-label="Staff navigation">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[0.65rem] font-medium leading-tight transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-3 w-3 shrink-0" aria-hidden />
              <span className="min-w-0 truncate">{label}</span>
            </Link>
          )
        })}
      </nav>

      <StaffProfileMenu staff={staff} />
    </aside>
  )
}

function StaffProfileMenu({ staff }: { staff: StaffShellStaff }) {
  const router = useRouter()
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

  async function handleSignOut() {
    setOpen(false)
    await fetch("/api/staff/auth/logout", { method: "POST", credentials: "include" })
    router.push("/staff/login")
    router.refresh()
  }

  const displayLabel = staff.displayName.trim() || staff.username

  return (
    <div className="relative shrink-0 border-t border-border p-1.5" ref={rootRef}>
      {open ? (
        <div
          role="menu"
          className="absolute bottom-full left-1.5 right-1.5 z-50 mb-1 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-xs font-medium text-foreground">{displayLabel}</p>
            <p className="truncate text-[0.65rem] text-muted-foreground">{staff.username}</p>
            <p className="mt-1 text-[0.65rem] text-muted-foreground">{formatStaffRole(staff.role)}</p>
          </div>
          <Link
            href="/staff/dashboard"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            <LayoutDashboard className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            Dashboard
          </Link>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-muted"
            onClick={() => void handleSignOut()}
          >
            <LogOut className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            Sign out
          </button>
        </div>
      ) : null}

      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left transition-colors",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "bg-muted",
        )}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[0.6rem] font-semibold text-primary-foreground">
          {staff.userInitial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.65rem] font-medium leading-tight text-foreground">{displayLabel}</span>
          <span className="block truncate text-[0.6rem] leading-tight text-muted-foreground">{formatStaffRole(staff.role)}</span>
        </span>
        <ChevronUp
          className={cn("h-3 w-3 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
    </div>
  )
}

function formatStaffRole(role: string) {
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
