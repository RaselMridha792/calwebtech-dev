/**
 * Public URLs of the site in one place, so the chrome, the sitemap and every page family
 * build the same lowercase, hyphenated, trailing-slash paths (docs/03-page-specs.md,
 * docs/10-site-pages.md).
 */
export const SITE_ROUTES = {
  home: '/',
  services: '/services/',
  industries: '/industries/',
  work: '/work/',
  beforeAndAfter: '/before-and-after/',
  about: '/about/',
  team: '/team/',
  testimonials: '/testimonials/',
  awards: '/awards/',
  partners: '/partners/',
  technology: '/technology/',
  pricing: '/pricing/',
  process: '/process/',
  contact: '/contact/',
  faq: '/faq/',
  locations: '/locations/',
  privacyPolicy: '/privacy-policy/',
  terms: '/terms/',
  cookiePolicy: '/cookie-policy/',
  accessibility: '/accessibility/',
  informationSecurity: '/information-security/',
  sitemap: '/sitemap/',
} as const;

export const servicePath = (slug: string): string => `/services/${slug}/`;
export const industryPath = (slug: string): string => `/industries/${slug}/`;
export const caseStudyPath = (slug: string): string => `/work/${slug}/`;
export const locationPath = (slug: string): string => `/locations/${slug}/`;
export const thankYouPath = (type: string): string => `/thank-you/${type}/`;

/**
 * Filters on /work/, written into the URL so each combination is linkable. Values are
 * slugs: an industry, a service, or a technology for `platform`.
 */
export const WORK_FILTER_PARAMS = ['industry', 'service', 'platform'] as const;
export type WorkFilterParam = (typeof WORK_FILTER_PARAMS)[number];

export function workFilterPath(filters: Partial<Record<WorkFilterParam, string>>): string {
  const params = new URLSearchParams();
  for (const key of WORK_FILTER_PARAMS) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `${SITE_ROUTES.work}?${query}` : SITE_ROUTES.work;
}

/**
 * Homepage sections that have a page of their own. The homepage copy links to its own
 * sections (`#pricing`); the chrome renders on every page, so those links go to the page.
 */
export const HOME_SECTION_ROUTES: Readonly<Record<string, string>> = {
  '#services': SITE_ROUTES.services,
  '#industries': SITE_ROUTES.industries,
  '#work': SITE_ROUTES.work,
  '#beforeafter': SITE_ROUTES.beforeAndAfter,
  '#testimonials': SITE_ROUTES.testimonials,
  '#awards': SITE_ROUTES.awards,
  '#tech': SITE_ROUTES.technology,
  '#process': SITE_ROUTES.process,
  '#pricing': SITE_ROUTES.pricing,
  '#locations': SITE_ROUTES.locations,
  '#book': SITE_ROUTES.contact,
  '#quote': SITE_ROUTES.contact,
};

/**
 * A link target that works on every page. In-page anchors become the page for that
 * section, and a section only the homepage has (the cost estimate, the article strip)
 * becomes that section on the homepage, `/#estimate`. Paths and URLs are unchanged.
 */
export function siteHref(href: string): string {
  if (!href.startsWith('#')) return href;
  return HOME_SECTION_ROUTES[href] ?? `/${href}`;
}
