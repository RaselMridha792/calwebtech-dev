import { z } from 'zod';
import { homeReviewSummarySchema, type HomePageContent, type HomeReviewSummary, type Link } from './home-page';
import { FINAL_POINT_ICONS } from './landing-page';
import { decorativeImageSchema, imageSchema, type Image } from './media';
import { siteContactSchema, type SiteContact } from './site';
import { SITE_ROUTES, caseStudyPath, industryPath, servicePath, siteHref } from './site-paths';

const text = (max: number) => z.string().trim().min(1).max(max);

/**
 * Where a chrome link may point: a site path, which may end at a homepage section
 * (`/#estimate`), or an absolute http(s), mailto: or tel: URL. Never a bare in-page anchor:
 * the chrome renders on every page, and `#pricing` exists only on the homepage.
 */
export const siteHrefSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(
    (value) =>
      value.startsWith('/') ? !value.startsWith('//') : /^(https?:|mailto:|tel:)/.test(value) && URL.canParse(value),
    'Must be a site path or an absolute URL, not an in-page anchor',
  );

export const siteLinkSchema = z.object({ label: text(60), href: siteHrefSchema });
export type SiteLink = z.infer<typeof siteLinkSchema>;

const menuColumnSchema = z.object({ title: text(60).nullable(), links: z.array(siteLinkSchema).min(1).max(8) });
const menuPromoSchema = z.object({ heading: text(80), body: text(200), cta: siteLinkSchema });

/**
 * What `GET /site/chrome` returns: everything the utility bar, header, mega menus, mobile
 * menu, footer, floating call to action and closing conversion band need, on every page.
 * Built from the `home.content` setting, the contact setting, review sources and published
 * records by `buildSiteChrome`, so it can never drift from the homepage copy.
 */
export const siteChromeViewSchema = z.object({
  /** From the `site.indexing` setting. False: every site page is noindex and robots.txt disallows all. */
  indexable: z.boolean(),
  contact: siteContactSchema,
  reviews: homeReviewSummarySchema,
  utilityBar: z.object({
    serviceArea: text(120).nullable(),
    reviewNoun: text(40),
    links: z.array(siteLinkSchema).max(4),
  }),
  header: z.object({
    primaryCta: siteLinkSchema,
    /** The one bar action is the primary; a second is optional and often not wanted. */
    secondaryCta: siteLinkSchema.nullable(),
    /** Plain links after the mega menus. */
    links: z.array(siteLinkSchema).max(4),
  }),
  megaMenu: z.object({
    services: z.object({ columns: z.array(menuColumnSchema).max(3), promo: menuPromoSchema }),
    industries: z.object({ links: z.array(siteLinkSchema).max(12), promo: menuPromoSchema.nullable() }),
    work: z.object({
      columns: z.array(menuColumnSchema).max(2),
      /** Featured case studies with their headline figure. */
      featured: z
        .array(
          z.object({
            href: siteHrefSchema,
            clientName: text(120),
            image: imageSchema.nullable(),
            metric: z.object({ value: text(20), label: text(80) }).nullable(),
          }),
        )
        .max(2),
    }),
    resources: z.object({ columns: z.array(menuColumnSchema).max(3), promo: menuPromoSchema.nullable() }),
  }),
  mobileMenu: z.object({
    groups: z.array(z.object({ title: text(60), links: z.array(siteLinkSchema).min(1).max(12) })).max(4),
  }),
  footer: z.object({
    blurb: text(300),
    columns: z.array(z.object({ title: text(60), links: z.array(siteLinkSchema).min(1).max(10) })).max(4),
    offices: z.array(z.object({ city: text(120), address: text(300) })).max(2),
    legal: z.array(siteLinkSchema).max(8),
    backgroundImage: decorativeImageSchema.nullable(),
  }),
  floatingCta: siteLinkSchema,
  /** The band closing every site page, before the footer. */
  conversionBand: z.object({
    heading: text(160),
    intro: text(600),
    points: z.array(z.object({ icon: z.enum(FINAL_POINT_ICONS), title: text(80), body: text(160) })).max(3),
    primaryCta: siteLinkSchema,
    secondaryCta: siteLinkSchema.nullable(),
    backgroundImage: decorativeImageSchema.nullable(),
  }),
});

