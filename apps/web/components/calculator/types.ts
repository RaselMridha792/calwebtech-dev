import type { CalculatorEvents, CalculatorPageView } from '@calwebtech/shared';

/**
 * What the calculator's client components receive. The page builds all of it on the server
 * (steps.ts), so the browser bundle carries no schemas, no pricing model and no copy rules:
 * only the words and the values for this page. Types only, so nothing here ships.
 */

export type CalculatorCopy = CalculatorPageView['content']['calculator'];

export interface CalculatorOptionView {
  value: string;
  label: string;
  description: string | null;
}

export interface CalculatorStepView {
  /** The stored answer key, e.g. `pageCount`. */
  key: string;
  /** Short name of the question, used in the breakdown. */
  title: string;
  question: string;
  help: string | null;
  /** True when more than one answer may be chosen. */
  multiple: boolean;
  /** The answer that stands alone, such as "none of these"; null when there is none. */
  exclusiveOption: string | null;
  options: CalculatorOptionView[];
}

export interface CalculatorViewProps {
  copy: CalculatorCopy;
  steps: CalculatorStepView[];
  events: CalculatorEvents;
  /** The page's own URL, so the email step still posts before hydration. */
  permalink: string;
  /** Cloudflare Turnstile site key; without one the API refuses the submission. */
  turnstileSiteKey?: string;
}
