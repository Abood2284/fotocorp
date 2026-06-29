import type { Metadata } from "next"
import { AppProviders } from "@/components/providers/app-providers"
import { monumentGrotesk, playfairDisplay, lora } from "@/lib/font"
import "./globals.css"

const siteTitle = "Fotocorp — India's Premier News Photo Agency"
const siteDescription =
  "India's foremost news photo agency. Pan-India editorial, celebrity, sports, and archive images. Based in Mumbai."

export const metadata: Metadata = {
  title: {
    default: siteTitle,
    template: "%s — Fotocorp",
  },
  description: siteDescription,
  metadataBase: new URL("https://fotocorp.app"),
  applicationName: "Fotocorp",
  openGraph: {
    type: "website",
    siteName: "Fotocorp",
    title: siteTitle,
    description: siteDescription,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${monumentGrotesk.variable} ${playfairDisplay.variable} ${lora.variable}`}
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
