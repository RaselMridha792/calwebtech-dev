import type { FinalPointIcon, HomePageContent, HomePageView } from '@calwebtech/shared';
import type { ReactNode } from 'react';
import { CalendarIcon, ShieldIcon, TickIcon } from '../ui/icons';
import { PillBadge, Stars, reveal } from '../ui/primitives';
import { ResponsiveImage } from '../ui/responsive-image';
import { EmptyNote, byline, h2Dark, h2Light } from './parts';

type Content = HomePageContent;
type Home = HomePageView;

/**
 * The cost estimate band. Until the calculator ships (Task 4.1) the card is a static
 * preview of its first question, and the call to action goes to a person.
 */
export function EstimateBand({ estimate }: { estimate: Content['estimate'] }) {
  const { preview } = estimate;
  return (
    <section id="estimate" className="content-auto band-gradient relative overflow-hidden py-20 text-white lg:py-24">
      <div className="absolute inset-0" aria-hidden="true">
        <div className="grid-lines-light absolute inset-0" />
        <div className="absolute -bottom-40 -left-20 h-[560px] w-[560px] rounded-full bg-glow-teal-25 blur-3xl" />
      </div>
      <div className="shell relative grid items-center gap-12 lg:grid-cols-12">
        <div className="lg:col-span-6" {...reveal()}>
          <PillBadge>{estimate.badge}</PillBadge>
          <h2 className="mt-6 font-display text-[34px] leading-[1.06] font-extrabold lg:text-[46px]">{estimate.heading}</h2>
          <p className="mt-6 max-w-[54ch] text-[17px] leading-relaxed text-white/75">{estimate.intro}</p>
          {estimate.bullets.length > 0 ? (
            <ul className="mt-8 space-y-3 text-[15.5px] text-white/85">
              {estimate.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-result" aria-hidden="true" />
                  {bullet}
                </li>
              ))}
            </ul>
          ) : null}
          <a
            href={estimate.cta.href}
            className="mt-9 inline-flex h-14 items-center rounded-xl bg-white px-7 font-semibold text-ink hover:bg-mist"
          >
            {estimate.cta.label}
          </a>
        </div>
        <figure className="lg:col-span-6" {...reveal(1)}>
          <div className="rounded-2xl border border-line bg-white p-7 text-ink shadow-panel sm:p-9">
            <p className="text-[13.5px] font-semibold">{preview.progressLabel}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-mist" aria-hidden="true">
              <span className="block h-full w-[37.5%] rounded-full bg-primary" />
            </div>
            <p className="mt-7 font-display text-[22px] leading-snug font-bold">{preview.question}</p>
            <ul className="mt-5 space-y-3">
              {preview.options.map((option, index) => (
                <li
                  key={option}
                  className={`flex h-14 items-center gap-3 rounded-xl px-5 text-[15.5px] ${index === 1 ? 'border-2 border-primary bg-primary/5 font-semibold' : 'border border-line'}`}
                >
                  <span
                    className={`h-4 w-4 shrink-0 rounded-full border-2 ${index === 1 ? 'border-[5px] border-primary' : 'border-line'}`}
                    aria-hidden="true"
                  />
                  {option}
                </li>
              ))}
            </ul>
          </div>
          <figcaption className="sr-only">A preview of the questions in the cost estimate</figcaption>
        </figure>
      </div>
    </section>
  );
}

