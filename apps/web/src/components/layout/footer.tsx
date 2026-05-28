import Link from "next/link"

import { FotocorpLogoLink } from "@/components/layout/fotocorp-logo-link"

interface FooterLink {
  label: string
  href: string
}

/** Primary bar — matches desktop nav in `header.tsx` */
const EXPLORE_LINKS: FooterLink[] = [
  { label: "Creative", href: "/search" },
  { label: "Editorial", href: "/search?sort=latest" },
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
  "rounded-none text-sm font-medium text-neutral-500 transition-colors hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

const sectionTitleClass =
  "mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500 font-sans"

export function Footer() {
  return (
    <footer className="mt-auto bg-white text-black border-t border-border/70 py-12 md:py-16">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 border-b border-border/70 pb-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-sm">
            <FotocorpLogoLink imageClassName="h-8 sm:h-9" />
            <p className="mt-4 text-sm leading-6 text-neutral-500">
              Authentic editorial archive — preview watermarked assets, then license clean files when you are ready.
            </p>
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

        <div className="flex flex-col items-center justify-between gap-4 pt-8 text-xs text-neutral-500 md:flex-row md:gap-6 font-sans">
          <p className="text-center md:text-left">
            © {new Date().getFullYear()} Fotocorp. All rights reserved. Authentic editorial archive.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 md:justify-end md:gap-6">
            <Link href="/legal/terms" className="hover:text-black transition-colors">
              Terms of Use
            </Link>
            <Link href="/legal/privacy" className="hover:text-white hover:text-black transition-colors">
              Privacy Policy
            </Link>
            <Link href="/legal/license" className="hover:text-white hover:text-black transition-colors">
              Licensing Agreement
            </Link>
            <span className="text-neutral-200">|</span>
            <Link href="/sitemap" className="hover:text-black transition-colors">
              Sitemap
            </Link>
            <Link href="/report" className="hover:text-black transition-colors">
              Report image / Takedown
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
