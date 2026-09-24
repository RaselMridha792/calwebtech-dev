import { describe, expect, it } from 'vitest';
import { homePageContentSchema, type HomePageContentInput } from './home-page';
import { buildSiteChrome, siteChromeViewSchema, siteHrefSchema, type SiteChromeSources } from './site-chrome';
import { HOME_SECTION_ROUTES, siteHref, workFilterPath } from './site-paths';

const link = (label: string, href: string) => ({ label, href });

/** The smallest valid homepage copy: no configured menus, so the chrome falls back to records. */
const CONTENT: HomePageContentInput = {
  seo: { title: 'Test title', description: 'Test description.' },
  utilityBar: { serviceArea: 'Test area', links: [link('Support', '#book')] },
  header: { primaryCta: link('Book a call', '#book'), secondaryCta: link('Estimate', '#estimate') },
  megaMenu: { servicesPromo: { heading: 'Test promo', body: 'Test promo body.', cta: link('Estimate', '#estimate') } },
  hero: {
    eyebrow: null,
    heading: 'Test heading',
    headingEmphasis: null,
    intro: 'Test intro.',
    primaryCta: link('Work', '#work'),
    secondaryCta: null,
    form: { heading: 'Test form', subheading: 'Test subheading.', submitLabel: 'Send', footnote: null },
    background: { poster: null, videoUrl: null },
  },
  formSuccess: { heading: 'Thanks', body: 'Test body.' },
  clients: { label: 'Test clients' },
  capability: {
    heading: 'Test',
    bullets: [],
    body: 'Test body.',
    primaryCta: link('Work', '#work'),
    showreel: null,
    background: { poster: null, videoUrl: null },
  },
  problemRouter: { heading: 'Test', intro: 'Test intro.', cta: link('Book', '#book') },
  services: { heading: 'Test' },
  work: { heading: 'Test', intro: 'Test intro.', empty: 'None yet.' },
  midCta: { eyebrow: 'Test', heading: 'Test', primaryCta: link('Quote', '#quote'), secondaryCta: null },
  beforeAfter: { heading: 'Test', intro: 'Test intro.', empty: 'None yet.' },
  industries: {
    heading: 'Test',
    intro: 'Test intro.',
    notListed: { heading: 'Test', body: 'Test body.', cta: link('Book', '#book') },
  },
  estimate: {
    badge: 'Test',
    heading: 'Test',
    intro: 'Test intro.',
    bullets: [],
    preview: { progressLabel: 'Test', question: 'Test question?', options: ['One', 'Two'] },
    cta: link('Book', '#book'),
  },
  whyUs: { heading: 'Test', items: [] },
  technology: { heading: 'Test', intro: 'Test intro.', empty: 'None yet.' },
  process: { heading: 'Test', intro: 'Test intro.' },
  testimonials: { heading: 'Test', empty: 'None yet.' },
  recognition: { eyebrow: null, heading: 'Test', empty: 'None yet.' },
  insights: { heading: 'Test', empty: 'None yet.' },
  whitepaper: { eyebrow: 'Test', ctaLabel: 'Download' },
  locations: { heading: 'Test', intro: 'Test intro.', empty: 'None yet.' },
  pricing: { heading: 'Test', intro: 'Test intro.', cta: link('Estimate', '#estimate') },
  book: {
    heading: 'Test book heading',
    intro: 'Test book intro.',
    points: [{ icon: 'check', title: 'Test point', body: 'Test point body.' }],
    submitLabel: 'Book',
    footnote: 'Test footnote.',
    serviceOptions: [],
    referralOptions: [],
  },
  footer: {
    blurb: 'Test blurb.',
    resources: [link('Cost estimate', '#estimate'), link('Process', '#process')],
    company: [link('Contact', '#book')],
    legal: [link('Privacy policy', '/privacy-policy/')],
  },
  floatingCta: link('Start a project', '#book'),
};

function sources(overrides: Partial<SiteChromeSources> = {}): SiteChromeSources {
  return {
    indexable: false,
    content: homePageContentSchema.parse(CONTENT),
    contact: { phone: '+1 (555) 010-0100', phoneE164: '+15550100100', email: 'hello@example.com' },
    reviews: { averageRating: null, totalReviews: 0, sources: [], npsScore: null, npsProjectCount: null },
    serviceGroups: [
      { name: 'Group one', services: [{ slug: 'service-one', title: 'Service one' }] },
      { name: 'Empty group', services: [] },
      { name: 'Group two', services: [{ slug: 'service-two', title: 'Service two' }] },
    ],
    services: [
      { slug: 'service-one', title: 'Service one' },
      { slug: 'service-two', title: 'Service two' },
    ],
    industries: [{ slug: 'industry-one', name: 'Industry one' }],
    projects: [
      { slug: 'project-one', clientName: 'Client one', image: null, metrics: [{ value: '10', label: 'Test figure' }] },
      { slug: 'project-two', clientName: 'Client two', image: null, metrics: [] },
      { slug: 'project-three', clientName: 'Client three', image: null, metrics: [{ value: '3', label: 'Test' }] },
    ],
    offices: [
      { city: 'No address', address: null },
      { city: 'City one', address: '1 Test Street' },
      { city: 'City two', address: '2 Test Street' },
      { city: 'City three', address: '3 Test Street' },
    ],
    ...overrides,
  };
}

function hrefsOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(hrefsOf);
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, item]) =>
    key === 'href' && typeof item === 'string' ? [item] : hrefsOf(item),
  );
}

