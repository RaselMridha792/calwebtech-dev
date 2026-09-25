'use client';
import { useEffect, useRef } from 'react';
import { FORM_ELAPSED_FIELD } from '@/lib/form-clock-field';

/**
 * How long the form has been open, sent with it as `formElapsedMs` (docs/08-decisions.md, 61).
 * The API refuses a form sent faster than a person could fill it, as a failed bot check the
 * person can simply retry.
 *
 * Measured from the form appearing with `performance.now()`, so the visitor's clock being
 * wrong changes nothing. The value is written just before it is read — on submit, and on the
 * click or key that a multi-step form sends from — so it is current whichever way the form
 * builds its payload. Without script it stays empty and the API skips the check.
 */
export function FormClock() {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = ref.current;
    const form = input?.form;
    if (!input || !form) return;
    const started = performance.now();
    const stamp = (): void => {
      input.value = String(Math.round(performance.now() - started));
    };
    const events = ['submit', 'click', 'keydown'] as const;
    for (const type of events) form.addEventListener(type, stamp, true);
    return () => {
      for (const type of events) form.removeEventListener(type, stamp, true);
    };
  }, []);

  return <input ref={ref} type="hidden" name={FORM_ELAPSED_FIELD} defaultValue="" />;
}
