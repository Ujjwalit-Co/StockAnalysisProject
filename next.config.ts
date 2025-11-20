import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ignored: ["**/*"], 
      };
    }
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  turbopack: {},
};

export default nextConfig;
