// apps/web/src/lib/font.ts
import localFont from "next/font/local";
import { Playfair_Display } from "next/font/google";

export const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-playfair-display",
});

// Brand font
export const monumentGrotesk = localFont({
  src: [
    {
      path: "../../public/fonts/Monument_Grotesk/MonumentGrotesk-Regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/Monument_Grotesk/MonumentGrotesk-Italic.otf",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../public/fonts/Monument_Grotesk/MonumentGrotesk-Medium.otf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/Monument_Grotesk/MonumentGrotesk-MediumItalic.otf",
      weight: "500",
      style: "italic",
    },
    {
      path: "../../public/fonts/Monument_Grotesk/MonumentGrotesk-Bold.otf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../public/fonts/Monument_Grotesk/MonumentGrotesk-BoldItalic.otf",
      weight: "700",
      style: "italic",
    },
    {
      path: "../../public/fonts/Monument_Grotesk/MonumentGrotesk-Mono.otf",
      weight: "450",
      style: "normal",
    },
    {
      path: "../../public/fonts/Monument_Grotesk/MonumentGrotesk-Semi-Mono.otf",
      weight: "550",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-monument-grotesk",
  adjustFontFallback: false,
});
