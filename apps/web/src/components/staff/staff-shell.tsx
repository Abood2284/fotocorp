"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { ChevronUp, ChevronLeft, ChevronRight, LayoutDashboard, LogOut } from "lucide-react"
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
      <main className="flex-1 overflow-y-auto bg-staff-50 p-6 lg:p-8">{children}</main>
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
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={cn("flex shrink-0 flex-col border-r border-staff-200 bg-staff-100 text-staff-950 transition-all duration-300", collapsed ? "w-[72px]" : "w-64")}>
      <div className={cn("flex h-14 shrink-0 items-center border-b border-staff-200 px-4", collapsed ? "justify-center" : "justify-between")}>
        <Link
          href="/staff/dashboard"
          className={cn("flex items-center overflow-hidden transition-all duration-300", collapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100")}
        >
          <Image
            src="/images/fotocorp-logo.svg"
            alt="Fotocorp"
            width={1400}
            height={425}
            className="h-6 w-auto"
            priority
          />
        </Link>
        <button onClick={() => setCollapsed(!collapsed)} className="flex h-8 w-8 items-center justify-center rounded-md text-staff-500 hover:bg-staff-200 hover:text-staff-950 transition-colors">
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3" aria-label="Staff navigation">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                "flex items-center rounded-md text-sm font-medium transition-all duration-200",
                collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
                isActive
                  ? "bg-staff-200 text-staff-950"
                  : "text-staff-600 hover:bg-staff-200/50 hover:text-staff-950"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {!collapsed && <span className="min-w-0 truncate">{label}</span>}
            </Link>
          )
        })}
      </nav>

      <StaffProfileMenu staff={staff} collapsed={collapsed} />
    </aside>
  )
}

function StaffProfileMenu({ staff, collapsed }: { staff: StaffShellStaff, collapsed: boolean }) {
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
    <div className="relative shrink-0 border-t border-staff-200 p-3" ref={rootRef}>
      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute bottom-full z-50 mb-2 overflow-hidden rounded-lg border border-staff-200 bg-white py-1 shadow-lg shadow-black/5",
            collapsed ? "left-14 w-56" : "left-3 right-3"
          )}
        >
          <div className="border-b border-staff-100 px-4 py-3">
            <p className="truncate text-sm font-medium text-staff-950">{displayLabel}</p>
            <p className="truncate text-xs text-staff-500">{staff.username}</p>
            <p className="mt-1 text-xs text-staff-500">{formatStaffRole(staff.role)}</p>
          </div>
          <Link
            href="/staff/dashboard"
            role="menuitem"
            className="flex items-center gap-3 px-4 py-2 text-sm text-staff-700 transition-colors hover:bg-staff-50 hover:text-staff-950"
            onClick={() => setOpen(false)}
          >
            <LayoutDashboard className="h-4 w-4 shrink-0 text-staff-500" aria-hidden />
            Dashboard
          </Link>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-staff-700 transition-colors hover:bg-staff-50 hover:text-staff-950"
            onClick={() => void handleSignOut()}
          >
            <LogOut className="h-4 w-4 shrink-0 text-staff-500" aria-hidden />
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
          "flex w-full items-center rounded-md transition-colors",
          "hover:bg-staff-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          open && "bg-staff-200",
          collapsed ? "justify-center p-2" : "gap-3 px-2 py-2"
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-sm">
          {staff.userInitial}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-staff-950">{displayLabel}</span>
              <span className="block truncate text-xs text-staff-500">{formatStaffRole(staff.role)}</span>
            </span>
            <ChevronUp
              className={cn("h-4 w-4 shrink-0 text-staff-500 transition-transform duration-200", open && "rotate-180")}
              aria-hidden
            />
          </>
        )}
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
