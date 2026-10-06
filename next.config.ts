import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Surface type errors at build time rather than in production: a
  // restaurant's ordering system is not the place to discover one at
  // runtime. (Next.js 16 removed the `eslint` config key along with
  // `next lint`; linting runs as its own npm script instead.)
  // Errors are never ignored. `tsconfigPath` points the build's type check at
  // the app, not at the test suite — see the comment in tsconfig.build.json.
  typescript: { ignoreBuildErrors: false, tsconfigPath: "tsconfig.build.json" },

  images: {
    // Two hosts, both named explicitly. A wildcard here would let any URL a
    // staff member pastes into the admin become an image this server fetches
    // and re-serves, which is a proxy with the restaurant's name on it.
    //
    // The menu photographs live on these rather than in the repository: the
    // bytes do not belong in git, and Next's optimizer fetches, resizes and
    // re-encodes them to AVIF or WebP at the size each device asks for, so
    // the customer gets a smaller file than a committed JPEG would be.
    //
    // Both licences permit this use — Unsplash's own licence, and Creative
    // Commons for Wikimedia. docs/ASSUMPTIONS.md records that these are
    // stand-ins for the restaurant's own photographs, which the owner can
    // upload over any of them from Admin → Products → Dish photo.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "upload.wikimedia.org", pathname: "/**" },
    ],
    formats: ["image/avif", "image/webp"],
    // A menu photograph is replaced when the owner uploads their own, not on
    // a schedule, so a long cache costs nothing and saves a round trip.
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },

  async redirects() {
    return [
      // The previous version of this site tracked orders at /track, and that
      // URL is on receipts and in people's history. It costs nothing to keep
      // working, and a dead link is how a customer decides the order is lost.
      { source: "/track", destination: "/orders", permanent: true },
      { source: "/my-orders", destination: "/orders", permanent: true },
    ];
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
