/**
 * The API's field errors in the words of someone filling in a form (docs/08-decisions.md, 70).
 *
 * Zod answers an empty or overlong field in its own terms ("Too small: expected string to
 * have >=1 characters"), and often beside a schema's own message for the same field. A
 * schema's own message says what to do, so where a field has one, only those are shown; the
 * rest are translated. Plain and free of the shared package, so a client form can use it.
 */
const GENERIC = /^(Too small|Too big|Invalid input)/;

export function plainMessage(message: string): string {
  if (/expected string to have >=1 characters/.test(message)) return 'This cannot be empty.';
  const longest = /expected string to have <=(\d+) characters/.exec(message);
  if (longest) return `Keep this to ${longest[1] ?? ''} characters or fewer.`;
  if (/expected number to be >0/.test(message)) return 'A whole number above 0.';
  const most = /expected array to have <=(\d+) items/.exec(message);
  if (most) return `This takes at most ${most[1] ?? ''}.`;
  if (/expected number/.test(message)) return 'A whole number.';
  return message;
}

export function plainErrors(errors: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(errors).map(([path, messages]) => {
      const own = messages.filter((message) => !GENERIC.test(message));
      return [path, [...new Set((own.length > 0 ? own : messages).map(plainMessage))]];
    }),
  );
}
