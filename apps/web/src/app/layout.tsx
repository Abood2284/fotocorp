import type { Metadata } from "next"
import Script from "next/script"
import { AppProviders } from "@/components/providers/app-providers"
import { monumentGrotesk, playfairDisplay, lora } from "@/lib/font"
import "./globals.css"

const GA_MEASUREMENT_ID = "G-9M86R56XTW"

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
        <script async src="https://t.contentsquare.net/uxa/3c3516e8b89cf.js" />
      </head>
      <body className="antialiased">
        <AppProviders>{children}</AppProviders>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
      </body>
    </html>
  )
}
