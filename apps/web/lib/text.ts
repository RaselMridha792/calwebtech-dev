/** "Role, Company" when either is known. */
export function byline(role: string | null, company: string | null): string {
  return [role, company].filter((part): part is string => Boolean(part)).join(', ');
}

/**
 * A metric label as it reads after a client name or figure: "Quote requests" becomes
 * "quote requests", while "WCAG 2.2 verified" and "AA" keep their capitals.
 */
export function asPhrase(label: string): string {
  return /^[A-Z][a-z]/.test(label) ? `${label.charAt(0).toLowerCase()}${label.slice(1)}` : label;
}
