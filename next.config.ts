import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer uses Node-style APIs (Buffer, etc.) that Turbopack
  // can't bundle as a regular dependency. Marking it as a server-external
  // package tells Next.js to leave it for runtime resolution, which is fine
  // because we only ever import it client-side via next/dynamic with
  // ssr: false in src/app/dashboard/monthly-report/page.tsx.
  serverExternalPackages: ['@react-pdf/renderer'],
};

export default nextConfig;
