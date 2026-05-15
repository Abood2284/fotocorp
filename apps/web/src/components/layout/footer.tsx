import Link from "next/link"
import { Archive, Camera } from "lucide-react"

interface FooterLink {
  label: string
  href: string
}

/** Primary bar — matches desktop nav in `header.tsx` */
const EXPLORE_LINKS: FooterLink[] = [
  { label: "Creative", href: "/search" },
  { label: "Editorial", href: "/search?sort=latest" },
  { label: "Video", href: "/video" },
  { label: "Collections", href: "/categories" },
  { label: "Request access", href: "/request-access" },
]

/** Matches `MOBILE_GROUPS` Browse in `header.tsx`. */
const BROWSE_LINKS: FooterLink[] = [
  { label: "Search", href: "/search" },
  { label: "Latest", href: "/search?sort=latest" },
  { label: "Categories", href: "/categories" },
  { label: "Events", href: "/events" },
  { label: "Request access", href: "/request-access" },
]

/** Matches `MOBILE_GROUPS` Company in `header.tsx`. */
const COMPANY_LINKS: FooterLink[] = [
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Contact", href: "/contact" },
]

const linkClass =
  "rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

const sectionTitleClass =
  "mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/70 bg-background/95 text-foreground backdrop-blur supports-backdrop-filter:bg-background/88">
      <div className="mx-auto max-w-[1600px] px-4 py-12 sm:px-6 lg:px-8 lg:py-14">
        <div className="flex flex-col gap-10 border-b border-border/70 pb-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-sm">
            <Link
              href="/"
              className="fc-brand inline-flex items-center gap-2 rounded-md py-1 font-semibold tracking-tight transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Fotocorp home"
            >
              <Camera className="h-8 w-8 text-primary" />
              <span className="text-2xl">
                foto<span className="text-accent">corp</span>
              </span>
            </Link>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Authentic editorial archive — preview watermarked assets, then license clean files when you are ready.
            </p>
            <Link
              href="/account/fotobox"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-muted-foreground"
            >
              <Archive className="h-5 w-5 shrink-0" />
              Fotobox
            </Link>
          </div>

          <div className="grid flex-1 gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-12 lg:pl-8">
            <nav aria-label="Explore">
              <h2 className={sectionTitleClass}>Explore</h2>
              <ul className="grid gap-2">
                {EXPLORE_LINKS.map((item) => (
                  <li key={item.href + item.label}>
                    <Link href={item.href} className={linkClass}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Browse">
              <h2 className={sectionTitleClass}>Browse</h2>
              <ul className="grid gap-2">
                {BROWSE_LINKS.map((item) => (
                  <li key={item.href + item.label}>
                    <Link href={item.href} className={linkClass}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Company">
              <h2 className={sectionTitleClass}>Company</h2>
              <ul className="grid gap-2">
                {COMPANY_LINKS.map((item) => (
                  <li key={item.href + item.label}>
                    <Link href={item.href} className={linkClass}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 pt-8 text-sm text-muted-foreground md:flex-row md:gap-6">
          <p className="text-center md:text-left">
            © {new Date().getFullYear()} Fotocorp. All rights reserved. Authentic editorial archive.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 md:justify-end md:gap-6">
            <Link href="/sitemap" className="font-medium transition-colors hover:text-foreground">
              Sitemap
            </Link>
            <Link href="/report" className="font-medium transition-colors hover:text-foreground">
              Report image / Takedown
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
