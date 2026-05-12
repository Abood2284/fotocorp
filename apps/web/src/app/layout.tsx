import type { Metadata } from "next"
import { AppProviders } from "@/components/providers/app-providers"
import { monumentGrotesk, playfairDisplay } from "@/lib/font"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "Fotocorp — Premium Stock Photography",
    template: "%s — Fotocorp",
  },
  description:
    "Millions of royalty-free stock photos, vectors and illustrations for creators, brands and teams.",
  metadataBase: new URL("https://fotocorp.app"),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${monumentGrotesk.variable} ${playfairDisplay.variable}`}
    >
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
