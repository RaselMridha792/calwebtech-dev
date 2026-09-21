import path from 'node:path';
import type { NextConfig } from 'next';

// `pnpm --filter @calwebtech/web analyze` builds into .next-analyze with readable
// module ids so scripts/bundle-report.mjs can attribute bytes to modules.
const analyze = process.env.BUNDLE_ANALYZE === '1';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Scripts run from apps/web; tracing must include the workspace packages.
  outputFileTracingRoot: path.join(process.cwd(), '..', '..'),
  trailingSlash: true,
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    // 50 is for decorative backdrops under heavy overlays; 75 is the default.
    qualities: [50, 75],
    remotePatterns: [
      // Stock photography in the demo snapshots (Unsplash and Pexels licences allow
      // commercial use without attribution). Remove once client imagery is served from the
      // media library.
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
    ],
  },
  /*
   * The admin's session cookie is first-party and SameSite=Strict, so the browser has to
   * reach the API on this origin. In production Traefik already routes /api to the API
   * and this never runs; in development, where web is on 3000 and the API on 4000, it is
   * what keeps the cookie same-origin without CORS, which CLAUDE.md forbids configuring.
   * Not a route under app/api: the web app still defines none.
   */
  rewrites() {
    const api = process.env.API_INTERNAL_URL?.trim();
    return Promise.resolve(api ? [{ source: '/api/:path*', destination: `${api.replace(/\/$/, '')}/:path*` }] : []);
  },
  ...(analyze
    ? { distDir: '.next-analyze', experimental: { turbopackModuleIds: 'named' as const } }
    : {}),
};

export default nextConfig;
