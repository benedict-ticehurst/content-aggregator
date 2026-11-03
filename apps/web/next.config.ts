import type { NextConfig } from "next";

// Share one .env file at the repo root with the worker.
try {
  process.loadEnvFile("../../.env");
} catch {
  // In production, env vars come from the host instead.
}

const config: NextConfig = {
  // Workspace packages ship TypeScript source, so Next compiles them.
  transpilePackages: ["@agg/db", "@agg/core"],
  webpack(webpackConfig) {
    // Let ESM-style "./file.js" imports resolve to the .ts source files.
    webpackConfig.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    return webpackConfig;
  },
};

export default config;