import { industryPath, type IndustriesIndexView } from '@calwebtech/shared';
import { EmptyState } from '../site/lists';
import { Section } from '../site/section';
import { SectionHeading } from '../site/section-heading';
import { reveal } from '../ui/primitives';
import { ResponsiveImage } from '../ui/responsive-image';

type Content = IndustriesIndexView['content'];

/**
 * Every published industry as a photograph card, in the homepage's industries grid style,
 * closed by the card for sectors without a page. The industry name is the card's one link,
 * stretched over the card: the photograph sits below the text in the card's own stacking
 * context, so the text needs no positioning and the link's overlay spans the whole card.
 * While nothing is published the list is an empty state that points to the contact page.
 */
export function IndustriesList({
  list,
  notListed,
  industries,
}: {
  list: Content['list'];
  notListed: Content['notListed'];
  industries: IndustriesIndexView['industries'];
}) {
  return (
    <Section id="industries" tone="white" deferred={false} labelledBy="industries-heading">
      <SectionHeading id="industries-heading" title={list.heading} intro={list.intro} />
      {industries.length === 0 ? (
        <EmptyState action={notListed.cta}>{list.empty}</EmptyState>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {industries.map((industry, index) => (
            <li
              key={industry.slug}
              className={`lift relative isolate flex flex-col justify-end overflow-hidden rounded-2xl bg-ink p-6 sm:aspect-3/4 ${industry.image ? 'min-h-64' : 'min-h-48'}`}
              {...reveal(index)}
            >
              {industry.image ? (
                <>
                  <ResponsiveImage
                    src={industry.image.src}
                    alt={industry.image.alt}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="-z-10 object-cover opacity-70"
                  />
                  <div className="absolute inset-0 -z-10 bg-linear-to-t from-ink via-ink/50 to-transparent" aria-hidden="true" />
                </>
              ) : (
                <>
                  <div className="glow-blue absolute inset-0 -z-10 opacity-60" aria-hidden="true" />
                  <div className="grid-lines-light absolute inset-0 -z-10" aria-hidden="true" />
                </>
              )}
              <h3 className="font-display text-[20px] font-bold text-white">
                <a
                  href={industryPath(industry.slug)}
                  className="after:absolute after:inset-0 hover:underline hover:underline-offset-4"
                >
                  {industry.name}
                </a>
              </h3>
              {industry.line ? (
                <p className="mt-1.5 text-[14px] leading-snug text-white/80">{industry.line}</p>
              ) : null}
              <span
                className="mt-4 text-[14px] font-semibold text-white underline decoration-white/40 underline-offset-4"
                aria-hidden="true"
              >
                {list.cardLinkLabel}
              </span>
            </li>
          ))}
          <li
            className="grid min-h-48 place-items-center rounded-2xl border border-line bg-mist p-6 text-center sm:aspect-3/4"
            {...reveal(industries.length)}
          >
            <div>
              <h3 className="font-display text-[20px] font-bold text-ink">{notListed.heading}</h3>
              <p className="mt-2 text-[14px] leading-snug">{notListed.body}</p>
              <a
                href={notListed.cta.href}
                className="mt-4 inline-block py-1 font-semibold text-primary hover:text-primaryd"
              >
                {notListed.cta.label}
              </a>
            </div>
          </li>
        </ul>
      )}
    </Section>
  );
}

/**
 * What changes when a build starts from the sector: image with overlay on ink, between the
 * white list and the closing band. Renders nothing without items.
 */
export function IndustriesApproach({
  approach,
  backdrop,
}: {
  approach: Content['approach'];
  backdrop: Content['backdrop'];
}) {
  if (approach.items.length === 0) return null;
  return (
    <Section id="approach" tone="ink" backdrop={backdrop} labelledBy="approach-heading">
      <SectionHeading id="approach-heading" title={approach.heading} intro={approach.intro} ground="dark" />
      <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {approach.items.map((item, index) => (
          <li key={item.title} className="glass flex flex-col rounded-2xl p-7" {...reveal(index)}>
            <span className="font-display text-[15px] font-extrabold text-white/70" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="mt-3 font-display text-[19px] leading-snug font-bold">{item.title}</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-white/75">{item.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
