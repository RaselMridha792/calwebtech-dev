import { Prisma, type Award, type Faq, type Partner, type ReviewSource, type TeamMember, type Technology } from '@calwebtech/db';
import type {
  CompanyAboutContentInput,
  CompanyAwardsContentInput,
  CompanyPartnersContentInput,
  CompanyTeamContentInput,
  CompanyTechnologyContentInput,
  CompanyTestimonialsContentInput,
} from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
  toCompanyAboutView,
  toCompanyAwardsView,
  toCompanyPartnersView,
  toCompanyTeamView,
  toCompanyTechnologyView,
  toCompanyTestimonialsView,
  type CompanyTestimonialRecord,
} from './company.mapper';

const at = new Date('2026-09-01T00:00:00Z');
let sequence = 0;
const nextId = (prefix: string) => {
  sequence += 1;
  return `${prefix}-${String(sequence)}`;
};

const seo = { title: 'Test title', description: 'Test description.' };
const hero = {
  title: 'Test heading',
  answerBlock: 'This is the first sentence of a test answer block. This is the second sentence of the same block.',
};
const card = { title: 'Test question?', body: 'Test answer.' };
const faq = { heading: 'Test questions?' };

const aboutContent: CompanyAboutContentInput = {
  seo,
  hero,
  story: { heading: 'Test story?', paragraphs: ['Test paragraph.'] },
  statistics: { heading: 'Test figures?' },
  team: { heading: 'Test team?', empty: 'No test profiles.', linkLabel: 'Test link' },
  values: { heading: 'Test values?', items: [card] },
  recognition: { heading: 'Test recognition?', empty: 'No test recognition.', awardsLinkLabel: 'Test', partnersLinkLabel: 'Test' },
  faq,
};

const teamContent: CompanyTeamContentInput = {
  seo,
  hero,
  members: { heading: 'Test team?', empty: 'No test profiles.' },
  roles: { heading: 'Test roles?', items: [card] },
  faq,
};

const testimonialsContent: CompanyTestimonialsContentInput = {
  seo,
  hero,
  quotes: { heading: 'Test quotes?', empty: 'No test quotes.', caseStudyLabel: 'Test link' },
  ratings: { heading: 'Test ratings?', empty: 'No test ratings.', method: 'Test method.' },
  faq,
};

const awardsContent: CompanyAwardsContentInput = {
  seo,
  hero,
  recognition: { heading: 'Test recognition?', empty: 'No test recognition.' },
  partners: { heading: 'Test partners?', empty: 'No test partners.', linkLabel: 'Test link' },
  faq,
};

const partnersContent: CompanyPartnersContentInput = {
  seo,
  hero,
  partners: { heading: 'Test partners?', empty: 'No test partners.', meaningLabel: 'Test label' },
  independence: { heading: 'Test independence?', paragraphs: ['Test paragraph.'] },
  faq,
};

const technologyContent: CompanyTechnologyContentInput = {
  seo,
  hero,
  stack: {
    heading: 'Test stack?',
    empty: 'No test technologies.',
    categories: [
      { key: 'backend', label: 'Test back end', summary: 'Test back end summary.' },
      { key: 'frontend', label: 'Test front end', summary: 'Test front end summary.' },
      { key: 'unused', label: 'Test unused', summary: 'Test unused summary.' },
    ],
  },
  proof: { heading: 'Test proof?', stats: [] },
  choosing: { heading: 'Test choosing?', items: [card] },
  faq,
};

function member(overrides: Partial<TeamMember> = {}): TeamMember {
  const id = nextId('member');
  return {
    id,
    name: 'Test person',
    slug: id,
    role: 'Test role',
    photo: null,
    bio: null,
    skills: null,
    socials: null,
    order: 0,
    active: true,
    ...overrides,
  };
}

function testimonial(overrides: Partial<CompanyTestimonialRecord> = {}): CompanyTestimonialRecord {
  return {
    id: nextId('testimonial'),
    clientName: 'Test reviewer',
    role: null,
    company: null,
    avatarUrl: null,
    rating: 5,
    quote: 'A test quote.',
    source: null,
    videoUrl: null,
    featured: false,
    consentAt: at,
    deletedAt: null,
    date: null,
    createdAt: at,
    updatedAt: at,
    projectId: null,
    project: null,
    ...overrides,
  };
}

function award(overrides: Partial<Award> = {}): Award {
  return {
    id: nextId('award'),
    name: 'Test recognition',
    category: null,
    year: 2026,
    awardingBody: null,
    description: null,
    badgeUrl: null,
    projectName: null,
    order: 0,
    ...overrides,
  };
}

