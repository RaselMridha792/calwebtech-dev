import { CALCULATOR_ANCHORS, type CalculatorPageView } from '@calwebtech/shared';
import { Section } from '../site/section';
import { SectionHeading } from '../site/section-heading';
import { reveal } from '../ui/primitives';
import { CalculatorLoader } from './calculator-loader';
import { calculatorSteps } from './steps';
import type { CalculatorStepView } from './types';

/**
 * The calculator's section: the heading and introduction on the server, then the tool.
 *
 * The card below is what the server renders and what a visitor sees first: the first
 * question, exactly as the calculator will draw it. The tool replaces it as soon as its
 * chunk arrives, so there is nothing to shift. Without JavaScript the card stays and says so.
 */
export function CalculatorSection({
  view,
  permalink,
  turnstileSiteKey,
}: {
  view: CalculatorPageView;
  permalink: string;
  turnstileSiteKey?: string;
}) {
  const copy = view.content.calculator;
  const steps = calculatorSteps(copy);
  const first = steps[0];
  const headingId = 'calculator-heading';

  return (
    <Section id={CALCULATOR_ANCHORS.tool} tone="tint" labelledBy={headingId} deferred={false}>
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <SectionHeading id={headingId} title={copy.heading} intro={copy.intro} className="mb-8" />
          <noscript>
            <p className="max-w-[46ch] border border-hairline bg-canvas-raised p-5 text-[15px] leading-relaxed">
              {copy.labels.noScript}
            </p>
          </noscript>
        </div>
        <div className="lg:col-span-7" {...reveal(1)}>
          <CalculatorLoader
            copy={copy}
            steps={steps}
            events={view.events}
            permalink={permalink}
            {...(turnstileSiteKey ? { turnstileSiteKey } : {})}
          >
            <FirstQuestionCard copy={copy} step={first} total={steps.length} />
          </CalculatorLoader>
        </div>
      </div>
    </Section>
  );
}

/**
 * The first question as HTML, before any script runs. It is a picture of the step, not a
 * form: nothing here could be submitted, so it never promises something the page cannot do.
 * A browser without JavaScript hides the button (the `noscript` rule below) and reads the
 * explanation beside it instead.
 */
function FirstQuestionCard({
  copy,
  step,
  total,
}: {
  copy: CalculatorPageView['content']['calculator'];
  step: CalculatorStepView | undefined;
  total: number;
}) {
  if (!step) return null;
  const progress = copy.labels.progress.replace('{current}', '1').replace('{total}', String(total));
  const timeLeft = copy.labels.timeLeft.replace('{minutes}', String(Math.round((total * copy.secondsPerStep) / 60)));

  return (
    <div className="border border-hairline bg-canvas-raised p-6 text-ink sm:p-9">
      {/* Without script the start button could do nothing, so it is not shown. */}
      <noscript dangerouslySetInnerHTML={{ __html: '<style>[data-calculator-start]{display:none}</style>' }} />
      <div className="flex items-center justify-between gap-4 text-[13.5px]">
        <p className="font-semibold">{progress}</p>
        <p className="text-ink-muted">{timeLeft}</p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-canvas-sunken" aria-hidden="true">
        <span className="block h-full rounded-full bg-navy-900" style={{ width: `${String(Math.round(100 / (total + 1)))}%` }} />
      </div>

      <p className="mt-7 font-display text-[22px] leading-snug font-bold">{step.question}</p>
      {step.help ? <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">{step.help}</p> : null}
      <ul className="mt-6 space-y-3">
        {step.options.map((option) => (
          <li
            key={option.value}
            className="flex items-start gap-3.5 border border-hairline px-5 py-3.5 text-[15.5px]"
          >
            <span className="mt-1 h-4 w-4 shrink-0 rounded-full border-2 border-hairline" aria-hidden="true" />
            <span className="min-h-6">
              {option.label}
              {option.description ? (
                <span className="mt-1 block text-[14px] leading-relaxed text-ink-muted">{option.description}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <p data-calculator-start="" className="mt-7">
        <button
          type="button"
          className="inline-flex h-12 items-center justify-center bg-navy-900 px-6 text-[15.5px] font-semibold text-ink-invert hover:bg-navy-700"
        >
          {copy.labels.start}
        </button>
      </p>
    </div>
  );
}
