import type { NextConfig } from "next";
const config: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["@electric-sql/pglite", "mysql2", "redis"],
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  devIndicators: false,
};
export default config;
