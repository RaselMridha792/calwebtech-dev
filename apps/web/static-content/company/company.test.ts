import { readFileSync } from 'node:fs';
import path from 'node:path';
import { COMPANY_PAGES, COMPANY_VIEW_SCHEMAS, homePageViewSchema, landingPageViewSchema } from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import { unfinishedCopy } from '../copy-rules';
import home from '../home.json';
import landing from '../landing-b2b-website-design.json';
import { companySnapshots } from './index';

const approvedHome = homePageViewSchema.parse(home);
const approvedLanding = landingPageViewSchema.parse(landing);
const referenceHomepage = readFileSync(path.resolve(import.meta.dirname, '../../../../reference/homepage.html'), 'utf8')
  .replace(/\s+/g, ' ');

const views = {
  about: COMPANY_VIEW_SCHEMAS.about.parse(companySnapshots.about),
  team: COMPANY_VIEW_SCHEMAS.team.parse(companySnapshots.team),
  testimonials: COMPANY_VIEW_SCHEMAS.testimonials.parse(companySnapshots.testimonials),
  awards: COMPANY_VIEW_SCHEMAS.awards.parse(companySnapshots.awards),
  partners: COMPANY_VIEW_SCHEMAS.partners.parse(companySnapshots.partners),
  technology: COMPANY_VIEW_SCHEMAS.technology.parse(companySnapshots.technology),
};

describe('company snapshots', () => {
  it('holds one view per company page, named after the page', () => {
    expect(Object.keys(companySnapshots).sort()).toEqual([...COMPANY_PAGES].sort());
  });

  it.each(COMPANY_PAGES)('%s matches its view contract exactly, as the API returns it', (page) => {
    // Parsing fills defaults; the snapshot must already carry them, like an API response.
    expect(COMPANY_VIEW_SCHEMAS[page].parse(companySnapshots[page])).toEqual(companySnapshots[page]);
  });

  it.each(COMPANY_PAGES)('%s ships publish-ready copy', (page) => {
    expect(unfinishedCopy(companySnapshots[page])).toEqual([]);
  });

  it('gives every page a unique title and description', () => {
    const seo = Object.values(views).map((view) => view.content.seo);
    expect(new Set(seo.map((item) => item.title)).size).toBe(seo.length);
    expect(new Set(seo.map((item) => item.description)).size).toBe(seo.length);
  });
});

describe('company snapshots reuse the approved demo proof only', () => {
  const approvedTeam = approvedLanding.team;

  it('shows the approved team, with the approved roles, bios and photographs', () => {
    for (const members of [views.team.members, views.about.team]) {
      expect(members.map(({ name, role, bio, photo }) => ({ name, role, bio, photo }))).toEqual(approvedTeam);
    }
  });

  it('uses only approved testimonials, word for word, with the approved people and companies', () => {
    const approved = [
      ...approvedHome.testimonials,
      ...approvedLanding.testimonials,
      ...approvedHome.projects.flatMap((project) => (project.quote ? [project.quote] : [])),
    ];
    for (const quote of views.testimonials.testimonials) {
      const match = approved.find((item) => item.clientName === quote.clientName);
      if (match) {
        expect(quote).toMatchObject({ quote: match.quote, role: match.role, company: match.company, rating: match.rating });
      } else {
        // The pull quote exists only in the approved homepage mockup.
        expect(referenceHomepage).toContain(quote.quote);
        expect(referenceHomepage).toContain(`${quote.clientName}</b>`);
        expect(referenceHomepage).toContain(`${String(quote.role)}, ${String(quote.company)}`);
      }
    }
  });

  it('links testimonials only to approved case studies', () => {
    const slugs = new Set(approvedHome.projects.map((project) => project.slug));
    for (const quote of views.testimonials.testimonials) {
      if (quote.caseStudySlug !== null) expect(slugs).toContain(quote.caseStudySlug);
    }
  });

  it('never puts a team member and a client with the same name on one page (docs/10, known conflicts)', () => {
    const teamNames = new Set(approvedTeam.map((member) => member.name));
    const clientNames = views.testimonials.testimonials.map((quote) => quote.clientName);
    expect(clientNames.some((name) => teamNames.has(name))).toBe(true);
    // The testimonials page shows no team; the about and team pages show no testimonials.
    expect(JSON.stringify(views.testimonials)).not.toMatch(/Design Lead|Delivery Manager|Chief Technology Officer/);
    for (const page of [views.about, views.team]) {
      expect(JSON.stringify(page)).not.toMatch(/VP Marketing|Operations Lead|Truvia Labs|Halloway/);
    }
  });

  it('repeats the approved review summary and statistics exactly', () => {
    expect(views.testimonials.reviews).toEqual({
      ...approvedHome.reviews,
      sources: approvedHome.reviews.sources.map((source) => ({ ...source, profileUrl: null })),
    });
    expect(views.about.statistics).toEqual(
      approvedHome.statistics.map(({ value, suffix, label }) => ({ value, suffix, label })),
    );
  });

  it('lists only approved awards, partners and technologies', () => {
    const approvedAwards = [
      ...approvedHome.awards.map((item) => item.name),
      // Only in the approved homepage mockup's recognition tabs.
      'Horizon Interactive, Gold',
    ];
    for (const award of [...views.awards.awards, ...views.about.awards]) {
      expect(approvedAwards).toContain(award.name);
      expect(referenceHomepage).toContain(award.name);
    }
    expect(views.awards.awards.map((award) => award.year)).toEqual(
      [...views.awards.awards.map((award) => award.year)].sort((a, b) => b - a),
    );

    const approvedPartners = approvedLanding.partners.map(({ name, note }) => ({ name, certification: note }));
    for (const partners of [views.partners.partners, views.awards.partners, views.about.partners]) {
      expect(partners.map(({ name, certification }) => ({ name, certification }))).toEqual(approvedPartners);
    }

    const approvedTechnologies = approvedHome.technologyGroups.flatMap((group) => group.names.map((name) => name.toLowerCase()));
    const technologies = views.technology.groups.flatMap((group) => group.technologies.map((item) => item.name.toLowerCase()));
    expect(technologies.sort()).toEqual(approvedTechnologies.sort());
    expect(views.technology.groups.map((group) => group.label)).toEqual(approvedHome.technologyGroups.map((group) => group.category));
    expect(views.technology.content.proof.stats).toEqual(approvedHome.content.technology.stats);
  });
});
