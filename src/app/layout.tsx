import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/layout/service-worker-register";
import "./globals.css";

// Geist — font kerja Klunting (body / UI / angka). Dipilih buat product &
// data-dense UI: numeral tabular rapi + 0/1 gampang dibedain (krusial buat
// kolom uang), sangat kebaca di ukuran kecil buat layar padat ala Stockbit,
// netral-premium (karakter brand dibawa warna + logo, bukan font). Variable,
// semua weight. Logo Klunting (Plus Jakarta) = aset gambar, gak di-load di sini.
// Var --font-sans-brand dikonsumsi globals.css (--font-sans).
const geistSans = Geist({
  variable: "--font-sans-brand",
  subsets: ["latin"],
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
    // Nyamain kanvas brand baru — chrome browser/PWA nyatu mulus.
    { media: "(prefers-color-scheme: light)", color: "#FAFAFA" },
    { media: "(prefers-color-scheme: dark)", color: "#0F0F14" },
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
    var skin = localStorage.getItem('pwm-skin');
    if (skin === 'mono' || skin === 'terminal' || skin === 'cartoon') {
      document.documentElement.setAttribute('data-skin', skin);
    }
    var stored = localStorage.getItem('pwm-theme');
    var mode = stored === 'light' || stored === 'dark' || stored === 'auto' ? stored : 'auto';
    var resolved = mode === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode;
    if (resolved === 'dark' || skin === 'terminal') document.documentElement.classList.add('dark');
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
      data-skin="cartoon"
      className={`${geistSans.variable} h-full antialiased`}
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
