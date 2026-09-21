import type { MetadataRoute } from 'next';

/**
 * The web app manifest, from the logo pack's own `site.webmanifest`. Written as a route
 * rather than a file in `public/` so the icons Next already fingerprints stay the single
 * source and nothing has to be kept in step by hand.
 *
 * `background_color` is the brand's cream ground and `theme_color` its navy, so an
 * installed icon and its splash match the site rather than a browser default.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Calwebtech',
    short_name: 'Calwebtech',
    display: 'standalone',
    /* eslint-disable no-restricted-syntax -- a manifest is read by the operating system
       when it draws the installed icon and its splash screen, long before any stylesheet
       is parsed. These two are navy-900 and canvas from theme.css, and they are the one
       place the brand's colours have to be written out rather than referenced. */
    theme_color: '#0a1628',
    background_color: '#f4efe6',
    /* eslint-enable no-restricted-syntax */
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
