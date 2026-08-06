import dotenv from "dotenv";
import type { NextConfig } from "next";

// Explicitly load .env.local so NEXT_PUBLIC_ variables are available
// to the client bundle during `next dev` in this environment.
dotenv.config({ path: ".env.local", override: true });

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "*.figma.com",
      },
    ],
    unoptimized: true,
  },
};

export default nextConfig;
