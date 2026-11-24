import type { NextConfig } from "next";
const config: NextConfig = {
  turbopack: { root: process.cwd() },
  // Hostinger shared builders have a low process/thread limit. Keeping page
  // collection single-worker avoids build aborts without changing runtime.
  experimental: { cpus: 1 },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};
export default config;
