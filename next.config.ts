import dotenv from "dotenv";
import type { NextConfig } from "next";

// Explicitly load .env.local so NEXT_PUBLIC_ variables are available
// to the client bundle during `next dev` in this environment.
dotenv.config({ path: ".env.local", override: true });

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
