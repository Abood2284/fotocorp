"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Camera, ChevronRight, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { staffNavItemsForRole } from "@/lib/staff/staff-navigation"

interface StaffShellProps {
  children: React.ReactNode
  userInitial: string
  staffRole: string
}

export function StaffShell({ children, userInitial, staffRole }: StaffShellProps) {
  const navItems = staffNavItemsForRole(staffRole)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar navItems={navItems} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center border-b border-border bg-background px-6">
          <h1 className="fc-label text-muted-foreground">Staff console</h1>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
              {userInitial}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6">{children}</main>
      </div>
    </div>
  )
}

function Sidebar({
  navItems,
}: {
  navItems: ReturnType<typeof staffNavItemsForRole>
}) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    await fetch("/api/staff/auth/logout", { method: "POST", credentials: "include" })
    router.push("/staff/login")
    router.refresh()
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <Camera className="h-5 w-5 text-accent" />
        <span className="fc-brand font-semibold text-lg">
          foto<span className="text-accent">corp</span>
        </span>
        <span className="fc-caption ml-auto rounded border border-border px-1.5 py-0.5 font-semibold uppercase tracking-widest text-muted-foreground">
          Staff
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Staff navigation">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "fc-label flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
              {isActive && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-50" />}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={handleSignOut}
          className="fc-label flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
