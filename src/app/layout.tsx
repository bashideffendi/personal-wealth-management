import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/layout/service-worker-register";
import "./globals.css";

// Calm Premium typography — ONE typeface across the entire product.
// Inter: hyper-readable, premium-neutral (Linear, Stripe, Copilot Money).
// Headings, body, and tabular numbers all use Inter — consistency over
// novelty. No separate mono or serif (dropped Plus Jakarta / JetBrains /
// Instrument Serif). Variable font, so every weight is available.
const inter = Inter({
  variable: "--font-sans-brand",
  subsets: ["latin"],
  display: "swap",
});

// Instrument Serif (italic) — "moments of personality" ONLY. Called inline via
// var(--font-instrument-serif) on a handful of landing/auth phrases. Deliberately
// NOT wired to --font-display / --font-mono (those stay Inter app-wide → zero
// dashboard regression). Body stays Inter too.
const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: "italic",
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const metadata: Metadata = {
  // Canonical base URL — used by Next.js to resolve absolute URLs for
  // OpenGraph, Twitter cards, sitemap, robots.txt, etc. Override locally
  // by setting NEXT_PUBLIC_SITE_URL (preview deploys etc).
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://klunting.com",
  ),
  title: {
    default: "Klunting — Atur uang tanpa drama",
    template: "%s · Klunting",
  },
  description:
    "Catat pendapatan, pengeluaran, aset, utang, dan investasi — pakai AI biar cepat.",
  applicationName: "Klunting",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    // 'black-translucent' makes the iOS status bar overlay the app — feels native
    statusBarStyle: "black-translucent",
    title: "Klunting",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "https://klunting.com",
    siteName: "Klunting",
    title: "Klunting — Atur uang tanpa drama",
    description:
      "Catat pendapatan, pengeluaran, aset, utang, dan investasi — pakai AI biar cepat.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Klunting — Atur uang tanpa drama",
    description:
      "Catat pendapatan, pengeluaran, aset, utang, dan investasi — pakai AI biar cepat.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF9" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0F" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover", // for iPhone notch / safe areas
};

// Inline script to set dark class BEFORE first paint, preventing FOUC.
// Reads localStorage 'pwm-theme' (light/dark/auto) and matches system preference.
const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('pwm-theme');
    var mode = stored === 'light' || stored === 'dark' || stored === 'auto' ? stored : 'auto';
    var resolved = mode === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode;
    if (resolved === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${instrumentSerif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
