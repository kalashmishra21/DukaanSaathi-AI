import type { NextConfig } from "next";

// Keep the production output separate from the active development cache.
const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === "production" ? ".next-prod" : ".next",
};

export default nextConfig;
