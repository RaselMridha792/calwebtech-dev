/**
 * The "last updated" date shown on a guide and on a glossary term. It lives in its own
 * module so the glossary pages can use it without importing `guide-page`, which would drag
 * the download gate's client component onto routes that have no form (docs/09-performance.md).
 */
export function formatUpdated(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(iso),
  );
}
