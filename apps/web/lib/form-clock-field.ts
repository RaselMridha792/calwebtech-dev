/**
 * The field a form's open time travels in (components/forms/form-clock.tsx). A module of its
 * own, free of the shared barrel, so client forms and server actions both import it for free.
 */
export const FORM_ELAPSED_FIELD = 'formElapsedMs';

/** The field's value for a submission: a number of milliseconds, or nothing when it is empty. */
export function formElapsed(form: FormData): string | undefined {
  const value = form.get(FORM_ELAPSED_FIELD);
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}