describe('siteHref', () => {
  it('sends homepage anchors with a page of their own to that page', () => {
    expect(siteHref('#pricing')).toBe('/pricing/');
    expect(siteHref('#beforeafter')).toBe('/before-and-after/');
    expect(siteHref('#book')).toBe('/book-a-consultation/');
  });

  it('sends sections only the homepage has to that section on the homepage', () => {
    expect(siteHref('#estimate')).toBe('/#estimate');
    expect(siteHref('#insights')).toBe('/#insights');
  });

  it('leaves paths and URLs alone', () => {
    expect(siteHref('/services/')).toBe('/services/');
    expect(siteHref('https://example.com/')).toBe('https://example.com/');
  });

  it('maps every section route to a lowercase path with a trailing slash', () => {
    for (const route of Object.values(HOME_SECTION_ROUTES)) expect(route).toMatch(/^\/[a-z-]+\/$/);
  });
});

describe('siteHrefSchema', () => {
  it('accepts site paths, homepage sections and absolute URLs', () => {
    for (const href of ['/', '/work/?service=ecommerce-development', '/#estimate', 'https://example.com', 'tel:+15550100100', 'mailto:hello@example.com']) {
      expect(siteHrefSchema.safeParse(href).success, href).toBe(true);
    }
  });

  it('rejects in-page anchors, protocol-relative and script URLs', () => {
    for (const href of ['#pricing', '//example.com', 'javascript:alert(1)']) {
      expect(siteHrefSchema.safeParse(href).success, href).toBe(false);
    }
  });
});

describe('workFilterPath', () => {
  it('writes filters in a fixed order and drops empty ones', () => {
    expect(workFilterPath({})).toBe('/work/');
    expect(workFilterPath({ service: 'ecommerce-development', industry: 'healthcare', platform: '' })).toBe(
      '/work/?industry=healthcare&service=ecommerce-development',
    );
  });
});

describe('buildSiteChrome', () => {
  it('matches the contract, and no link is an in-page anchor', () => {
    const chrome = siteChromeViewSchema.parse(buildSiteChrome(sources()));
    const hrefs = hrefsOf(chrome);
    expect(hrefs.length).toBeGreaterThan(10);
    expect(hrefs.filter((href) => href.startsWith('#'))).toEqual([]);
  });

  it('falls back to published records, linking each to its page', () => {
    const chrome = buildSiteChrome(sources());
    expect(chrome.megaMenu.services.columns).toEqual([
      { title: 'Group one', links: [{ label: 'Service one', href: '/services/service-one/' }] },
      { title: 'Group two', links: [{ label: 'Service two', href: '/services/service-two/' }] },
    ]);
    expect(chrome.megaMenu.industries.links).toEqual([{ label: 'Industry one', href: '/industries/industry-one/' }]);
    expect(chrome.mobileMenu.groups.map((group) => group.title)).toEqual(['Services', 'Industries', 'More']);
    expect(chrome.footer.columns.map((column) => column.title)).toEqual(['Services', 'Industries', 'Resources', 'Company']);
  });

  it('uses the copy where it sets links, with anchors resolved', () => {
    const content = homePageContentSchema.parse({
      ...CONTENT,
      megaMenu: {
        ...CONTENT.megaMenu,
        industryLinks: [link('Healthcare', '/industries/healthcare/'), link('Everything else', '#industries')],
      },
    });
    const chrome = buildSiteChrome(sources({ content }));
    expect(chrome.megaMenu.industries.links).toEqual([
      { label: 'Healthcare', href: '/industries/healthcare/' },
      { label: 'Everything else', href: '/industries/' },
    ]);
    expect(chrome.footer.columns.find((column) => column.title === 'Resources')?.links).toEqual([
      { label: 'Cost estimate', href: '/#estimate' },
      { label: 'Process', href: '/process/' },
    ]);
    expect(chrome.utilityBar.links).toEqual([{ label: 'Support', href: '/book-a-consultation/' }]);
  });

  it('features the first two case studies with their headline figure, and only offices with an address', () => {
    const chrome = buildSiteChrome(sources());
    expect(chrome.megaMenu.work.featured).toEqual([
      { href: '/work/project-one/', clientName: 'Client one', image: null, metric: { value: '10', label: 'Test figure' } },
      { href: '/work/project-two/', clientName: 'Client two', image: null, metric: null },
    ]);
    expect(chrome.footer.offices).toEqual([
      { city: 'City one', address: '1 Test Street' },
      { city: 'City two', address: '2 Test Street' },
    ]);
  });

  it('closes pages with the consultation copy, and falls back to the bar for its second action', () => {
    const { conversionBand, header, floatingCta } = buildSiteChrome(sources());
    expect(conversionBand).toMatchObject({
      heading: 'Test book heading',
      intro: 'Test book intro.',
      primaryCta: { label: 'Book a call', href: '/book-a-consultation/' },
      secondaryCta: { label: 'Estimate', href: '/#estimate' },
    });
    // Technology moved into the Resources menu (2026-09-23), so the bar carries no links of its own.
    expect(header.links).toEqual([]);
    expect(floatingCta).toEqual({ label: 'Start a project', href: '/book-a-consultation/' });
  });

  it('lets the closing band set its own second action, so the bar can drop one', () => {
    const base = sources();
    const { conversionBand, header } = buildSiteChrome({
      ...base,
      content: {
        ...base.content,
        header: { ...base.content.header, secondaryCta: null },
        book: { ...base.content.book, secondaryCta: { label: 'Instant estimate', href: '/cost-calculator/' } },
      },
    });
    expect(header.secondaryCta).toBeNull();
    expect(conversionBand.secondaryCta).toEqual({ label: 'Instant estimate', href: '/cost-calculator/' });
  });
});