function partner(overrides: Partial<Partner> = {}): Partner {
  return {
    id: nextId('partner'),
    name: 'Test platform',
    logoUrl: null,
    tier: null,
    certification: null,
    meaningForClient: null,
    quote: null,
    order: 0,
    ...overrides,
  };
}

function technology(name: string, category: string, overrides: Partial<Technology> = {}): Technology {
  const id = nextId('technology');
  return { id, name, slug: id, logoUrl: null, category, proficiencyNote: null, order: 0, ...overrides };
}

function faqRecord(question: string): Faq {
  return {
    id: nextId('faq'),
    question,
    answer: 'Test answer.',
    group: 'company-test',
    order: 0,
    serviceId: null,
    industryId: null,
    locationId: null,
    landingPageId: null,
  };
}

function review(platform: string, rating: number, reviewCount: number, profileUrl: string | null = null): ReviewSource {
  return { id: platform, platform, rating: new Prisma.Decimal(rating), reviewCount, profileUrl, refreshedAt: at };
}

describe('toCompanyAboutView', () => {
  it('renders with no records, so every list shows its empty state', () => {
    const view = toCompanyAboutView({ contentSetting: aboutContent, statistics: [], team: [], awards: [], partners: [], faqs: [] });
    expect(view).toMatchObject({ statistics: [], team: [], awards: [], partners: [], faqs: [] });
    expect(view.content.story.image).toBeNull();
  });

  it('throws on malformed or missing copy rather than rendering half a page', () => {
    const sources = { statistics: [], team: [], awards: [], partners: [], faqs: [] };
    expect(() => toCompanyAboutView({ ...sources, contentSetting: null })).toThrow(ZodError);
    expect(() =>
      toCompanyAboutView({ ...sources, contentSetting: { ...aboutContent, story: { heading: 'Our story', paragraphs: ['Test.'] } } }),
    ).toThrow(ZodError);
  });

  it('carries statistics with an empty suffix when none is set', () => {
    const view = toCompanyAboutView({
      contentSetting: aboutContent,
      statistics: [{ id: 's', label: 'Test figure', value: '10', suffix: null, order: 0 }],
      team: [],
      awards: [],
      partners: [],
      faqs: [],
    });
    expect(view.statistics).toEqual([{ value: '10', suffix: '', label: 'Test figure' }]);
  });

  it('fails the contract when a FAQ is not written as a question', () => {
    expect(() =>
      toCompanyAboutView({
        contentSetting: aboutContent,
        statistics: [],
        team: [],
        awards: [],
        partners: [],
        faqs: [faqRecord('Not a question')],
      }),
    ).toThrow(ZodError);
  });
});

describe('toCompanyTeamView', () => {
  it('gives each photo alt text, and drops skills and socials that do not match their shape', () => {
    const view = toCompanyTeamView({
      contentSetting: teamContent,
      members: [
        member({
          name: 'Test person',
          role: 'Test role',
          photo: '/media/person.jpg',
          bio: '  ',
          skills: ['Test skill'],
          socials: [{ label: 'Profile', href: 'https://example.com/person' }],
        }),
        member({ skills: 'not a list', socials: [{ label: 'Broken', href: 'not a url' }] }),
        member({
          skills: ['Kept skill', 42],
          socials: [
            { label: 'Script', href: 'javascript:alert(1)' },
            { label: 'Kept profile', href: 'https://example.com/kept' },
          ],
        }),
      ],
      faqs: [faqRecord('Test question?')],
    });
    expect(view.members[0]).toMatchObject({
      photo: { src: '/media/person.jpg', alt: 'Test person, Test role' },
      bio: null,
      skills: ['Test skill'],
      socials: [{ label: 'Profile', href: 'https://example.com/person' }],
    });
    expect(view.members[1]).toMatchObject({ photo: null, skills: [], socials: [] });
    expect(view.members[2]).toMatchObject({
      skills: ['Kept skill'],
      socials: [{ label: 'Kept profile', href: 'https://example.com/kept' }],
    });
    expect(view.faqs).toHaveLength(1);
  });
});

