import type { NextConfig } from "next";

// Keep build output separate from dev and avoid the OneDrive-locked old
// production directory. The dev script uses Webpack for reliable PDF chunks.
const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === "production" ? ".next-prod-local" : ".next-dev-local",
};

export default nextConfig;
