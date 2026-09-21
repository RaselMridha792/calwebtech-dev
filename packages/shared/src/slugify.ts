/**
 * A slug from a title: lowercase, words joined by hyphens, nothing else.
 *
 * A module of its own with **no zod import**, because the editor runs it in the browser as
 * someone types a name, and a value import from the barrel would drag every schema and zod
 * into that bundle (see auth-cookies.ts for the same reason and what it once cost).
 */
export function slugify(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
