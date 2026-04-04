import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  turbopack: {
    root: new URL(".", import.meta.url).pathname
  },
  serverExternalPackages: ["@lancedb/lancedb"]
};

export default nextConfig;
