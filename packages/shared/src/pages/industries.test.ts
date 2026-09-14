import { describe, expect, it } from 'vitest';
import {
  industriesIndexContentSchema,
  industryContentSchema,
  industryDetailViewSchema,
  type IndustryContentInput,
} from './industries';

const point = (title: string) => ({ title, body: `What ${title.toLowerCase()} means for the build.` });

const content: IndustryContentInput = {
  title: 'Manufacturing website design',
  hero: { intro: 'Websites for manufacturers whose buyers read the spec sheet first.' },
  painPoints: {
    heading: 'Why do manufacturing websites lose engineers?',
    items: [point('Spec sheets'), point('Configurators'), point('Distributors'), point('Stock levels')],
  },
  services: { heading: 'Which services fit a manufacturer?', items: [{ slug: 'ecommerce-development', body: 'Ordering for trade accounts.' }] },
  caseStudies: { heading: 'Which manufacturers have we built for?', linkLabel: 'See all manufacturing work' },
  results: { heading: 'What did those builds change?' },
  integrations: { heading: 'Which systems does the site connect to?', items: [{ name: 'ERP', body: 'Stock and pricing.' }] },
  faq: { heading: 'What do manufacturers ask before starting?' },
};

describe('industryContentSchema', () => {
  it('accepts complete copy and defaults the optional parts', () => {
    const parsed = industryContentSchema.parse(content);
    expect(parsed.image).toBeNull();
    expect(parsed.compliance).toBeNull();
    expect(parsed.hero.primaryCta).toBeNull();
    expect(parsed.painPoints.intro).toBeNull();
  });

  it('requires exactly four pain points', () => {
    const three = { ...content, painPoints: { ...content.painPoints, items: content.painPoints.items.slice(0, 3) } };
    expect(industryContentSchema.safeParse(three).success).toBe(false);
  });

  it('requires section headings written as questions', () => {
    const statement = { ...content, faq: { heading: 'Frequently asked questions' } };
    expect(industryContentSchema.safeParse(statement).success).toBe(false);
  });
});

describe('industriesIndexContentSchema', () => {
  it('holds a two or three sentence answer block and SEO within the length rules', () => {
    const index = {
      seo: { title: 'Industries we build websites for', description: 'Sector websites.' },
      title: 'Industries',
      answerBlock: 'One sentence only, which is not an answer block for the industries index page.',
      list: { heading: 'Which industries do we work in?', empty: 'No industries yet.', cardLinkLabel: 'See the industry' },
      notListed: { heading: 'Not listed here?', body: 'Tell us about yours.', cta: { label: 'Contact us', href: '/contact/' } },
      approach: { heading: 'Why does the sector matter?', items: [] },
    };
    expect(industriesIndexContentSchema.safeParse(index).success).toBe(false);
    const fixed = { ...index, answerBlock: `${index.answerBlock} The second sentence makes it complete.` };
    expect(industriesIndexContentSchema.safeParse(fixed).success).toBe(true);
    expect(industriesIndexContentSchema.safeParse({ ...fixed, seo: { ...fixed.seo, title: 'x'.repeat(61) } }).success).toBe(false);
  });
});

describe('industryDetailViewSchema', () => {
  it('renders a record with no copy and no proof as the answer block alone', () => {
    const view = industryDetailViewSchema.parse({
      slug: 'healthcare',
      name: 'Healthcare',
      title: 'Healthcare',
      seo: { title: 'Healthcare website design', description: 'Websites for healthcare providers.' },
      answerBlock: 'Healthcare websites have to book appointments and meet accessibility rules. We build them that way from the start.',
      updatedAt: '2026-09-14T00:00:00.000Z',
      hero: { intro: null, primaryCta: null, secondaryCta: null, highlights: [], backdrop: null, line: null },
      painPoints: null,
      services: null,
      compliance: null,
      caseStudies: null,
      results: null,
      integrations: null,
      faq: null,
    });
    expect(view.seo.ogImage).toBeNull();
  });
});
