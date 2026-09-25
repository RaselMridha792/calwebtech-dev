import {
  CONSULTATION_PATH,
  SITE_ROUTES,
  industryPath,
  servicePath,
  type IndustriesIndexView,
  type LocationsIndexView,
  type ServicesIndexView,
  type SiteChromeView,
} from '@calwebtech/shared';

/**
 * `/llms.txt` (docs/04-seo-keyword-map.md, "Technical requirements"; docs/08-decisions.md,
 * 62): the site described for a language model, in the format llmstxt.org proposes — a title,
 * a one-paragraph summary, then sections of links with a line each.
 *
 * Every word comes from the pages themselves: the homepage's description, the footer's line
 * about the company, the services and industries with their own summaries, the offices and
 * the service area. Nothing is written here that the site does not already say, so the file
 * cannot drift from the pages or claim something they do not.
 */
export interface LlmsSources {
  origin: string;
  description: string;
  chrome: SiteChromeView;
  services: ServicesIndexView;
  industries: IndustriesIndexView;
  locations: LocationsIndexView;
}

/** One line of the file: a link with its description, markdown-safe. */
function entry(origin: string, name: string, path: string, note: string | null): string {
  const label = name.replace(/[[\]]/g, '');
  const line = `- [${label}](${new URL(path, `${origin}/`).toString()})`;
  return note ? `${line}: ${oneLine(note)}` : line;
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function buildLlmsTxt(sources: LlmsSources): string {
  const { origin, chrome } = sources;
  const services = sources.services.groups.flatMap((group) => group.services);
  const offices = sources.locations.groups.flatMap((group) => group.locations);

  const about = [
    oneLine(chrome.footer.blurb),
    chrome.utilityBar.serviceArea ? `Service area: ${oneLine(chrome.utilityBar.serviceArea)}.` : null,
    offices.length > 0
      ? `Offices: ${offices.map((office) => `${office.city}${office.state ? `, ${office.state}` : ''}`).join('; ')}.`
      : null,
    `Contact: ${chrome.footer.contactEmail}.`,
  ].filter((line): line is string => line !== null);

  const sections: [string, string[]][] = [
    ['Services', services.map((service) => entry(origin, service.title, servicePath(service.slug), service.summary))],
    [
      'Industries',
      sources.industries.industries.map((industry) => entry(origin, industry.name, industryPath(industry.slug), industry.line)),
    ],
    [
      'Key pages',
      [
        entry(origin, 'Case studies', SITE_ROUTES.work, 'Client projects with the results they measured.'),
        entry(origin, 'Pricing', SITE_ROUTES.pricing, 'How projects are priced and what the bands include.'),
        entry(origin, 'Process', SITE_ROUTES.process, 'How a project runs, step by step.'),
        entry(origin, 'Cost calculator', SITE_ROUTES.costCalculator, 'An indicative range for a project in eight questions.'),
        entry(origin, 'Book a consultation', CONSULTATION_PATH, 'A call with the people who would run the project.'),
        entry(origin, 'Contact', SITE_ROUTES.contact, null),
        entry(origin, 'About', SITE_ROUTES.about, null),
        entry(origin, 'Locations', SITE_ROUTES.locations, null),
      ],
    ],
    [
      'Optional',
      [
        entry(origin, 'Insights', SITE_ROUTES.insights, 'Articles on building and running a website that sells.'),
        entry(origin, 'Guides', SITE_ROUTES.guides, null),
        entry(origin, 'Glossary', SITE_ROUTES.glossary, 'Plain definitions of the terms a website project uses.'),
        entry(origin, 'FAQ', SITE_ROUTES.faq, null),
        entry(origin, 'Sitemap', SITE_ROUTES.sitemap, 'Every page on the site.'),
      ],
    ],
  ];

  const body = sections
    .filter(([, lines]) => lines.length > 0)
    .map(([heading, lines]) => `## ${heading}\n\n${lines.join('\n')}`)
    .join('\n\n');

  return `# Calwebtech\n\n> ${oneLine(sources.description)}\n\n${about.join('\n')}\n\n${body}\n`;
}
