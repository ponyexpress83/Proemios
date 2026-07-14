import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // pdf-parse / mammoth are server-only; keep them out of the client bundle.
  serverExternalPackages: ["pdf-parse", "mammoth"],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
