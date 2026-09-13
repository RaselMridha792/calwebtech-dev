import type { Metadata } from 'next';
import { IBM_Plex_Sans, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const display = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex',
  display: 'swap',
});

export const metadata: Metadata = {
  // Read at request time, so one image serves staging and production.
  metadataBase: new URL(process.env.APP_ORIGIN ?? 'http://localhost:3000'),
  title: 'Calwebtech',
};

/**
 * Hides reveal targets only once we know script runs. If the reveal observer has
 * not started within three seconds (a failed hydration), everything is shown.
 */
const MOTION_BOOTSTRAP = `(function(d){var h=d.documentElement;if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;h.classList.add('js-motion');setTimeout(function(){if(!h.hasAttribute('data-reveal-ready'))h.classList.remove('js-motion')},3000)})(document)`;

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOTION_BOOTSTRAP }} />
      </head>
      <body className="bg-white font-sans text-body">{children}</body>
    </html>
  );
}
