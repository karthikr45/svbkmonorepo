import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for slim Docker images.
  output: "standalone",
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "aautifileuploads.blob.core.windows.net",
        pathname: "/svbk/**",
      },
    ],
  },
};

export default nextConfig;
