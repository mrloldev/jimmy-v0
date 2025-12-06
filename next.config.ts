import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  reactStrictMode: true,
  reactCompiler: true,
  experimental: {
    optimizeCss: true,
    cssChunking: true,
    inlineCss: true,
  },
  typedRoutes: true,
  poweredByHeader: false,
};

export default nextConfig;
