import { SITE_ROUTES } from '@calwebtech/shared';
import type { StaticNotFoundPageView } from '@/lib/api/static';
import { seoTitle } from '@/lib/seo/metadata';
import { CardGrid, LinkCard } from '../site/cards';
import { Section } from '../site/section';
import { SectionHeading } from '../site/section-heading';
import { ContactLinks } from './parts';
import { SiteSearch } from './site-search';

/** Shown only when the stored copy cannot be read, so a 404 never becomes an error page. */
const PLAIN_NOT_FOUND: StaticNotFoundPageView = {
  eyebrow: 'Error 404',
  title: 'Page not found',
  intro: 'The address may be mistyped, or the page may have moved.',
  search: {
    label: 'Search the site',
    placeholder: 'Search by page name',
    submitLabel: 'Search',
    resultsLabel: 'Matching pages:',
    noResults: 'No page title matches that. The sitemap lists every page.',
  },
  destinations: {
    heading: 'Start from here',
    items: [
      { title: 'Home', body: 'The overview of what we build.', href: SITE_ROUTES.home },
      { title: 'Sitemap', body: 'Every page on the site in one list.', href: SITE_ROUTES.sitemap },
      { title: 'Contact', body: 'Ask a person where to find something.', href: SITE_ROUTES.contact },
    ],
  },
  // Also the help text whenever the contact is left out, since the stored copy may offer a call.
  help: {
    heading: 'Need a hand?',
    body: 'Send us a message from the contact page and a person will help you find what you were looking for.',
  },
  contact: null,
};

/**
 * The designed 404 (docs/03-page-specs.md, Utility pages): what happened, a search across the
 * site's pages, the six most useful destinations and a person to ask. Next.js sends the 404
 * status and a noindex robots tag; the title is set here because not-found files cannot
 * export metadata.
 *
 * Keep it lean: the not-found boundary is serialised into every page's payload.
 */
export function NotFoundPage({ view: stored }: { view: StaticNotFoundPageView | null }) {
  const view = stored ?? PLAIN_NOT_FOUND;
  const help = view.contact ? view.help : PLAIN_NOT_FOUND.help;
  return (
    <>
      <title>{seoTitle(view.title)}</title>
      <section className="relative overflow-hidden border-b border-hairline bg-canvas">
        <div className="shell relative grid gap-12 pt-12 pb-16 lg:grid-cols-12 lg:gap-16 lg:pt-16 lg:pb-24">
          <div className="lg:col-span-7">
            <p className="text-[14px] font-semibold text-gold-ink">{view.eyebrow}</p>
            <h1 className="mt-5 font-display text-[38px] leading-[1.05] font-extrabold text-ink sm:text-[50px]">
              {view.title}
            </h1>
            <p className="mt-6 max-w-[58ch] text-[18px] leading-relaxed">{view.intro}</p>
            <SiteSearch copy={view.search} />
          </div>
          <div className="self-end lg:col-span-5">
            <div className="border border-hairline bg-canvas-raised p-7 sm:p-8">
              <h2 className="font-display text-[22px] font-extrabold text-ink">{help.heading}</h2>
              <p className="mt-3 text-[15.5px] leading-relaxed">{help.body}</p>
              {view.contact ? (
                <div className="mt-6 border-t border-hairline pt-5">
                  <ContactLinks contact={view.contact} phoneLabel="Phone" emailLabel="Email" />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
      <Section tone="white" labelledBy="destinations-heading" deferred={false}>
        <SectionHeading id="destinations-heading" title={view.destinations.heading} />
        <CardGrid columns={3}>
          {view.destinations.items.map((item, index) => (
            <LinkCard key={`${item.title}${item.href}`} href={item.href} title={item.title} body={item.body} step={index} />
          ))}
        </CardGrid>
      </Section>
    </>
  );
}
