import Link from "next/link"
import { ArrowRight } from "lucide-react"

interface PlaceholderPageProps {
  eyebrow?: string
  title: string
  description: string
  actions?: Array<{ label: string; href: string }>
}

export function PlaceholderPage({
  eyebrow,
  title,
  description,
  actions = [
    { label: "Search archive", href: "/search" },
    { label: "Contact us", href: "/contact" },
  ],
}: PlaceholderPageProps) {
  return (
    <section className="mx-auto flex min-h-[60vh] w-full max-w-5xl flex-col justify-center px-4 py-20 sm:px-6 lg:px-8">
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {eyebrow}
        </p>
      )}
      <h1 className="fc-display mt-3 max-w-3xl text-4xl leading-tight tracking-tight text-foreground sm:text-5xl">
        {title}
      </h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
        {description}
      </p>
      {actions.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-3">
          {actions.map((action, index) => (
            <Link
              key={action.href}
              href={action.href}
              className={
                index === 0
                  ? "inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
                  : "inline-flex h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              }
            >
              {action.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
