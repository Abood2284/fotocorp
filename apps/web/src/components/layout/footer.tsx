import Link from "next/link"

import { FotocorpLogoLink } from "@/components/layout/fotocorp-logo-link"

interface FooterLink {
  label: string
  href: string
}

const BROWSE_LINKS: FooterLink[] = [
  { label: "Categories", href: "/categories" },
  { label: "Events", href: "/events" },
  { label: "Request access", href: "/request-access" },
  { label: "Apply as a contributor", href: "/apply-contributor" },
]

const COMPANY_LINKS: FooterLink[] = [
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Contact", href: "/contact" },
]

const linkClass =
  "rounded-none text-sm font-medium text-neutral-500 transition-colors hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

const sectionTitleClass =
  "mb-3 font-sans text-sm font-bold uppercase tracking-[0.12em] text-foreground"

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/70 bg-white py-12 text-black md:py-16">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-sm">
            <FotocorpLogoLink imageClassName="h-8 sm:h-9" />
            <p className="mt-4 text-sm leading-6 text-neutral-500">
              Authentic editorial archive — preview watermarked assets, then license clean files when you are ready.
            </p>
          </div>

          <div className="grid flex-1 gap-10 sm:grid-cols-2 lg:max-w-md lg:gap-12 lg:pl-8">
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

        <div className="mt-10 flex flex-col items-center justify-between gap-4 font-sans text-xs text-neutral-500 md:flex-row md:gap-6">
          <p className="text-center md:text-left">
            © {new Date().getFullYear()} Fotocorp. All rights reserved. Authentic editorial archive.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 md:justify-end md:gap-6">
            <Link href="/legal/terms" className="transition-colors hover:text-black">
              Terms of Use
            </Link>
            <Link href="/legal/privacy" className="transition-colors hover:text-black">
              Privacy Policy
            </Link>
            <Link href="/legal/license" className="transition-colors hover:text-black">
              Licensing Agreement
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
