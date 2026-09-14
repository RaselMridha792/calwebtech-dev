import type { StaticLegalBlock, StaticLegalView } from '@calwebtech/shared';
import { Prose } from '../site/lists';
import { PageHero } from '../site/page-hero';
import { Section } from '../site/section';
import { ContactLinks, RichText } from './parts';

function Block({ block }: { block: StaticLegalBlock }) {
  switch (block.type) {
    case 'paragraph':
      return (
        <p>
          <RichText text={block.text} />
        </p>
      );
    case 'list':
      return (
        <ul>
          {block.items.map((item) => (
            <li key={item}>
              <RichText text={item} />
            </li>
          ))}
        </ul>
      );
    case 'table':
      return (
        // A table may be wider than a phone; it scrolls inside its own box, never the page.
        <div className="mt-6 overflow-x-auto rounded-xl border border-line" role="region" aria-label={block.caption} tabIndex={0}>
          <table className="w-full min-w-[34rem] border-collapse text-left text-[15px] leading-relaxed">
            <caption className="sr-only">{block.caption}</caption>
            <thead className="bg-mist2">
              <tr>
                {block.columns.map((column) => (
                  <th key={column} scope="col" className="border-b border-line px-4 py-3 font-semibold text-ink">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.join('|')} className="border-b border-line last:border-b-0">
                  {row.map((cell, index) =>
                    index === 0 ? (
                      <th key={`${cell}-${String(index)}`} scope="row" className="px-4 py-3 align-top font-semibold text-ink">
                        {cell}
                      </th>
                    ) : (
                      <td key={`${cell}-${String(index)}`} className="px-4 py-3 align-top">
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * A page of the legal set: when it last changed, a table of contents, the sections and the
 * contact details. Legal pages may use plain headings (docs/10-site-pages.md).
 */
export function LegalPage({ page, path }: { page: StaticLegalView; path: string }) {
  return (
    <>
      <PageHero ground="light" crumbs={[{ name: page.title, path }]} title={page.title} intro={page.intro}>
        <p className="mt-6 text-[14.5px]">
          {'Last updated '}
          <time dateTime={page.lastUpdated}>{dateFormat.format(new Date(`${page.lastUpdated}T00:00:00Z`))}</time>
        </p>
      </PageHero>

      <Section tone="white" deferred={false}>
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <nav aria-labelledby="legal-contents-heading" className="lg:col-span-3">
            <div className="lg:sticky lg:top-28">
              <h2 id="legal-contents-heading" className="font-display text-[15px] font-bold text-ink">
                On this page
              </h2>
              <ol className="mt-3 space-y-1 border-l border-line text-[15px]">
                {page.sections.map((section) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`} className="-ml-px inline-block border-l-2 border-transparent py-1 pl-4 hover:border-ink hover:text-ink">
                      {section.heading}
                    </a>
                  </li>
                ))}
                <li>
                  <a href="#legal-contact" className="-ml-px inline-block border-l-2 border-transparent py-1 pl-4 hover:border-ink hover:text-ink">
                    {page.contactSection.heading}
                  </a>
                </li>
              </ol>
            </div>
          </nav>

          <div className="lg:col-span-9">
            <Prose className="[&>section:first-child>h2]:mt-0">
              {page.sections.map((section) => (
                <section key={section.id} aria-labelledby={section.id}>
                  <h2 id={section.id}>{section.heading}</h2>
                  {section.blocks.map((block, index) => (
                    <Block key={`${section.id}-${String(index)}`} block={block} />
                  ))}
                </section>
              ))}
            </Prose>
            <section aria-labelledby="legal-contact" className="mt-14 max-w-[72ch] rounded-2xl border border-line bg-mist2 p-7">
              <h2 id="legal-contact" className="font-display text-[24px] leading-tight font-extrabold text-ink">
                {page.contactSection.heading}
              </h2>
              <p className="mt-3 text-[16.5px] leading-relaxed [&_a]:font-semibold [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4">
                <RichText text={page.contactSection.body} />
              </p>
              <div className="mt-6">
                <ContactLinks contact={page.contact} phoneLabel="Phone" emailLabel="Email" />
              </div>
            </section>
          </div>
        </div>
      </Section>
    </>
  );
}
