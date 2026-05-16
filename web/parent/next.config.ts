import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for slim Docker images.
  output: "standalone",
  devIndicators: false,
};

export default nextConfig;
