import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Surface type errors at build time rather than in production: a
  // restaurant's ordering system is not the place to discover one at
  // runtime. (Next.js 16 removed the `eslint` config key along with
  // `next lint`; linting runs as its own npm script instead.)
  typescript: { ignoreBuildErrors: false },

  images: {
    // Menu art ships with the app, so there is no remote image host to allow.
    // Adding one later means adding it here explicitly — a deliberate step,
    // not an accidental open door.
    remotePatterns: [],
    formats: ["image/avif", "image/webp"],
  },

  // Security headers that do not depend on per-request state live here; the
  // CSP nonce and the rest are set in src/proxy.ts, which runs per request.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
      {
        // Receipts and order data must never be cached by a shared proxy.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },

  // Keeps the server bundle honest about what it pulls in.
  serverExternalPackages: ["bcryptjs"],
};

export default nextConfig;
