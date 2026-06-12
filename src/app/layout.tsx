import type { Metadata, Viewport } from "next";
import { Baloo_2, Instrument_Sans, Instrument_Serif } from "next/font/google";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/layout/service-worker-register";
import "./globals.css";

// Keluarga Instrument — SATU keluarga huruf untuk seluruh produk.
// Instrument Sans (grotesque hangat, satu proyek dengan Instrument Serif):
// body, UI, dan angka tabular (.num pakai fitur tnum — diverifikasi empiris).
// Pasangan sans+serif satu foundry = sistem tipografi yang nyambung, bukan
// dua font asing dijodohkan. Variable font, semua weight tersedia.
const instrumentSans = Instrument_Sans({
  variable: "--font-sans-brand",
  subsets: ["latin"],
  display: "swap",
});

// Instrument Serif (italic) — momen personality: judul halaman/dialog via
// --font-display + frasa landing/auth via var(--font-instrument-serif).
// Angka & body TETAP sans — serif cuma buat kata, jangan buat data.
const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: "italic",
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
});

// Baloo 2 — suara display tema Cartoon Quest (judul, dialog, tombol).
// Chubby rounded khas game UI. HANYA buat kata — angka tetap Instrument
// Sans tabular di semua tema.
const baloo = Baloo_2({
  subsets: ["latin"],
  variable: "--font-baloo",
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
    // Nyamain kanvas v6 (Volt & Ink) — chrome browser/PWA nyatu mulus.
    { media: "(prefers-color-scheme: light)", color: "#FFF9EE" },
    { media: "(prefers-color-scheme: dark)", color: "#241F31" },
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
      className={`${instrumentSans.variable} ${instrumentSerif.variable} ${baloo.variable} h-full antialiased`}
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
