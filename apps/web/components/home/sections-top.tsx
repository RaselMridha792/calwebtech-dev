import type { HomePageContent, HomePageView, HomeProject } from '@calwebtech/shared';
import { BeforeAfterSlider } from '../landing/before-after-slider';
import { FaqAccordion } from '../landing/faq-accordion';
import { CheckBullet, reveal } from '../ui/primitives';
import { BackgroundVideo } from '../ui/background-video';
import { BackdropImage } from '../ui/brand';
import { ResponsiveImage } from '../ui/responsive-image';
import { EmptyNote, TextLink, byline, h2Dark, h2Light } from './parts';
import { Showreel } from './showreel';

type Content = HomePageContent;
type Home = HomePageView;

/** Video-backed band after the logo band, with the showreel when one is published. */
export function CapabilityBand({ capability }: { capability: Content['capability'] }) {
  const { showreel } = capability;
  return (
    <section className="content-auto relative overflow-hidden bg-ink py-20 text-white lg:py-28">
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <BackdropImage image={capability.background.poster} className="kenburns opacity-[.22]" />
      </div>
      {capability.background.videoUrl ? (
        <BackgroundVideo src={capability.background.videoUrl} className="opacity-100" />
      ) : null}
      <div className="absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-linear-to-r from-ink via-ink/90 to-ink/60" />
        <div className="glow-blue absolute inset-0 opacity-70" />
      </div>
      <div className="shell relative" {...reveal()}>
        <h2 className={`${h2Light} max-w-[20ch]`}>{capability.heading}</h2>
        {capability.bullets.length > 0 ? (
          <ul className="mt-9 space-y-4 text-[17px]">
            {capability.bullets.map((bullet) => (
              <CheckBullet key={bullet}>{bullet}</CheckBullet>
            ))}
          </ul>
        ) : null}
        <p className="mt-8 max-w-[62ch] text-[16.5px] leading-relaxed text-white/70">{capability.body}</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <a
            href={capability.primaryCta.href}
            className="inline-flex items-center rounded-xl bg-white px-6 py-3.5 font-semibold text-ink hover:bg-mist"
          >
            {capability.primaryCta.label}
          </a>
          {showreel ? (
            <Showreel label={showreel.label} videoUrl={showreel.videoUrl} poster={showreel.poster?.src ?? null} />
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Problems a buyer arrives with, one answer open at a time. Nothing links here, so no empty state. */
export function ProblemRouter({
  problemRouter,
  faqs,
}: {
  problemRouter: Content['problemRouter'];
  faqs: Home['problemRouter'];
}) {
  if (faqs.length === 0) return null;
  return (
    <section className="content-auto bg-white py-20 lg:py-28">
      <div className="shell grid gap-12 lg:grid-cols-12 lg:gap-20">
        <div className="lg:col-span-4" {...reveal()}>
          <h2 className={h2Dark}>{problemRouter.heading}</h2>
          <p className="mt-5 text-[17px] leading-relaxed">{problemRouter.intro}</p>
          <a
            href={problemRouter.cta.href}
            className="mt-7 inline-flex h-12 items-center rounded-lg bg-ink px-6 font-semibold text-white hover:bg-ink2"
          >
            {problemRouter.cta.label}
          </a>
        </div>
        <div className="lg:col-span-8" {...reveal(1)}>
          <FaqAccordion items={faqs} group="problem-router" />
        </div>
      </div>
    </section>
  );
}

export function ServicesGrid({ services, items }: { services: Content['services']; items: Home['services'] }) {
  return (
    <section
      id="services"
      className="content-auto relative overflow-hidden border-y border-line bg-linear-to-b from-mist2 via-mist to-mist2 py-20 lg:py-28"
    >
      <div className="grid-lines absolute inset-0 opacity-70" aria-hidden="true" />
      <div className="absolute -top-32 -right-24 h-[520px] w-[520px] rounded-full bg-primary/7 blur-3xl" aria-hidden="true" />
      <div className="shell relative">
        <h2 className={`${h2Dark} mb-12 max-w-[16ch]`} {...reveal()}>
          {services.heading}
        </h2>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((service, index) => (
            <li
              key={service.slug}
              className="rounded-2xl border border-line bg-white p-7 transition-colors hover:border-ink"
              {...reveal(index)}
            >
              <h3 className="font-display text-[20px] font-bold text-ink">{service.title}</h3>
              <p className="mt-2.5 text-[15px] leading-relaxed">{service.summary}</p>
              {service.deliverables.length > 0 ? (
                <ul className="mt-5 space-y-1.5 text-[14px]">
                  {service.deliverables.map((deliverable) => (
                    <li key={deliverable}>{deliverable}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Tags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2 text-[12.5px] font-medium">
      {tags.map((tag) => (
        <li key={tag} className="rounded-md bg-mist px-2.5 py-1 text-ink">
          {tag}
        </li>
      ))}
    </ul>
  );
}

function Metrics({ metrics, lead }: { metrics: HomeProject['metrics']; lead: boolean }) {
  return (
    <dl className={`grid grid-cols-3 border-t border-line ${lead ? 'mt-7 gap-5 pt-6' : 'mt-6 gap-4 pt-5'}`}>
      {metrics.map((metric) => (
        <div key={metric.label} className="flex flex-col-reverse">
          <dt className={`mt-1.5 ${lead ? 'text-[13px]' : 'text-[12.5px]'}`}>{metric.label}</dt>
          <dd
            className={`font-display leading-none font-extrabold text-result ${lead ? 'text-[26px] sm:text-[32px] lg:text-[38px]' : 'text-[26px]'}`}
          >
            {metric.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function LeadProject({ project, filterKey }: { project: HomeProject; filterKey: string }) {
  const { quote } = project;
  const quoteByline = quote ? byline(quote.role, quote.company) : '';
  return (
    <article
      data-work-filter={filterKey}
      className={`overflow-hidden rounded-2xl border border-line lg:col-span-2 ${project.image ? 'grid lg:grid-cols-2' : ''}`}
    >
      {project.image ? (
        <div className="relative min-h-[280px] bg-mist">
          <ResponsiveImage
            src={project.image.src}
            alt={project.image.alt}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="p-8 lg:p-10">
        <Tags tags={project.tags} />
        <h3 className="mt-5 font-display text-[26px] leading-tight font-extrabold text-ink lg:text-[30px]">
          {project.clientName}
        </h3>
        <p className="mt-3 leading-relaxed">{project.summary}</p>
        <Metrics metrics={project.metrics} lead />
        {quote ? (
          <figure className="mt-7 border-t border-line pt-6">
            <blockquote className="text-[15.5px] leading-relaxed text-ink">{`"${quote.quote}"`}</blockquote>
            <figcaption className="mt-4 text-[14px]">
              <b className="text-ink">{quote.clientName}</b>
              {quoteByline ? `, ${quoteByline}` : null}
            </figcaption>
          </figure>
        ) : null}
      </div>
    </article>
  );
}

function ProjectCard({ project, filterKey }: { project: HomeProject; filterKey: string }) {
  return (
    <article data-work-filter={filterKey} className="overflow-hidden rounded-2xl border border-line">
      {project.image ? (
        <div className="relative aspect-video bg-mist">
          <ResponsiveImage
            src={project.image.src}
            alt={project.image.alt}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="p-7">
        <Tags tags={project.tags} />
        <h3 className="mt-4 font-display text-[23px] font-extrabold text-ink">{project.clientName}</h3>
        <p className="mt-2.5 text-[15px] leading-relaxed">{project.summary}</p>
        <Metrics metrics={project.metrics} lead={false} />
      </div>
    </article>
  );
}

/**
 * Filters are native radio buttons. One generated rule per filter hides the other cards
 * with `:has()`, so filtering needs no script. Rules name filters by position, so no
 * record text reaches the stylesheet.
 */
function WorkFilters({ filters }: { filters: string[] }) {
  const css = filters
    .map(
      (_filter, index) =>
        `#work:has(#work-filter-${String(index)}:checked) [data-work-filter]:not([data-work-filter=f${String(index)}]){display:none}`,
    )
    .join('');
  const options = [
    { id: 'work-filter-all', label: 'All work' },
    ...filters.map((label, index) => ({ id: `work-filter-${String(index)}`, label })),
  ];
  return (
    <fieldset className="mb-9">
      <legend className="sr-only">Filter the work by industry</legend>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="flex flex-wrap gap-2">
        {options.map((option, index) => (
          <label
            key={option.id}
            className="inline-flex h-10 cursor-pointer items-center rounded-lg bg-mist px-4 text-[14.5px] font-semibold text-ink hover:bg-line has-checked:bg-ink has-checked:text-white has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary"
          >
            <input type="radio" name="work-filter" id={option.id} defaultChecked={index === 0} className="sr-only" />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function FeaturedWork({ work, projects }: { work: Content['work']; projects: Home['projects'] }) {
  const filters = [...new Set(projects.flatMap((project) => (project.filter ? [project.filter] : [])))];
  const filterKey = (project: HomeProject) =>
    project.filter ? `f${String(filters.indexOf(project.filter))}` : '';
  return (
    <section id="work" className="content-auto bg-white py-20 lg:py-28">
      <div className="shell">
        <div className="mb-9" {...reveal()}>
          <h2 className={`${h2Dark} max-w-[20ch]`}>{work.heading}</h2>
          <p className="mt-4 max-w-[58ch] text-[17px] leading-relaxed">{work.intro}</p>
        </div>
        {projects.length === 0 ? (
          <EmptyNote className="">{work.empty}</EmptyNote>
        ) : (
          <>
            {filters.length > 1 ? <WorkFilters filters={filters} /> : null}
            <div className="grid gap-6 lg:grid-cols-2">
              {projects.map((project, index) =>
                index === 0 ? (
                  <LeadProject key={project.slug} project={project} filterKey={filterKey(project)} />
                ) : (
                  <ProjectCard key={project.slug} project={project} filterKey={filterKey(project)} />
                ),
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/** One featured client quote. Nothing links here, so it renders nothing without one. */
export function PullQuote({ quote }: { quote: Home['pullQuote'] }) {
  if (!quote) return null;
  const quoteByline = byline(quote.role, quote.company);
  return (
    <section className="content-auto relative overflow-hidden bg-ink py-16 text-white lg:py-20">
      <div className="absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-linear-to-r from-ink via-ink/90 to-ink/75" />
        <div className="glow-blue absolute inset-0 opacity-50" />
      </div>
      <div className="shell relative">
        <figure className="max-w-[58ch]" {...reveal()}>
          <blockquote className="font-display text-[24px] leading-[1.25] font-bold lg:text-[32px]">
            {`"${quote.quote}"`}
          </blockquote>
          <figcaption className="mt-7 flex items-center gap-4">
            {quote.avatar ? (
              <ResponsiveImage
                src={quote.avatar.src}
                alt=""
                width={48}
                height={48}
                sizes="48px"
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : null}
            <span className="text-[15px]">
              <b className="block text-white">{quote.clientName}</b>
              {quoteByline ? <span className="text-white/70">{quoteByline}</span> : null}
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

export function MidCta({ midCta }: { midCta: Content['midCta'] }) {
  return (
    <section className="content-auto border-y border-line bg-white py-14 lg:py-16">
      <div className="shell flex flex-wrap items-center justify-between gap-8">
        <div>
          <p className="text-[14px]">{midCta.eyebrow}</p>
          <h2 className="mt-2 font-display text-[28px] leading-tight font-extrabold text-ink lg:text-[36px]">
            {midCta.heading}
          </h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href={midCta.primaryCta.href}
            className="inline-flex h-14 items-center rounded-xl bg-primary px-7 text-[16px] font-semibold text-white hover:bg-primaryd"
          >
            {midCta.primaryCta.label}
          </a>
          {midCta.secondaryCta ? (
            <a
              href={midCta.secondaryCta.href}
              className="inline-flex h-14 items-center rounded-xl border border-line px-7 text-[16px] font-semibold text-ink hover:border-ink hover:bg-mist2"
            >
              {midCta.secondaryCta.label}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function BeforeAfterHome({
  beforeAfter,
  comparison,
}: {
  beforeAfter: Content['beforeAfter'];
  comparison: Home['beforeAfter'];
}) {
  const frame = (image: NonNullable<Home['beforeAfter']>['before']) => (
    <ResponsiveImage
      src={image.src}
      alt={image.alt}
      fill
      sizes="(min-width: 1024px) 60vw, 100vw"
      className="object-cover object-top"
      draggable={false}
    />
  );
  return (
    <section id="beforeafter" className="content-auto relative overflow-hidden bg-ink py-20 text-white lg:py-28">
      <div className="absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-linear-to-r from-ink via-ink/92 to-ink/70" />
        <div className="glow-blue absolute inset-0 opacity-60" />
      </div>
      <div className="shell relative grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4" {...reveal()}>
          <h2 className={h2Light}>{beforeAfter.heading}</h2>
          <p className="mt-5 text-[17px] leading-relaxed text-white/70">{beforeAfter.intro}</p>
          {comparison && comparison.metrics.length > 0 ? (
            <dl className="mt-8 space-y-4 border-t border-white/15 pt-7">
              {comparison.metrics.map((metric) => (
                <div key={metric.label} className="flex items-baseline justify-between gap-6">
                  <dt className="text-[14px] text-white/70">{metric.label}</dt>
                  <dd className="font-display font-bold">
                    {metric.before} <span className="font-normal text-white/70">to</span>{' '}
                    <span className="font-display font-bold text-result">{metric.after}</span>
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        <div className="lg:col-span-8" {...reveal(1)}>
          {comparison ? (
            <BeforeAfterSlider
              before={frame(comparison.before)}
              after={frame(comparison.after)}
              clientName={comparison.clientName}
            />
          ) : (
            <EmptyNote tone="dark" className="">
              {beforeAfter.empty}
            </EmptyNote>
          )}
        </div>
      </div>
    </section>
  );
}

export function IndustriesGrid({
  industries,
  items,
}: {
  industries: Content['industries'];
  items: Home['industries'];
}) {
  const { notListed } = industries;
  return (
    <section id="industries" className="content-auto bg-white py-20 lg:py-28">
      <div className="shell">
        <div className="mb-12" {...reveal()}>
          <h2 className={`${h2Dark} max-w-[18ch]`}>{industries.heading}</h2>
          <p className="mt-4 max-w-[58ch] text-[17px] leading-relaxed">{industries.intro}</p>
        </div>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((industry, index) => (
            <li
              key={industry.slug}
              className="relative flex min-h-44 flex-col justify-end overflow-hidden rounded-2xl bg-ink p-6 sm:aspect-[3/4]"
              {...reveal(index)}
            >
              <div className="glow-blue absolute inset-0 opacity-60" aria-hidden="true" />
              <div className="grid-lines-light absolute inset-0" aria-hidden="true" />
              <h3 className="relative font-display text-[20px] font-bold text-white">{industry.name}</h3>
              {industry.line ? (
                <p className="relative mt-1.5 text-[14px] leading-snug text-white/75">{industry.line}</p>
              ) : null}
            </li>
          ))}
          <li
            className="grid min-h-44 place-items-center rounded-2xl border border-line bg-mist p-6 text-center sm:aspect-[3/4]"
            {...reveal(items.length)}
          >
            <div>
              <h3 className="font-display text-[20px] font-bold text-ink">{notListed.heading}</h3>
              <p className="mt-2 text-[14px] leading-snug">{notListed.body}</p>
              <TextLink link={notListed.cta} className="mt-4 inline-block" />
            </div>
          </li>
        </ul>
      </div>
    </section>
  );
}
