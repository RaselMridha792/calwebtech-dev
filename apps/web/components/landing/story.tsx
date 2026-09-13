import type { LandingPageView } from '@calwebtech/shared';
import { reveal } from '../ui/primitives';
import { ResponsiveImage } from '../ui/responsive-image';

type Content = LandingPageView['content'];

const h2 = 'font-display text-[32px] leading-[1.1] font-extrabold text-ink lg:text-[42px]';

export function ProblemSection({ problem }: { problem: Content['problem'] }) {
  return (
    <section className="content-auto relative overflow-hidden bg-linear-to-b from-mist2 via-mist to-mist2 py-20 lg:py-24">
      <div className="grid-lines absolute inset-0 opacity-70" aria-hidden="true" />
      <div className="shell-narrow relative">
        <div className="max-w-[62ch]" {...reveal()}>
          <h2 className={h2}>{problem.heading}</h2>
          <p className="mt-5 text-[17px] leading-relaxed">{problem.intro}</p>
        </div>
        {problem.cards.length > 0 ? (
          <ul className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {problem.cards.map((card, index) => (
              <li
                key={card.figure}
                className="lift rounded-2xl border border-line bg-white p-6"
                {...reveal(index)}
              >
                <p className="font-display text-[30px] leading-none font-extrabold text-ink">
                  {card.figure}
                </p>
                <p className="mt-3 text-[15px] leading-relaxed">{card.body}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

export function SolutionSection({ solution }: { solution: Content['solution'] }) {
  return (
    <section className="content-auto bg-white py-20 lg:py-28">
      <div className="shell-narrow grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
        <div className={solution.image ? 'order-2 lg:order-1 lg:col-span-6' : 'lg:col-span-8'}>
          <h2 className={`${h2} max-w-[18ch]`} {...reveal()}>
            {solution.heading}
          </h2>
          <ol className="mt-9 space-y-8">
            {solution.steps.map((step, index) => (
              <li key={step.title} className="flex gap-5" {...reveal(index)}>
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink font-display font-bold text-white"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-display text-[19px] font-bold text-ink">{step.title}</h3>
                  <p className="mt-2 text-[15.5px] leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        {solution.image ? (
          <div className="order-1 lg:order-2 lg:col-span-6" {...reveal(1)}>
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-media ring-1 ring-line">
              <ResponsiveImage
                src={solution.image.src}
                alt={solution.image.alt}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function ServicesSection({ services }: { services: Content['services'] }) {
  return (
    <section className="content-auto relative overflow-hidden border-y border-line bg-linear-to-br from-white via-mist2 to-mist py-20 lg:py-28">
      <div
        className="absolute -top-40 right-0 h-[520px] w-[520px] rounded-full bg-primary/[.08] blur-3xl"
        aria-hidden="true"
      />
      <div className="shell-narrow relative">
        <div className="max-w-[60ch]" {...reveal()}>
          <h2 className={h2}>{services.heading}</h2>
          <p className="mt-5 text-[17px] leading-relaxed">{services.intro}</p>
        </div>
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.items.map((item, index) => (
            <li
              key={item.title}
              className="lift rounded-2xl border border-line bg-white p-7"
              {...reveal(index)}
            >
              <h3 className="font-display text-[19px] font-bold text-ink">{item.title}</h3>
              <p className="mt-2.5 text-[15px] leading-relaxed">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
