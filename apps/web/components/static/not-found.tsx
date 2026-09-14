import type { StaticNotFoundView } from '@calwebtech/shared';
import { seoTitle } from '@/lib/seo/metadata';
import { CardGrid, LinkCard } from '../site/cards';
import { Section } from '../site/section';
import { SectionHeading } from '../site/section-heading';
import { ContactLinks } from './parts';
import { SiteSearch } from './site-search';

/**
 * The designed 404 (docs/03-page-specs.md, Utility pages): what happened, a search across the
 * site's pages, the six most useful destinations and a person to ask. Next.js sends the 404
 * status and a noindex robots tag; the title is set here because not-found files cannot
 * export metadata.
 *
 * Keep it lean: the not-found boundary is serialised into every page's payload.
 */
export function NotFoundPage({ view }: { view: StaticNotFoundView }) {
  return (
    <>
      <title>{seoTitle(view.title)}</title>
      <section className="relative overflow-hidden border-b border-line bg-linear-to-br from-white via-mist2 to-mist">
        <div className="grid-lines absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="shell relative grid gap-12 pt-12 pb-16 lg:grid-cols-12 lg:gap-16 lg:pt-16 lg:pb-24">
          <div className="lg:col-span-7">
            <p className="text-[14px] font-semibold text-primary">{view.eyebrow}</p>
            <h1 className="mt-5 font-display text-[38px] leading-[1.05] font-extrabold text-ink sm:text-[50px]">
              {view.title}
            </h1>
            <p className="mt-6 max-w-[58ch] text-[18px] leading-relaxed">{view.intro}</p>
            <SiteSearch copy={view.search} />
          </div>
          <div className="self-end lg:col-span-5">
            <div className="rounded-2xl border border-line bg-white p-7 shadow-panel sm:p-8">
              <h2 className="font-display text-[22px] font-extrabold text-ink">{view.help.heading}</h2>
              <p className="mt-3 text-[15.5px] leading-relaxed">{view.help.body}</p>
              <div className="mt-6 border-t border-line pt-5">
                <ContactLinks contact={view.contact} phoneLabel="Phone" emailLabel="Email" />
              </div>
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
