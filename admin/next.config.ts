import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  experimental: { externalDir: true },
  outputFileTracingRoot: path.resolve(process.cwd(), ".."),
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