export function WhyUs({ whyUs }: { whyUs: Content['whyUs'] }) {
  if (whyUs.items.length === 0) return null;
  return (
    <section className="content-auto bg-white py-20 lg:py-28">
      <div className="shell">
        <h2 className={`${h2Dark} max-w-[20ch]`} {...reveal()}>
          {whyUs.heading}
        </h2>
        <ul className="mt-12 grid gap-x-12 gap-y-11 md:grid-cols-2 lg:grid-cols-3">
          {whyUs.items.map((item, index) => (
            <li key={item.title} {...reveal(index)}>
              <h3 className="font-display text-[19px] font-bold text-ink">{item.title}</h3>
              <p className="mt-2.5 text-[15.5px] leading-relaxed">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function TechnologyProof({
  technology,
  groups,
}: {
  technology: Content['technology'];
  groups: Home['technologyGroups'];
}) {
  return (
    <section
      id="tech"
      className="content-auto relative overflow-hidden border-y border-line bg-linear-to-br from-white via-mist2 to-mist py-20 lg:py-28"
    >
      <div className="grid-lines absolute inset-0 opacity-60" aria-hidden="true" />
      <div className="absolute -bottom-40 -left-32 h-[600px] w-[600px] rounded-full bg-glow-teal-8 blur-3xl" aria-hidden="true" />
      <div className="absolute -top-40 right-0 h-[520px] w-[520px] rounded-full bg-primary/8 blur-3xl" aria-hidden="true" />
      <div className="shell relative grid gap-12 lg:grid-cols-12 lg:gap-20">
        <div className="lg:col-span-5" {...reveal()}>
          <h2 className={h2Dark}>{technology.heading}</h2>
          <p className="mt-5 text-[17px] leading-relaxed">{technology.intro}</p>
        </div>
        <div className="lg:col-span-7" {...reveal(1)}>
          {groups.length > 0 ? (
            <ul className="grid gap-5 sm:grid-cols-2">
              {groups.map((group) => (
                <li key={group.category} className="rounded-2xl border border-line bg-white p-6">
                  <h3 className="font-display text-[17px] font-bold text-ink">{group.category}</h3>
                  <p className="mt-3 text-[14.5px] leading-relaxed">{group.names.join(', ')}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyNote className="">{technology.empty}</EmptyNote>
          )}
        </div>
      </div>
    </section>
  );
}

export function ProcessTimeline({ process, steps }: { process: Content['process']; steps: Home['processSteps'] }) {
  return (
    <section id="process" className="content-auto bg-white py-20 lg:py-28">
      <div className="shell">
        <div className="mb-14" {...reveal()}>
          <h2 className={`${h2Dark} max-w-[18ch]`}>{process.heading}</h2>
          <p className="mt-4 max-w-[58ch] text-[17px] leading-relaxed">{process.intro}</p>
        </div>
        {steps.length > 0 ? (
          <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className={`border-t-2 pt-5 ${index === 0 ? 'border-ink' : 'border-line'}`}
                {...reveal(index)}
              >
                <p className="font-display text-[15px] font-extrabold text-ink">Step {index + 1}</p>
                <h3 className="mt-1.5 font-display text-[19px] font-bold text-ink">{step.title}</h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed">{step.summary}</p>
                <p className="mt-3 text-[13px]">{step.timing}</p>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}

export function TestimonialsBand({
  testimonials,
  items,
  reviews,
}: {
  testimonials: Content['testimonials'];
  items: Home['testimonials'];
  reviews: Home['reviews'];
}) {
  const summary = [
    ...reviews.sources.slice(0, 2).map((source) => ({ value: source.rating.toFixed(1), label: source.platform })),
    ...(reviews.npsScore !== null ? [{ value: reviews.npsScore.toFixed(1), label: 'NPS' }] : []),
  ];
  return (
    <section id="testimonials" className="content-auto relative overflow-hidden bg-ink py-20 text-white lg:py-28">
      <div className="absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-linear-to-b from-ink/95 via-ink/90 to-ink" />
        <div className="glow-teal absolute inset-0" />
      </div>
      <div className="shell relative">
        <div className="flex flex-wrap items-end justify-between gap-6" {...reveal()}>
          <h2 className={`${h2Light} max-w-[18ch]`}>{testimonials.heading}</h2>
          {summary.length > 0 ? (
            <dl className="flex items-center gap-7 text-[14px]">
              {summary.map((item) => (
                <div key={item.label} className="flex flex-row-reverse items-baseline gap-1.5">
                  <dt className="text-white/70">{item.label}</dt>
                  <dd className="font-display text-[26px] font-extrabold">{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        {items.length === 0 ? (
          <EmptyNote tone="dark">{testimonials.empty}</EmptyNote>
        ) : (
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {items.map((item, index) => {
              const itemByline = byline(item.role, item.company);
              return (
                <figure key={item.id} className="glass rounded-2xl p-7" {...reveal(index)}>
                  <Stars rating={item.rating} className="text-[15px]" />
                  <blockquote className="mt-4 text-[16px] leading-relaxed">{`"${item.quote}"`}</blockquote>
                  <figcaption className="mt-6 flex items-center gap-3 border-t border-white/10 pt-5">
                    {item.avatar ? (
                      <ResponsiveImage
                        src={item.avatar.src}
                        alt=""
                        width={44}
                        height={44}
                        sizes="44px"
                        className="h-11 w-11 rounded-full object-cover"
                      />
                    ) : null}
                    <span className="text-[14px]">
                      <b className="block">{item.clientName}</b>
                      {itemByline ? <span className="text-white/70">{itemByline}</span> : null}
                    </span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function RecognitionTab({ id, label, checked = false }: { id: string; label: string; checked?: boolean }) {
  return (
    <label className="inline-flex h-11 cursor-pointer items-center rounded-lg border border-line bg-white px-5 text-[14.5px] font-semibold text-ink hover:border-ink has-checked:border-ink has-checked:bg-ink has-checked:text-white has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary">
      <input type="radio" name="recognition" id={id} defaultChecked={checked} className="sr-only" />
      {label}
    </label>
  );
}

/**
 * Awards and expertise as tabs built from native radio buttons: arrow keys switch them
 * and `:has()` shows the chosen pane, with no script. Each pane shows its own empty state.
 */
export function Recognition({
  recognition,
  awards,
  expertise,
}: {
  recognition: Content['recognition'];
  awards: Home['awards'];
  expertise: Home['expertise'];
}) {
  return (
    <section id="awards" className="content-auto group/recognition border-b border-line bg-mist2 py-20 lg:py-24">
      <div className="shell">
        <div {...reveal()}>
          <p className="text-[14px]">{recognition.eyebrow}</p>
          <h2 className="mt-2 font-display text-[30px] leading-[1.1] font-extrabold text-ink lg:text-[38px]">
            {recognition.heading}
          </h2>
        </div>
        <fieldset className="mt-9">
          <legend className="sr-only">Show</legend>
          <div className="flex flex-wrap gap-2">
            <RecognitionTab id="recognition-awards" label="Awards" checked />
            <RecognitionTab id="recognition-expertise" label="Expertise" />
          </div>
        </fieldset>
        <div data-pane="awards" className="mt-8 group-has-[#recognition-expertise:checked]/recognition:hidden">
          {awards.length > 0 ? (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {awards.map((award) => (
                <li key={`${award.name}${award.detail ?? ''}`} className="rounded-2xl border border-line bg-white p-6">
                  <p className="font-display text-[16px] font-bold text-ink">{award.name}</p>
                  {award.detail ? <p className="mt-2 text-[14px] leading-relaxed">{award.detail}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyNote className="">{recognition.empty}</EmptyNote>
          )}
        </div>
        <div data-pane="expertise" className="mt-8 hidden group-has-[#recognition-expertise:checked]/recognition:block">
          {expertise.length > 0 ? (
            <ul className="flex flex-wrap gap-2.5 rounded-2xl border border-line bg-white p-8">
              {expertise.map((item) => (
                <li key={item} className="rounded-lg bg-mist px-4 py-2 text-[14px] font-medium text-ink">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyNote className="">{recognition.empty}</EmptyNote>
          )}
        </div>
      </div>
    </section>
  );
}

export function Insights({ insights, posts }: { insights: Content['insights']; posts: Home['posts'] }) {
  return (
    <section id="insights" className="content-auto bg-white py-20 lg:py-28">
      <div className="shell">
        <h2 className={`${h2Dark} mb-12`} {...reveal()}>
          {insights.heading}
        </h2>
        {posts.length > 0 ? (
          <ul className="grid gap-6 md:grid-cols-3">
            {posts.map((post, index) => {
              const meta = [post.category, post.readingTime ? `${String(post.readingTime)} min read` : null]
                .filter((part): part is string => Boolean(part))
                .join(' · ');
              return (
                <li key={post.slug} className="rounded-2xl border border-line bg-white p-6" {...reveal(index)}>
                  {meta ? <p className="text-[13px]">{meta}</p> : null}
                  <h3 className="mt-2 font-display text-[19px] leading-snug font-bold text-ink">{post.title}</h3>
                  <p className="mt-2.5 text-[14.5px] leading-relaxed">{post.excerpt}</p>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyNote className="">{insights.empty}</EmptyNote>
        )}
      </div>
    </section>
  );
}

/** The featured guide. Nothing links here, so it renders nothing until a guide is published. */
export function Whitepaper({ whitepaper, guide }: { whitepaper: Content['whitepaper']; guide: Home['guide'] }) {
  if (!guide) return null;
  return (
    <section className="content-auto band-gradient relative overflow-hidden py-16 text-white lg:py-20">
      <div className="grid-lines-light absolute inset-0" aria-hidden="true" />
      <div className="absolute -right-20 -bottom-40 h-[520px] w-[520px] rounded-full bg-glow-teal-20 blur-3xl" aria-hidden="true" />
      <div className="shell relative" {...reveal()}>
        <p className="text-[15px] text-white/70">{whitepaper.eyebrow}</p>
        <h2 className="mt-2 max-w-[22ch] font-display text-[28px] leading-[1.12] font-extrabold lg:text-[38px]">
          {guide.title}
        </h2>
        <p className="mt-4 max-w-[56ch] text-[16.5px] leading-relaxed text-white/75">{guide.summary}</p>
        <a
          href={guide.fileUrl}
          className="mt-7 inline-flex h-14 items-center rounded-xl bg-white px-7 font-semibold text-ink hover:bg-mist"
        >
          {whitepaper.ctaLabel}
        </a>
      </div>
    </section>
  );
}

export function Locations({ locations, items }: { locations: Content['locations']; items: Home['locations'] }) {
  return (
    <section id="locations" className="content-auto bg-white py-20 lg:py-28">
      <div className="shell">
        <div className="max-w-[62ch]" {...reveal()}>
          <h2 className={h2Dark}>{locations.heading}</h2>
          <p className="mt-5 text-[17px] leading-relaxed">{locations.intro}</p>
        </div>
        {items.length > 0 ? (
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((location, index) => (
              <li key={location.slug} className="rounded-2xl border border-line p-6" {...reveal(index)}>
                <h3 className="font-display text-[20px] font-bold text-ink">
                  {[location.city, location.state].filter(Boolean).join(', ')}
                </h3>
                {location.serviceArea ? (
                  <p className="mt-2.5 text-[14.5px] leading-relaxed">{location.serviceArea}</p>
                ) : null}
                {location.address ? (
                  <p className="mt-4 border-t border-line pt-4 text-[14px] whitespace-pre-line">{location.address}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyNote>{locations.empty}</EmptyNote>
        )}
      </div>
    </section>
  );
}

/** Published engagement shapes. The highlighted tier gets a stronger border and no label. */
export function PricingBands({ pricing, tiers }: { pricing: Content['pricing']; tiers: Home['pricingTiers'] }) {
  return (
    <section
      id="pricing"
      className="content-auto relative overflow-hidden border-t border-line bg-linear-to-b from-mist2 to-white py-20 lg:py-28"
    >
      <div className="absolute -top-28 -right-20 h-[480px] w-[480px] rounded-full bg-glow-teal-8 blur-3xl" aria-hidden="true" />
      <div className="shell relative grid gap-12 lg:grid-cols-12 lg:gap-20">
        <div className="lg:col-span-5" {...reveal()}>
          <h2 className={h2Dark}>{pricing.heading}</h2>
          <p className="mt-5 text-[17px] leading-relaxed">{pricing.intro}</p>
          <a
            href={pricing.cta.href}
            className="mt-7 inline-flex h-12 items-center rounded-lg bg-ink px-6 font-semibold text-white hover:bg-ink2"
          >
            {pricing.cta.label}
          </a>
        </div>
        {tiers.length > 0 ? (
          <ul className="grid gap-5 sm:grid-cols-3 lg:col-span-7">
            {tiers.map((tier, index) => (
              <li
                key={tier.name}
                className={`rounded-2xl p-6 ${tier.highlighted ? 'border-2 border-ink' : 'border border-line'}`}
                {...reveal(index)}
              >
                <h3 className="font-display text-[17px] font-bold text-ink">{tier.name}</h3>
                <p className="mt-3 font-display text-[26px] leading-tight font-extrabold text-ink">{tier.priceLabel}</p>
                <p className="mt-3 text-[14px] leading-relaxed">{tier.summary}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

const POINT_ICONS: Record<FinalPointIcon, ReactNode> = {
  check: <TickIcon className="h-4 w-4" />,
  shield: <ShieldIcon className="h-4 w-4" />,
  calendar: <CalendarIcon className="h-4 w-4" />,
};

export function BookSection({ book, form }: { book: Content['book']; form: ReactNode }) {
  return (
    <section id="book" className="content-auto relative overflow-hidden border-t border-line bg-mist py-20 lg:py-28">
      <div className="absolute -top-24 left-1/3 h-[520px] w-[520px] rounded-full bg-primary/9 blur-3xl" aria-hidden="true" />
      <div className="shell relative grid items-start gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5" {...reveal()}>
          <h2 className="font-display text-[34px] leading-[1.08] font-extrabold text-ink lg:text-[44px]">{book.heading}</h2>
          <p className="mt-5 max-w-[48ch] text-[17px] leading-relaxed">{book.intro}</p>
          {book.points.length > 0 ? (
            <ul className="mt-9 space-y-5 border-t border-line pt-8">
              {book.points.map((point) => (
                <li key={point.title} className="flex gap-4">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line bg-white text-ink"
                    aria-hidden="true"
                  >
                    {POINT_ICONS[point.icon]}
                  </span>
                  <span>
                    <b className="block text-ink">{point.title}</b>
                    <span className="text-[14.5px]">{point.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="lg:col-span-7">{form}</div>
      </div>
    </section>
  );
}
