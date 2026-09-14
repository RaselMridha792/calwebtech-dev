import {
  SERVICE_CASE_STUDY_LIMIT,
  SERVICE_ENQUIRY_ANCHOR,
  answerBlockSchema,
  serviceDetailViewSchema,
  servicesIndexViewSchema,
  type ServiceDetailView,
} from '@calwebtech/shared';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { unfinishedCopy } from '../copy-rules';
import home from '../home.json';
import landing from '../landing-b2b-website-design.json';
import { serviceSnapshot, serviceSnapshots, servicesIndexSnapshot } from './index';

const LAUNCH_SLUGS = [
  'custom-website-development',
  'website-redesign',
  'web-application-development',
  'ecommerce-development',
  'nextjs-development',
  'wordpress-development',
  'shopify-development',
  'ai-search-visibility',
  'ai-integration',
  'care-plans',
];

const details: [string, ServiceDetailView][] = Object.entries(serviceSnapshots).map(([slug, view]) => [
  slug,
  serviceDetailViewSchema.parse(view),
]);
const index = servicesIndexViewSchema.parse(servicesIndexSnapshot);

/**
 * A sibling family's snapshot, or null while it is not on this branch. The work family's
 * case study links (Project.services) and the industries family's lines (Industry.heroCopy)
 * are the same records the service pages read, so once the families are merged the checks
 * below hold every page to one answer.
 */
function siblingSnapshot<T>(file: string, schema: z.ZodType<T>): T | null {
  const path = join(import.meta.dirname, '..', file);
  return existsSync(path) ? schema.parse(JSON.parse(readFileSync(path, 'utf8'))) : null;
}

const workIndex = siblingSnapshot(
  'work/index.json',
  z.object({ caseStudies: z.array(z.object({ slug: z.string(), services: z.array(z.string()) })) }),
);
const industriesIndex = siblingSnapshot(
  'industries/index.json',
  z.object({ industries: z.array(z.object({ slug: z.string(), name: z.string(), line: z.string().nullable() })) }),
);

