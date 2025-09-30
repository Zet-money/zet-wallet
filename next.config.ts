import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  removeConsole: process.env.NODE_ENV === 'production',
};

export default nextConfig;
