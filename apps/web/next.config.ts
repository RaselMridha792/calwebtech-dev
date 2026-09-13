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
    remotePatterns: [
      // Placeholder photography used by the seed. Remove once client imagery is
      // served from the media library.
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  ...(analyze
    ? { distDir: '.next-analyze', experimental: { turbopackModuleIds: 'named' as const } }
    : {}),
};

export default nextConfig;