export type SiteChromeView = z.output<typeof siteChromeViewSchema>;

/** Published records the chrome lists, in the shapes the homepage view already uses. */
export interface SiteChromeSources {
  indexable: boolean;
  content: HomePageContent;
  contact: SiteContact;
  reviews: HomeReviewSummary;
  /** Service categories with their published services, in order. */
  serviceGroups: readonly { name: string; services: readonly { slug: string; title: string }[] }[];
  services: readonly { slug: string; title: string }[];
  industries: readonly { slug: string; name: string }[];
  /** Featured, published case studies that have outcome figures, newest first. */
  projects: readonly {
    slug: string;
    clientName: string;
    image: Image | null;
    metrics: readonly { value: string; label: string }[];
  }[];
  /** Published locations; those with an address are the footer's offices. */
  offices: readonly { city: string; address: string | null }[];
}

/** Links the template supplies where the copy sets none. */
export const CHROME_DEFAULTS = {
  // Pricing moved into the Resources menu, where the cost calculator already lived.
  headerLinks: [{ label: 'Technology', href: SITE_ROUTES.technology }],
  workColumns: [
    {
      title: 'Browse',
      links: [
        { label: 'Case studies', href: SITE_ROUTES.work },
        { label: 'Before and after', href: SITE_ROUTES.beforeAndAfter },
        { label: 'Client quotes', href: SITE_ROUTES.testimonials },
      ],
    },
  ],
  resourceColumns: [
    { title: 'Tools', links: [{ label: 'Cost calculator', href: SITE_ROUTES.costCalculator }] },
    {
      title: 'Learn',
      links: [
        { label: 'Insights', href: SITE_ROUTES.insights },
        { label: 'Guides', href: SITE_ROUTES.guides },
        { label: 'Glossary', href: SITE_ROUTES.glossary },
        { label: 'How a project runs', href: SITE_ROUTES.process },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'Recognition', href: SITE_ROUTES.awards },
        { label: 'Locations', href: SITE_ROUTES.locations },
        { label: 'Contact', href: SITE_ROUTES.contact },
      ],
    },
  ],
  moreLinks: [
    { label: 'Case studies', href: SITE_ROUTES.work },
    { label: 'Before and after', href: SITE_ROUTES.beforeAndAfter },
    { label: 'Technology', href: SITE_ROUTES.technology },
    { label: 'Process', href: SITE_ROUTES.process },
    { label: 'Pricing', href: SITE_ROUTES.pricing },
    { label: 'Insights', href: SITE_ROUTES.insights },
    { label: 'Cost calculator', href: SITE_ROUTES.costCalculator },
    { label: 'Recognition', href: SITE_ROUTES.awards },
    { label: 'Locations', href: SITE_ROUTES.locations },
  ],
} as const satisfies Record<string, readonly unknown[]>;

type Column = { title: string | null; links: readonly Link[] };

export const siteLink = (link: Link): SiteLink => ({ label: link.label, href: siteHref(link.href) });

const siteLinks = (links: readonly Link[]): SiteLink[] => links.map(siteLink);

const siteColumns = (columns: readonly Column[]) =>
  columns.map((column) => ({ title: column.title, links: siteLinks(column.links) }));

/** The copy's own list when it sets one, otherwise the template's. */
const configured = <T>(items: readonly T[], fallback: () => T[]): T[] => (items.length > 0 ? [...items] : fallback());

/**
 * Builds the chrome every site page renders, including the homepage. Menus and the footer
 * use the homepage copy where it sets links and published records where it does not.
 * Every link works from any page: anchors are resolved by `siteHref`.
 */
