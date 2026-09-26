import type { HomePageContent, HomePageView, HomeProject } from '@calwebtech/shared';
import { BeforeAfterSlider } from '../landing/before-after-slider';
import { FaqAccordion } from '../landing/faq-accordion';
import { CheckBullet, reveal } from '../ui/primitives';
import { BackgroundVideo } from '../ui/background-video';
import { BackdropImage } from '../ui/brand';
import { ArrowIcon } from '../ui/icons';
import { ResponsiveImage } from '../ui/responsive-image';
import { ActionLink, EmptyNote, SectionHead, TextLink, byline, h2Dark, h2Light } from './parts';
import { Showreel } from './showreel';

type Content = HomePageContent;
type Home = HomePageView;

function LogoRow({ clients, duplicate }: { clients: Home['clients']; duplicate: boolean }) {
  return (
    <ul className="flex shrink-0 items-center" aria-hidden={duplicate ? true : undefined}>
      {clients.map((client) => (
        // A rule between marks, never a card around one.
        <li key={client.name} className="shrink-0 border-l border-hairline px-14">
          {client.logo ? (
            <ResponsiveImage
              src={client.logo.src}
              alt={duplicate ? '' : client.logo.alt}
              width={140}
              height={32}
              sizes="140px"
              className="h-8 w-auto opacity-60 grayscale transition-opacity duration-150 hover:opacity-100"
            />
          ) : (
            // The mark is set in type until the client's own SVG exists. ink-muted holds
            // 4.8:1 on the sunken cream, well past the minimum for large bold text.
            <span className="heading-lg whitespace-nowrap text-ink-muted transition-colors duration-150 hover:text-ink">
              {client.name}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Client names sliding past, under the hero. Moving content that starts on its own needs
 * a way to stop it (WCAG 2.2.2): hover pauses it, and a checkbox that appears on keyboard
 * focus holds it still. Reduced motion stops it. Nothing links here, so it renders nothing
 * without clients.
 */
export function LogoBand({ label, clients }: { label: string; clients: Home['clients'] }) {
  if (clients.length === 0) return null;
  return (
    <section
      aria-label={label}
      className="content-auto group relative overflow-hidden border-y border-hairline bg-canvas-sunken py-9"
    >
      <p className="eyebrow shell mb-6 text-ink-muted">{label}</p>
      <input id="logo-band-pause" type="checkbox" className="peer sr-only" />
      <label
        htmlFor="logo-band-pause"
        className="sr-only peer-focus-visible:not-sr-only peer-focus-visible:absolute peer-focus-visible:top-2 peer-focus-visible:right-6 peer-focus-visible:z-10 peer-focus-visible: peer-focus-visible:bg-navy-900 peer-focus-visible:px-3 peer-focus-visible:py-2 peer-focus-visible:text-[13px] peer-focus-visible:font-semibold peer-focus-visible:text-ink-invert peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus-invert"
      >
        Pause the client names
      </label>
      {/* The names fade in and out at the edges instead of being cut by them. */}
      <div className="[mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)] peer-checked:*:[animation-play-state:paused]">
        <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
          <LogoRow clients={clients} duplicate={false} />
          <LogoRow clients={clients} duplicate />
        </div>
      </div>
    </section>
  );
}

/** Video-backed band after the logo band, with the showreel when one is published. */
export function CapabilityBand({ capability }: { capability: Content['capability'] }) {
  if (!capability.enabled) return null;
  const { showreel } = capability;
  return (
    <section className="content-auto relative overflow-hidden bg-navy-900 py-20 text-ink-invert lg:py-28">
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <BackdropImage image={capability.background.poster} className="kenburns opacity-[.22]" />
      </div>
      {capability.background.videoUrl ? (
        <BackgroundVideo src={capability.background.videoUrl} className="opacity-100" />
      ) : null}
      <div className="absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-scrim-strong" />
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
        <p className="mt-8 max-w-[62ch] text-[16.5px] leading-relaxed text-ink-invert-muted">{capability.body}</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <ActionLink link={capability.primaryCta} tone="cream" />
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
    <section className="content-auto bg-canvas-raised py-20 lg:py-28">
      <div className="shell grid gap-12 lg:grid-cols-12 lg:gap-20">
        <div className="lg:col-span-4" {...reveal()}>
          <h2 className={h2Dark}>{problemRouter.heading}</h2>
          <p className="mt-5 text-[17px] leading-relaxed">{problemRouter.intro}</p>
          <ActionLink link={problemRouter.cta} className="mt-7" />
        </div>
        <div className="lg:col-span-8" {...reveal(1)}>
          <FaqAccordion items={faqs} group="problem-router" />
        </div>
      </div>
    </section>
  );
}

/**
 * The services index: numbered editorial rows on hairlines, which is the form the brand
 * gives a set of peers. No card, no border box, no shadow — the rule above and below each
 * row is the only separation, and the numeral does the work an icon tile used to.
 *
 * Hovering or focusing a row sweeps the navy ground across it from the left and turns its
 * type to cream, the numeral and arrow to champagne; the ground reaches a little past the
 * text so the words never touch its edge. Transform and colour only, so nothing moves the
 * rows around it. Each row is the link to its own page.
 */
export function ServicesGrid({ services, items }: { services: Content['services']; items: Home['services'] }) {
  const ease = 'duration-500 ease-out-quint motion-reduce:transition-none';
  return (
    <section id="services" className="content-auto bg-canvas py-20 lg:py-32">
      <div className="shell">
        <SectionHead link={services.link} className="mb-12">
          <h2 className="display-lg max-w-[16ch] text-ink">{services.heading}</h2>
        </SectionHead>
        <ul className="border-t border-hairline">
          {items.map((service, index) => (
            <li key={service.slug} className="border-b border-hairline" {...reveal(index)}>
              <a
                href={`/services/${service.slug}/`}
                className="group relative isolate grid gap-x-8 gap-y-2 py-8 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus lg:grid-cols-12 lg:items-baseline"
              >
                <span
                  aria-hidden
                  className={`absolute inset-y-0 -inset-x-4 -z-10 origin-left scale-x-0 bg-navy-900 transition-transform group-hover:scale-x-100 group-focus-visible:scale-x-100 lg:-inset-x-8 ${ease}`}
                />
                <span className={`meta text-ink-muted transition-colors group-hover:text-gold-500 group-focus-visible:text-gold-500 lg:col-span-1 ${ease}`}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3
                  className={`display-md text-ink transition group-hover:translate-x-2 group-hover:text-ink-invert group-focus-visible:text-ink-invert lg:col-span-4 ${ease}`}
                >
                  {service.title}
                </h3>
                <div className="lg:col-span-6">
                  <p className={`body-base text-ink-muted transition-colors group-hover:text-ink-invert-muted group-focus-visible:text-ink-invert-muted ${ease}`}>
                    {service.summary}
                  </p>
                  {service.deliverables.length > 0 ? (
                    <ul
                      className={`body-sm mt-3 flex flex-wrap gap-x-5 gap-y-1 text-ink-muted transition-colors group-hover:text-ink-invert-muted group-focus-visible:text-ink-invert-muted ${ease}`}
                    >
                      {service.deliverables.map((deliverable) => (
                        <li key={deliverable} className="flex items-baseline gap-2 before:h-1 before:w-1 before:shrink-0 before:translate-y-[-3px] before:bg-current before:opacity-50">
                          {deliverable}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <span className="flex items-baseline justify-end lg:col-span-1">
                  <ArrowIcon
                    className={`w-5 text-ink-muted transition group-hover:translate-x-1.5 group-hover:text-gold-500 group-focus-visible:text-gold-500 ${ease}`}
                  />
                </span>
              </a>
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
        <li key={tag} className="bg-canvas-sunken px-2.5 py-1 text-ink">
          {tag}
        </li>
      ))}
    </ul>
  );
}

function Metrics({ metrics, lead }: { metrics: HomeProject['metrics']; lead: boolean }) {
  return (
    <dl className={`grid grid-cols-3 border-t border-hairline ${lead ? 'mt-7 gap-5 pt-6' : 'mt-6 gap-4 pt-5'}`}>
      {metrics.map((metric) => (
        <div key={metric.label} className="flex flex-col-reverse justify-end">
          <dt className={`mt-1.5 ${lead ? 'text-[13px]' : 'text-[12.5px]'}`}>{metric.label}</dt>
          <dd
            // Never broken: "12 min" over two lines put the figure on a different baseline from its
            // neighbours. Three columns at 390px are about 90px each, so the phone size is smaller.
            className={`font-display leading-none font-extrabold whitespace-nowrap text-gold-ink ${lead ? 'text-[22px] sm:text-[32px] lg:text-[38px]' : 'text-[22px] sm:text-[26px]'}`}
          >
            {metric.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The case study page for a card, named for assistive technology among several alike. */
function CaseStudyLink({ project, label, lead }: { project: HomeProject; label: string; lead: boolean }) {
  return (
    <a
      href={`/work/${project.slug}/`}
      className={
        lead
          ? 'button-label mt-7 inline-flex h-12 items-center bg-navy-900 px-6 text-ink-invert transition-colors duration-150 after:absolute after:inset-0 hover:bg-navy-700'
          : 'button-label mt-6 inline-block text-gold-ink transition-colors duration-150 after:absolute after:inset-0 hover:text-gold-600'
      }
    >
      {label}
      <span className="sr-only">{`: ${project.clientName}`}</span>
    </a>
  );
}

function LeadProject({
  project,
  filterKey,
  caseStudyLabel,
}: {
  project: HomeProject;
  filterKey: string;
  caseStudyLabel: string | null;
}) {
  const { quote } = project;
  const quoteByline = quote ? byline(quote.role, quote.company) : '';
  return (
    <article
      data-work-filter={filterKey}
      className={`group relative overflow-hidden border border-hairline transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus hover:bg-canvas lg:col-span-2 ${project.image ? 'grid lg:grid-cols-2' : ''}`}
    >
      {project.image ? (
        <div className="relative min-h-[280px] bg-canvas-sunken">
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
          <figure className="mt-7 border-t border-hairline pt-6">
            <blockquote className="text-[15.5px] leading-relaxed text-ink">{`"${quote.quote}"`}</blockquote>
            <figcaption className="mt-4 flex items-center gap-3 text-[14px]">
              {quote.avatar ? (
                <ResponsiveImage
                  src={quote.avatar.src}
                  alt=""
                  width={40}
                  height={40}
                  sizes="40px"
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : null}
              <span>
                <b className="text-ink">{quote.clientName}</b>
                {quoteByline ? `, ${quoteByline}` : null}
              </span>
            </figcaption>
          </figure>
        ) : null}
        {caseStudyLabel ? <CaseStudyLink project={project} label={caseStudyLabel} lead /> : null}
      </div>
    </article>
  );
}

function ProjectCard({
  project,
  filterKey,
  caseStudyLabel,
}: {
  project: HomeProject;
  filterKey: string;
  caseStudyLabel: string | null;
}) {
  return (
    <article
      data-work-filter={filterKey}
      className="group relative overflow-hidden border border-hairline transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-canvas-raised focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus"
    >
      {project.image ? (
        <div className="relative aspect-video bg-canvas-sunken">
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
        <h3 className="heading-lg mt-4 text-ink transition-colors duration-150 group-hover:text-gold-ink">{project.clientName}</h3>
        <p className="mt-2.5 text-[15px] leading-relaxed">{project.summary}</p>
        <Metrics metrics={project.metrics} lead={false} />
        {caseStudyLabel ? <CaseStudyLink project={project} label={caseStudyLabel} lead={false} /> : null}
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
            className="inline-flex h-10 cursor-pointer items-center bg-canvas-sunken px-4 text-[14.5px] font-semibold text-ink hover:bg-line has-checked:bg-navy-900 has-checked:text-ink-invert has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary"
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
    <section id="work" className="content-auto bg-canvas-raised py-20 lg:py-28">
      <div className="shell">
        <SectionHead link={work.link} className="mb-9">
          <h2 className={`${h2Dark} max-w-[20ch]`}>{work.heading}</h2>
          <p className="mt-4 max-w-[58ch] text-[17px] leading-relaxed">{work.intro}</p>
        </SectionHead>
        {projects.length === 0 ? (
          <EmptyNote>{work.empty}</EmptyNote>
        ) : (
          <>
            {filters.length > 1 ? <WorkFilters filters={filters} /> : null}
            <div className="grid gap-6 lg:grid-cols-2">
              {projects.map((project, index) =>
                index === 0 ? (
                  <LeadProject
                    key={project.slug}
                    project={project}
                    filterKey={filterKey(project)}
                    caseStudyLabel={work.caseStudyLabel}
                  />
                ) : (
                  <ProjectCard
                    key={project.slug}
                    project={project}
                    filterKey={filterKey(project)}
                    caseStudyLabel={work.caseStudyLabel}
                  />
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
    <section className="content-auto border-y border-hairline bg-canvas-raised py-16 lg:py-24">
      <div className="shell">
        <figure className="max-w-[46ch]" {...reveal()}>
          <blockquote className="display-quote text-ink">{`"${quote.quote}"`}</blockquote>
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
            <span className="body-sm">
              <b className="block text-ink">{quote.clientName}</b>
              {quoteByline ? <span className="text-ink-muted">{quoteByline}</span> : null}
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

export function MidCta({ midCta }: { midCta: Content['midCta'] }) {
  if (!midCta.enabled) return null;
  return (
    <section className="content-auto border-y border-hairline bg-canvas-raised py-14 lg:py-16">
      <div className="shell flex flex-wrap items-center justify-between gap-8">
        <div>
          <p className="text-[14px]">{midCta.eyebrow}</p>
          <h2 className="mt-2 font-display text-[28px] leading-tight font-extrabold text-ink lg:text-[36px]">
            {midCta.heading}
          </h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <ActionLink link={midCta.primaryCta} size="lg" />
          {midCta.secondaryCta ? (
            <a
              href={midCta.secondaryCta.href}
              className="inline-flex h-14 items-center border border-hairline px-7 text-[16px] font-semibold text-ink hover:border-ink hover:bg-canvas-raised"
            >
              {midCta.secondaryCta.label}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Width over height, when the picture says its size. */
function shapeOf(image: { width?: number | undefined; height?: number | undefined }): number | undefined {
  return image.width && image.height ? image.width / image.height : undefined;
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
    <section id="beforeafter" className="content-auto relative overflow-hidden bg-navy-900 py-20 text-ink-invert lg:py-28">
      <div className="absolute inset-0" aria-hidden="true">
        <BackdropImage image={beforeAfter.backgroundImage} className="opacity-[.16]" />
        <div className="absolute inset-0 bg-scrim-strong" />
      </div>
      <div className="shell relative grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4" {...reveal()}>
          <h2 className={h2Light}>{beforeAfter.heading}</h2>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-invert-muted">{beforeAfter.intro}</p>
          {comparison && comparison.metrics.length > 0 ? (
            <dl className="mt-8 space-y-4 border-t border-ink-invert/15 pt-7">
              {comparison.metrics.map((metric) => (
                <div key={metric.label} className="flex items-baseline justify-between gap-6">
                  <dt className="text-[14px] text-ink-invert-muted">{metric.label}</dt>
                  <dd className="font-display font-bold">
                    {metric.before} <span className="font-normal text-ink-invert-muted">to</span>{' '}
                    <span className="font-display font-bold text-gold-ink">{metric.after}</span>
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          {beforeAfter.cta ? <ActionLink link={beforeAfter.cta} tone="cream" className="mt-8" /> : null}
        </div>
        <div className="lg:col-span-8" {...reveal(1)}>
          {comparison ? (
            <BeforeAfterSlider
              before={frame(comparison.before)}
              after={frame(comparison.after)}
              clientName={comparison.clientName}
              aspectRatio={shapeOf(comparison.before)}
            />
          ) : (
            <EmptyNote tone="dark">
              {beforeAfter.empty}
            </EmptyNote>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * The industries grid: a card per sector with its photograph, its name, the line that says
 * what we do there and a link into its page.
 *
 * A grid rather than the stack of full-bleed bands the brand draws for this, at the
 * owner's request: seven bands ran the page long and gave each sector the same weight as a
 * hero. The cards keep the brand's rules — square corners, a rule instead of a border box
 * where one will do, the strong scrim over every photograph, and no shadow.
 */
export function IndustriesGrid({
  industries,
  items,
}: {
  industries: Content['industries'];
  items: Home['industries'];
}) {
  const { notListed } = industries;
  return (
    <section id="industries" className="content-auto bg-canvas py-20 lg:py-32">
      <div className="shell">
        <SectionHead link={industries.link} className="mb-12">
          <h2 className="display-lg max-w-[18ch] text-ink">{industries.heading}</h2>
          <p className="body-lg mt-4 max-w-[58ch] text-ink-muted">{industries.intro}</p>
        </SectionHead>

        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((industry, index) => (
            <li key={industry.slug} {...reveal(index)}>
              <a
                href={`/industries/${industry.slug}/`}
                className="group flex h-full flex-col border border-hairline transition-colors duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-hairline-strong hover:bg-canvas-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <div className="relative aspect-16/10 overflow-hidden bg-navy-900">
                  {industry.image ? (
                    <ResponsiveImage
                      src={industry.image.src}
                      alt={industry.image.alt}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      quality={50}
                      className="object-cover transition-transform duration-[1600ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:group-hover:scale-105"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-scrim" aria-hidden="true" />
                  <span className="meta absolute top-4 left-4 text-gold-500">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-6">
                  <h3 className="heading-lg text-ink transition-colors duration-150 group-hover:text-gold-ink">
                    {industry.name}
                  </h3>
                  {industry.line ? <p className="body-sm mt-2 text-ink-muted">{industry.line}</p> : null}
                  <span className="button-label mt-auto flex items-center gap-2 pt-5 text-gold-ink">
                    {industries.cardLinkLabel}
                    <ArrowIcon className="w-4 transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:group-hover:translate-x-1.5" />
                  </span>
                </div>
              </a>
            </li>
          ))}
        </ul>

        <div className="mt-12 border-t border-hairline-gold pt-8">
          <h3 className="heading-md text-ink">{notListed.heading}</h3>
          <p className="body-base mt-2 max-w-[58ch] text-ink-muted">{notListed.body}</p>
          <TextLink link={notListed.cta} className="mt-4 inline-block" />
        </div>
      </div>
    </section>
  );
}
