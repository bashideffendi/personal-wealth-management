import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/layout/service-worker-register";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans-brand",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-brand",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Instrument Serif — used sparingly for "moments of personality" per
// design handoff. Italic only. Examples: net-worth hero number,
// landing headline, milestone modals. Never for body or buttons.
const instrumentSerif = Instrument_Serif({
  variable: "--font-display-brand",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
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
    default: "Klunting — Wealth Management App",
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
    title: "Klunting — Wealth Management App",
    description:
      "Catat pendapatan, pengeluaran, aset, utang, dan investasi — pakai AI biar cepat.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Klunting — Wealth Management App",
    description:
      "Catat pendapatan, pengeluaran, aset, utang, dan investasi — pakai AI biar cepat.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#10B981" },
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
      className={`${plusJakartaSans.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} h-full antialiased`}
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
