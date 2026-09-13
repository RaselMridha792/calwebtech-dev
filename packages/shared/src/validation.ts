import { z } from 'zod';

/** Field-level messages keyed by input name, as returned by the API. */
export type FieldErrors = Record<string, string[] | undefined>;

export const validationErrorResponseSchema = z.object({
  error: z.literal('validation_failed'),
  fieldErrors: z.record(z.string(), z.array(z.string())),
});
export type ValidationErrorResponse = z.infer<typeof validationErrorResponseSchema>;

export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join('.') : '_form';
    (result[key] ??= []).push(issue.message);
  }
  return result;
}