describe('toCompanyTestimonialsView', () => {
  const base = { contentSetting: testimonialsContent, proofSetting: null, reviewSources: [], faqs: [] };

  it('renders with no reviews and no testimonials', () => {
    const view = toCompanyTestimonialsView({ ...base, testimonials: [] });
    expect(view.testimonials).toEqual([]);
    expect(view.reviews).toEqual({ averageRating: null, totalReviews: 0, sources: [], npsScore: null, npsProjectCount: null });
  });

  it('leaves out testimonials without consent to publish', () => {
    const consented = testimonial();
    const view = toCompanyTestimonialsView({ ...base, testimonials: [testimonial({ consentAt: null }), consented] });
    expect(view.testimonials.map((item) => item.id)).toEqual([consented.id]);
  });

  it('links a quote to its case study only when the project is published and not deleted', () => {
    const view = toCompanyTestimonialsView({
      ...base,
      testimonials: [
        testimonial({ project: { slug: 'published-project', status: 'PUBLISHED', deletedAt: null } }),
        testimonial({ project: { slug: 'draft-project', status: 'DRAFT', deletedAt: null } }),
        testimonial({ project: { slug: 'deleted-project', status: 'PUBLISHED', deletedAt: at } }),
        testimonial({ date: new Date('2026-03-04T15:00:00Z'), source: 'Test source' }),
      ],
    });
    expect(view.testimonials.map((item) => item.caseStudySlug)).toEqual(['published-project', null, null, null]);
    expect(view.testimonials[3]).toMatchObject({ date: '2026-03-04', source: 'Test source' });
  });

  it('weights the rating by review count and keeps each platform count, profile and the NPS sample', () => {
    const view = toCompanyTestimonialsView({
      ...base,
      proofSetting: { npsScore: 70, npsProjectCount: 9 },
      reviewSources: [
        review('Test platform A', 5, 3, 'javascript:alert(1)'),
        review('Test platform B', 4, 97, 'https://example.com/profile'),
      ],
      testimonials: [],
    });
    expect(view.reviews.averageRating).toBe(4);
    expect(view.reviews.totalReviews).toBe(100);
    expect(view.reviews.sources).toEqual([
      { platform: 'Test platform B', rating: 4, reviewCount: 97, profileUrl: 'https://example.com/profile' },
      { platform: 'Test platform A', rating: 5, reviewCount: 3, profileUrl: null },
    ]);
    expect(view.reviews).toMatchObject({ npsScore: 70, npsProjectCount: 9 });
  });

  it('ignores a malformed proof setting rather than failing the page', () => {
    const view = toCompanyTestimonialsView({ ...base, proofSetting: { npsScore: 'high' }, testimonials: [] });
    expect(view.reviews).toMatchObject({ npsScore: null, npsProjectCount: null });
  });
});

describe('toCompanyAwardsView and toCompanyPartnersView', () => {
  it('renders empty lists, and gives badges and logos alt text', () => {
    expect(toCompanyAwardsView({ contentSetting: awardsContent, awards: [], partners: [], faqs: [] }).awards).toEqual([]);
    const awards = toCompanyAwardsView({
      contentSetting: awardsContent,
      awards: [award({ name: 'Test recognition', badgeUrl: '/media/badge.svg', projectName: ' ' })],
      partners: [],
      faqs: [],
    });
    expect(awards.awards[0]).toMatchObject({ badge: { src: '/media/badge.svg', alt: 'Test recognition badge' }, projectName: null });

    const partners = toCompanyPartnersView({
      contentSetting: partnersContent,
      partners: [partner({ name: 'Test platform', logoUrl: '/media/logo.svg', meaningForClient: 'Test meaning.' })],
      faqs: [],
    });
    expect(partners.partners[0]).toMatchObject({
      logo: { src: '/media/logo.svg', alt: 'Test platform logo' },
      meaningForClient: 'Test meaning.',
      certification: null,
    });
  });

  it('throws when the copy belongs to another page', () => {
    expect(() => toCompanyPartnersView({ contentSetting: awardsContent, partners: [], faqs: [] })).toThrow(ZodError);
  });
});

describe('toCompanyTechnologyView', () => {
  it('has no groups without technologies', () => {
    expect(toCompanyTechnologyView({ contentSetting: technologyContent, technologies: [], faqs: [] }).groups).toEqual([]);
  });

  it('groups technologies in the order the copy lists categories, then unlisted categories under a readable label', () => {
    const view = toCompanyTechnologyView({
      contentSetting: technologyContent,
      technologies: [
        technology('Test library', 'frontend', { proficiencyNote: 'Test note.' }),
        technology('Test tool', 'mobile-and-ai'),
        technology('Test server', 'backend'),
        technology('Test framework', 'frontend'),
      ],
      faqs: [],
    });
    expect(view.groups.map((group) => [group.key, group.label, group.summary])).toEqual([
      ['backend', 'Test back end', 'Test back end summary.'],
      ['frontend', 'Test front end', 'Test front end summary.'],
      ['mobile-and-ai', 'Mobile and ai', null],
    ]);
    expect(view.groups[1]?.technologies.map((item) => [item.name, item.proficiencyNote])).toEqual([
      ['Test library', 'Test note.'],
      ['Test framework', null],
    ]);
  });
});