export function buildSiteChrome(sources: SiteChromeSources): SiteChromeView {
  const { content } = sources;
  const menu = content.megaMenu;
  const { footer } = content;

  const serviceLinks = sources.services.map((service) => ({ label: service.title, href: servicePath(service.slug) }));
  const industryLinks = sources.industries.map((industry) => ({
    label: industry.name,
    href: industryPath(industry.slug),
  }));
  const promo = (item: HomePageContent['megaMenu']['servicesPromo']) => ({ ...item, cta: siteLink(item.cta) });
  const header = {
    primaryCta: siteLink(content.header.primaryCta),
    // The bar carries one action unless the copy asks for two.
    secondaryCta: content.header.secondaryCta ? siteLink(content.header.secondaryCta) : null,
  };

  const footerColumns = [
    { title: 'Services', links: configured(siteLinks(footer.services), () => serviceLinks.slice(0, 10)) },
    { title: 'Industries', links: configured(siteLinks(footer.industries), () => industryLinks.slice(0, 10)) },
    { title: 'Resources', links: siteLinks(footer.resources) },
    { title: 'Company', links: siteLinks(footer.company) },
  ].filter((column) => column.links.length > 0);

  const mobileGroups = configured(
    content.mobileMenu.groups.map((group) => ({ title: group.title, links: siteLinks(group.links) })),
    () =>
      [
        { title: 'Services', links: serviceLinks.slice(0, 12) },
        { title: 'Industries', links: industryLinks.slice(0, 12) },
        { title: 'More', links: [...CHROME_DEFAULTS.moreLinks] },
      ].filter((group) => group.links.length > 0),
  );

  return {
    indexable: sources.indexable,
    contact: sources.contact,
    reviews: sources.reviews,
    utilityBar: {
      serviceArea: content.utilityBar.serviceArea,
      reviewNoun: content.utilityBar.reviewNoun,
      links: siteLinks(content.utilityBar.links),
    },
    header: { ...header, links: [...CHROME_DEFAULTS.headerLinks] },
    megaMenu: {
      services: {
        columns: configured(siteColumns(menu.serviceColumns), () =>
          sources.serviceGroups
            .filter((group) => group.services.length > 0)
            .slice(0, 2)
            .map((group) => ({
              title: group.name,
              links: group.services.slice(0, 8).map((service) => ({ label: service.title, href: servicePath(service.slug) })),
            })),
        ),
        promo: promo(menu.servicesPromo),
      },
      industries: {
        links: configured(siteLinks(menu.industryLinks), () => industryLinks.slice(0, 12)),
        promo: menu.industriesPromo ? promo(menu.industriesPromo) : null,
      },
      work: {
        columns: configured(siteColumns(menu.workColumns), () => siteColumns(CHROME_DEFAULTS.workColumns)),
        featured: sources.projects.slice(0, 2).map((project) => {
          const metric = project.metrics[0];
          return {
            href: caseStudyPath(project.slug),
            clientName: project.clientName,
            image: project.image,
            metric: metric ? { value: metric.value, label: metric.label } : null,
          };
        }),
      },
      resources: {
        columns: configured(siteColumns(menu.resourceColumns), () => siteColumns(CHROME_DEFAULTS.resourceColumns)),
        promo: menu.resourcesPromo ? promo(menu.resourcesPromo) : null,
      },
    },
    mobileMenu: { groups: mobileGroups },
    footer: {
      blurb: footer.blurb,
      columns: footerColumns,
      offices: sources.offices
        .flatMap((office) => (office.address ? [{ city: office.city, address: office.address }] : []))
        .slice(0, 2),
      legal: siteLinks(footer.legal),
      backgroundImage: footer.backgroundImage,
    },
    floatingCta: siteLink(content.floatingCta),
    conversionBand: {
      heading: content.book.heading,
      intro: content.book.intro,
      points: content.book.points.map((point) => ({ ...point })),
      primaryCta: header.primaryCta,
      // The band's own, falling back to the bar's only where the copy sets none.
      secondaryCta: content.book.secondaryCta ? siteLink(content.book.secondaryCta) : header.secondaryCta,
      backgroundImage: content.book.backgroundImage,
    },
  };
}