/** Every string anywhere in a view, for the proof checks. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(strings);
  return [];
}

describe('services snapshots', () => {
  it('hold the ten launch services, one file per view, each named after its slug', () => {
    expect(Object.keys(serviceSnapshots).sort()).toEqual([...LAUNCH_SLUGS].sort());
    const files = readdirSync(import.meta.dirname).filter((file) => file.endsWith('.json'));
    expect(files.sort()).toEqual(['index.json', ...LAUNCH_SLUGS.map((slug) => `${slug}.json`)].sort());
    for (const [key, view] of details) expect(view.slug, `${key}.json`).toBe(key);
  });

  it('list every detail snapshot on the index, and nothing else, grouped by category', () => {
    const listed = index.groups.flatMap((group) => group.services.map((service) => service.slug));
    expect([...listed].sort()).toEqual([...LAUNCH_SLUGS].sort());
    expect(index.groups.map((group) => group.name)).toEqual(['Design & build', 'Platforms', 'Growth & care']);
    // The API takes each heading from the copy, so the copy holds one for every category shown.
    for (const group of index.groups) {
      const copy = group.slug === null ? index.content.otherGroupHeading : index.content.groupHeadings[group.slug];
      expect(group.heading, group.name).toBe(copy);
    }
    for (const group of index.groups) {
      for (const card of group.services) {
        const view = details.find(([slug]) => slug === card.slug)?.[1];
        expect(card.title).toBe(view?.title);
        expect(card.summary).toBeTruthy();
        expect(card.priceLabel).toBe(view?.price?.label);
        expect(view?.category?.slug).toBe(group.slug);
      }
    }
  });

  it('have publish-ready copy: nothing empty and nothing unfinished', () => {
    expect(unfinishedCopy(index)).toEqual([]);
    for (const [slug, view] of details) expect(unfinishedCopy(view), slug).toEqual([]);
  });

  it('open with the answer block and carry every section of the template the copy supplies', () => {
    for (const [slug, view] of details) {
      expect(answerBlockSchema.safeParse(view.answerBlock).success, slug).toBe(true);
      expect(view.hero.primaryCta.href, slug).toBe(`#${SERVICE_ENQUIRY_ANCHOR}`);
      expect(view.price?.amount, slug).not.toBeNull();
      expect(view.problem?.situations, slug).toHaveLength(3);
      expect(view.included?.items.length, slug).toBeGreaterThanOrEqual(8);
      expect(view.process?.steps.length, slug).toBeGreaterThanOrEqual(4);
      expect(view.technology, slug).not.toBeNull();
      expect(view.comparison, slug).not.toBeNull();
      expect(view.pricing, slug).not.toBeNull();
      expect(view.industries, slug).not.toBeNull();
      expect(view.faq?.items.length, slug).toBeGreaterThanOrEqual(6);
      expect(view.faq?.items.length, slug).toBeLessThanOrEqual(8);
      expect(new Set(view.faq?.items.map((item) => item.id)).size, slug).toBe(view.faq?.items.length);
    }
  });

  it('relate services the way the API does: same category first, never the page itself', () => {
    const order = index.groups.flatMap((group) => group.services.map((service) => ({ slug: service.slug, group: group.slug })));
    for (const [slug, view] of details) {
      const own = order.find((item) => item.slug === slug);
      const others = order.filter((item) => item.slug !== slug);
      const expected = [...others.filter((item) => item.group === own?.group), ...others.filter((item) => item.group !== own?.group)]
        .slice(0, 3)
        .map((item) => item.slug);
      expect(view.related?.items.map((item) => item.slug), slug).toEqual(expected);
    }
  });

  it('reuse only approved proof: case studies, figures and quotes exactly as the homepage shows them', () => {
    const approvedStudies = new Map(home.projects.map((project) => [project.slug, project]));
    const approvedQuotes = [...home.testimonials, ...home.projects.flatMap((project) => (project.quote ? [project.quote] : []))];
    for (const [slug, view] of details) {
      for (const study of view.proof?.caseStudies ?? []) {
        const approved = approvedStudies.get(study.slug);
        expect(approved, `${slug}: ${study.slug}`).toBeDefined();
        expect(study.clientName).toBe(approved?.clientName);
        expect(study.summary).toBe(approved?.summary);
        expect(study.metrics, `${slug}: ${study.slug}`).toEqual(approved?.metrics.slice(0, 3));
      }
      if (view.testimonial) expect(approvedQuotes, slug).toContainEqual(view.testimonial.quote);
    }
  });

  it('quote a client whose case study the page shows, as the API takes quotes from the linked projects', () => {
    for (const [slug, view] of details) {
      if (!view.testimonial) continue;
      const clients = view.proof?.caseStudies.map((study) => study.clientName) ?? [];
      expect(clients, slug).toContain(view.testimonial.quote.company);
    }
  });

  it.skipIf(workIndex === null)('show as proof the case studies the work family links to each service', () => {
    for (const [slug, view] of details) {
      const linked = (workIndex?.caseStudies ?? []).filter((study) => study.services.includes(slug)).map((study) => study.slug);
      const shown = view.proof?.caseStudies.map((study) => study.slug) ?? [];
      if (linked.length <= SERVICE_CASE_STUDY_LIMIT) {
        expect([...shown].sort(), slug).toEqual([...linked].sort());
      } else {
        expect(shown, slug).toHaveLength(SERVICE_CASE_STUDY_LIMIT);
        for (const study of shown) expect(linked, `${slug}: ${study}`).toContain(study);
      }
    }
  });

  it.skipIf(industriesIndex === null)('name and describe each industry as the industries family does', () => {
    const industries = new Map((industriesIndex?.industries ?? []).map((industry) => [industry.slug, industry]));
    for (const [slug, view] of details) {
      for (const item of view.industries?.items ?? []) {
        const listed = industries.get(item.slug);
        expect({ name: item.name, line: item.line }, `${slug}: ${item.slug}`).toEqual({ name: listed?.name, line: listed?.line });
      }
    }
  });

  it('quote only the approved price points', () => {
    const approved = [12000, 25000, 60000, 1500];
    const approvedText = ['$12,000', '$25,000', '$60,000', '$1,500'];
    for (const [slug, view] of details) {
      const amount = view.price?.amount;
      expect(approved, slug).toContain(amount?.min);
      if (amount?.max) expect(approved, slug).toContain(amount.max);
      // Case study figures are checked against the approved proof above.
      const figures = strings({ ...view, proof: null }).flatMap((text) => text.match(/\$\d{1,3}(?:,\d{3})*(?:\.\d+)?k?/g) ?? []);
      for (const figure of figures) expect(approvedText, `${slug}: ${figure}`).toContain(figure);
    }
    expect(landing.pricingTiers.map((tier) => tier.priceLabel)).toEqual(['$12k to $25k', '$25k to $60k', 'From $1.5k/mo']);
  });

  it('never name a team member on a page that quotes a client', () => {
    const team = landing.team.map((member) => member.name);
    for (const [slug, view] of details) {
      if (!view.testimonial) continue;
      const others = strings({ ...view, testimonial: null }).join(' ');
      for (const name of team) expect(others.includes(name), `${slug}: ${name}`).toBe(false);
    }
  });

  it('return nothing for a slug that is not an own key, so the page is a 404', () => {
    for (const slug of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'unknown-service']) {
      expect(serviceSnapshot(slug)).toBeUndefined();
    }
    expect(serviceSnapshot('care-plans')).toBe(serviceSnapshots['care-plans']);
  });
});
