import type { NextConfig } from "next";

// Keep build output separate from dev and the OneDrive-locked earlier
// production cache. The dev script uses Webpack for reliable PDF chunks.
const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === "production" ? ".next-prod-build-local" : ".next-dev-local",
};

export default nextConfig;
