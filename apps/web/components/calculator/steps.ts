import {
  CALCULATOR_MULTI_SELECT_STEPS,
  CALCULATOR_NO_INTEGRATIONS,
  CALCULATOR_OPTIONS,
  CALCULATOR_STEP_KEYS,
} from '@calwebtech/shared';
import type { CalculatorCopy, CalculatorStepView } from './types';

/**
 * The eight questions in the order they are answered, each with the stored answer values
 * from the pricing model and the words from the page's copy.
 *
 * Built on the server and passed to the client component as plain data, so the browser
 * never loads the model or the schemas to draw a list of radio buttons.
 */
export function calculatorSteps(copy: CalculatorCopy): CalculatorStepView[] {
  return CALCULATOR_STEP_KEYS.map((key) => {
    const step = copy.steps[key];
    const options: Record<string, { label: string; description: string | null }> = step.options;
    return {
      key,
      title: step.title,
      question: step.question,
      help: step.help,
      multiple: CALCULATOR_MULTI_SELECT_STEPS.includes(key),
      exclusiveOption: key === 'integrations' ? CALCULATOR_NO_INTEGRATIONS : null,
      options: CALCULATOR_OPTIONS[key].map((value) => ({
        value,
        label: options[value]?.label ?? value,
        description: options[value]?.description ?? null,
      })),
    };
  });
}
