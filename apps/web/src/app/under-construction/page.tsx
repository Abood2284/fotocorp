import type { Metadata } from "next"
import Image from "next/image"

export const metadata: Metadata = {
  title: "Coming soon — Fotocorp",
  description: "Fotocorp is being prepared. We are building something better for you.",
  robots: { index: false, follow: false },
}

export default function UnderConstructionPage() {
  return (
    <ConstructionPageShell>
      <div className="relative z-10 flex w-full max-w-lg flex-col items-center text-center">
        <Image
          src="/images/fotocorp-logo.svg"
          alt="Fotocorp"
          width={1400}
          height={425}
          priority
          className="mb-10 h-8 w-auto sm:h-9"
        />

        <p className="mb-3 font-serif text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
          Something better is on the way
        </p>

        <p className="max-w-md text-base leading-relaxed text-muted-foreground">
          We are putting the finishing touches on a new Fotocorp experience for newsrooms,
          publishers, and creators. Check back soon.
        </p>

        <div
          className="mt-10 h-px w-16 bg-border"
          aria-hidden
        />

        <p className="mt-8 text-sm text-foreground-caption">
          &copy; {new Date().getFullYear()} Fotocorp. All rights reserved.
        </p>
      </div>
    </ConstructionPageShell>
  )
}

function ConstructionPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_75%_40%,rgba(192,124,10,0.06)_0%,transparent_65%),radial-gradient(ellipse_50%_45%_at_12%_88%,rgba(26,37,64,0.07)_0%,transparent_60%)]"
      />
      {children}
    </div>
  )
}
