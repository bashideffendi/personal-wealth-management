import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // External logo sources used by CryptoLogo + future avatar fetchers.
    // CORS is open on these; we use unoptimized=true on <Image> so Next
    // doesn't try to proxy through its image optimizer (saves Vercel
    // image-transform quota and avoids cold-start latency for tiny PNGs).
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname: '/spothq/cryptocurrency-icons/**',
      },
      {
        // HatScripts/circle-flags — open-source circular country flag SVGs
        protocol: 'https',
        hostname: 'hatscripts.github.io',
        pathname: '/circle-flags/**',
      },
    ],
  },
};

export default nextConfig;
