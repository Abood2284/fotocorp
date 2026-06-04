import type { ReactNode } from "react"

export function AccountSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="border border-border bg-background">
      <header className="border-b border-border px-5 py-4 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </header>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  )
}

export function AccountStoryLink({
  href,
  title,
  description,
}: {
  href: string
  title: string
  description: string
}) {
  return (
    <a
      href={href}
      className="group block border-b border-border px-5 py-4 transition-colors last:border-b-0 hover:bg-secondary/60 sm:px-6"
    >
      <p className="text-sm font-bold text-foreground group-hover:underline underline-offset-4">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
    </a>
  )
}
