import { SITE_ROUTES } from '@calwebtech/shared';
import { RevealObserver } from '@/components/motion/reveal-observer';
import { SkipLink } from '@/components/site/skip-link';
import { NotFoundPage } from '@/components/static/not-found';
import { Wordmark } from '@/components/ui/brand';
import { getStaticNotFound } from '@/lib/api/static';

/**
 * Regenerates the 404 served for unmatched URLs (STATIC_NOT_FOUND_REVALIDATE_SECONDS, a
 * literal because segment config must be statically readable). For the `/_not-found` route
 * this file is the page module, so the interval applies there. Without it `next build`,
 * which runs without the API, would prerender that page once from the snapshot and serve it
 * until the next deploy, ignoring the `static.not-found` and `site.contact` settings. As a
 * boundary inside other routes Next.js reads no segment config from this file.
 */
export const revalidate = 300;

/**
 * A URL that matches no route: the same designed 404 in a slim frame of its own, since no
 * layout below the root applies. Next.js serialises the root not-found boundary into the
 * payload of every page, the homepage and campaign pages included, so it stays lean on
 * purpose: no full `SiteShell` (the header and footer would be sent twice on every site page)
 * and no per-request data (its copy is fetched with a revalidate interval, which keeps the
 * statically regenerated campaign pages static).
 */
export default async function NotFound() {
  const view = await getStaticNotFound();
  return (
    <>
      <SkipLink />
      <header className="border-b border-line bg-white">
        <div className="shell flex h-20 items-center justify-between gap-6">
          <a href={SITE_ROUTES.home} aria-label="Calwebtech home" className="inline-block">
            <Wordmark />
          </a>
          <a
            href={SITE_ROUTES.contact}
            className="inline-flex h-11 items-center rounded-xl bg-primary px-5 text-[15px] font-semibold text-white hover:bg-primaryd"
          >
            Contact us
          </a>
        </div>
      </header>
      <main id="main">
        <NotFoundPage view={view} />
      </main>
      <footer className="bg-ink py-8 text-[14px] text-white/70">
        <div className="shell flex flex-wrap items-center justify-between gap-4">
          <p>{`© ${String(new Date().getFullYear())} Calwebtech`}</p>
          <a href={SITE_ROUTES.sitemap} className="inline-block py-1 hover:text-white">
            Sitemap
          </a>
        </div>
      </footer>
      <RevealObserver />
    </>
  );
}
