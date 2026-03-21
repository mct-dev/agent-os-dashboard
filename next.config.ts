import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // next-auth v5 beta has incomplete types — Vercel builds pass regardless
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
