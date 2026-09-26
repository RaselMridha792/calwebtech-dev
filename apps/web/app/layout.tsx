import type { Metadata } from 'next';
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans, Manrope, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

/**
 * The brand's three faces: Archivo carries every display size, Manrope the prose, and
 * IBM Plex Mono only the `meta` numerals. Self-hosted by next/font, so no request leaves
 * for Google at render time and the metrics are known before first paint.
 */
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-archivo',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

/**
 * The dashboard's own faces. `preload: false` because they are needed behind a sign-in
 * and would otherwise be preloaded on every marketing page, which is exactly the weight
 * the performance budget exists to refuse.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
  preload: false,
});

const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  // Read at request time, so one image serves staging and production.
  metadataBase: new URL(process.env.APP_ORIGIN ?? 'http://localhost:3000'),
  title: 'Calwebtech',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${manrope.variable} ${plexMono.variable} ${jakarta.variable} ${plex.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-canvas font-sans text-ink">{children}</body>
    </html>
  );
}
