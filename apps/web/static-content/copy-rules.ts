/**
 * Snapshots ship to a URL anyone can open, so their copy is publish-ready: no placeholder
 * words and no empty text (owner's decision, 2026-09-14; docs/10-site-pages.md, Content).
 * Every family's snapshot test runs `unfinishedCopy` over each of its views.
 */
const UNFINISHED = /\b(placeholder|lorem|ipsum|tbd|tba|todo|coming soon|to confirm|to be confirmed|dummy text|sample text)\b/i;

/** Values that are not copy: identifiers, addresses of files and links. Alt text may describe a mock-up. */
const NOT_COPY = new Set(['id', 'slug', 'href', 'src', 'alt', 'videoUrl', 'fileUrl', 'ogImage', 'updatedAt', 'icon', 'suffix']);

/** Paths to strings that are empty or read as unfinished, e.g. `$.hero.intro: "Placeholder"`. */
export function unfinishedCopy(value: unknown, path = '$'): string[] {
  if (typeof value === 'string') {
    if (value.trim() === '') return [`${path} is empty`];
    return UNFINISHED.test(value) ? [`${path}: "${value}"`] : [];
  }
  if (Array.isArray(value)) return value.flatMap((item, index) => unfinishedCopy(item, `${path}[${String(index)}]`));
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, item]) => (NOT_COPY.has(key) ? [] : unfinishedCopy(item, `${path}.${key}`)));
  }
  return [];
}
