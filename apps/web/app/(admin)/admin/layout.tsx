import type { Metadata } from 'next';

/**
 * Nothing under /admin is ever prerendered: every screen is one person's view of live
 * data, and a build machine has no API to read it from.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Calwebtech admin',
  // Nothing under /admin is ever for a crawler, whatever the site's indexing setting says.
  robots: { index: false, follow: false },
};

/**
 * Everything under `/admin`, signed in or not.
 *
 * `data-theme="admin"` is what switches the palette: inside it, `--color-result` and
 * `--color-danger` resolve to their dark-theme values, so `text-result` still means
 * "affirmative mark" and the calwebtech/teal-usage rule still guards it
 * (packages/config/tailwind/theme.css). The wrapper carries the ground; the body behind it
 * follows through the `:has()` rule in globals.css, for overscroll.
 */
export default function AdminThemeLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <div data-theme="admin" className="min-h-dvh bg-admin-ground font-sans text-admin-body">
      {children}
    </div>
  );
}
