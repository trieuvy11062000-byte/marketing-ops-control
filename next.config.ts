import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["src/lib/db/schema.sql"],
  },
};

export default nextConfig;
