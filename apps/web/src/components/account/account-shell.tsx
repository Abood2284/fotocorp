import Link from "next/link"
import type { ReactNode } from "react"

const accountLinks = [
  { label: "Overview", href: "/account" },
  { label: "Fotobox", href: "/account/fotobox" },
  { label: "Downloads", href: "/account/downloads" },
  { label: "Subscription", href: "/account/subscription" },
]

export function AccountShell({
  eyebrow = "Account",
  title,
  description,
  children,
}: {
  eyebrow?: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="border-b border-border pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h1>
            {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
          </div>
          <nav aria-label="Account navigation" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
            {accountLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="whitespace-nowrap rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div className="py-8">{children}</div>
    </main>
  )
}
