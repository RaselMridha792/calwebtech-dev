const FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** A publish or update date as the articles write them: "3 September 2026". */
export function formatArticleDate(iso: string): string {
  return FORMAT.format(new Date(iso));
}

/** Whether an article has changed since it was published, to the day. */
export function wasUpdated(publishedAt: string, updatedAt: string): boolean {
  return updatedAt.slice(0, 10) > publishedAt.slice(0, 10);
}
