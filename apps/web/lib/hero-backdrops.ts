import type { DecorativeImage } from '@calwebtech/shared';

/**
 * The photograph behind the hero of each page that has no record of its own to carry one.
 *
 * A page backed by content — a service, an industry, pricing, a city — takes its backdrop
 * from that content. The pages here have no such record: the contact page, the FAQ, the
 * legal pages. They used to open on a flat colour, which the owner found plain.
 *
 * Every photograph is one the site already serves, and so one already chosen, licensed
 * under the Unsplash License and known to resolve. None is new: an invented photo id would
 * answer 404, and the hero's image is its LCP element, so a broken one costs the page its
 * largest paint as well as its picture. Each is picked for what the page is about.
 *
 * Kept in one place so a better photograph is a one-line change. Making them editable from
 * the dashboard comes with the content manager for singleton pages, which also owns the
 * copy these pages still take from their snapshots (docs/08-decisions.md, 47).
 */
function unsplash(id: string): DecorativeImage {
  return { src: `https://images.unsplash.com/${id}` };
}

export const HERO_BACKDROPS = {
  /** Two colleagues across a meeting table, one taking notes: what the call is. */
  consultation: unsplash('photo-1551836022-d5d88e9218df'),
  /** A small project team at shared desks: who answers the message. */
  contact: unsplash('photo-1556761175-b413da4baf72'),
  /** A team planning around a table covered in sticky notes. */
  faq: unsplash('photo-1552664730-d307ca884978'),
  /** Sacramento's Tower Bridge and downtown, the first office. */
  locations: unsplash('photo-1681342288049-3c20cf1da7d7'),
  /** The team reviewing a website build together. */
  services: unsplash('photo-1522071820081-009f0129c71c'),
  /** An open, bright office: the map of the whole site. */
  sitemap: unsplash('photo-1497366754035-f200968a6e72'),
  /** A team at work together: what happens after the form. */
  thankYou: unsplash('photo-1521737604893-d14cc237f11d'),
  /** A notebook and a laptop on a desk: definitions. */
  glossary: unsplash('photo-1499750310107-5fef28a66643'),
  /** Analytics on a laptop beside handwritten figures: guides that plan. */
  guides: unsplash('photo-1460925895917-afdab827c52f'),
  /** Paperwork and a pen at a desk: terms, privacy, security. */
  legal: unsplash('photo-1450101499163-c8848c66ca85'),
  /** A developer reading code across two monitors: a case study, when it has no image. */
  work: unsplash('photo-1581094794329-c8112a89af12'),
} as const satisfies Record<string, DecorativeImage>;
