import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
