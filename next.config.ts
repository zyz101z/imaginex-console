import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cycletls spawns a Go binary from a path relative to its own __dirname —
  // it must stay an unbundled runtime require, and tracing can't see the
  // binary, so force it into the /api/kyootbot function bundle.
  serverExternalPackages: ["cycletls"],
  outputFileTracingIncludes: {
    "/api/kyootbot": ["./node_modules/cycletls/dist/index"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
