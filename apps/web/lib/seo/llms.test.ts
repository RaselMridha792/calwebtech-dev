import {
  homePageViewSchema,
  industriesIndexViewSchema,
  locationsIndexViewSchema,
  servicesIndexViewSchema,
  siteChromeViewSchema,
} from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import staticHome from '@/static-content/home.json';
import { industriesIndexSnapshot } from '@/static-content/industries';
import { locationsIndexSnapshot } from '@/static-content/locations';
import { servicesIndexSnapshot } from '@/static-content/services';
import staticChrome from '@/static-content/site-chrome.json';
import { buildLlmsTxt } from './llms';

const services = servicesIndexViewSchema.parse(servicesIndexSnapshot);
const industries = industriesIndexViewSchema.parse(industriesIndexSnapshot);
const txt = buildLlmsTxt({
  origin: 'https://example.com',
  description: homePageViewSchema.parse(staticHome).content.seo.description,
  chrome: siteChromeViewSchema.parse(staticChrome),
  services,
  industries,
  locations: locationsIndexViewSchema.parse(locationsIndexSnapshot),
});

describe('llms.txt', () => {
  it('opens as llmstxt.org asks: a title, then a one-line summary', () => {
    const [title, blank, summary] = txt.split('\n');
    expect(title).toBe('# Calwebtech');
    expect(blank).toBe('');
    expect(summary).toMatch(/^> Calwebtech builds custom websites/);
  });

  it('lists every published service and industry with its own line, as absolute links', () => {
    for (const service of services.groups.flatMap((group) => group.services)) {
      expect(txt).toContain(`[${service.title}](https://example.com/services/${service.slug}/)`);
    }
    for (const industry of industries.industries) {
      expect(txt).toContain(`(https://example.com/industries/${industry.slug}/)`);
    }
    expect(txt).toContain('## Services');
    expect(txt).toContain('## Industries');
    expect(txt).toContain('## Optional');
  });

  it("says where the company works and how to reach it, in the site's own words", () => {
    expect(txt).toContain('Service area: Sacramento · Austin · Dhaka.');
    expect(txt).toMatch(/Offices: .*Sacramento/);
    expect(txt).toContain('Contact: calidigi62@gmail.com.');
  });

  it('keeps every link on one line and every line free of markdown the format does not use', () => {
    for (const line of txt.split('\n').filter((row) => row.startsWith('- '))) {
      expect(line).toMatch(/^- \[[^\]]+\]\(https:\/\/example\.com\/[^)]*\)(: .+)?$/);
    }
  });
});
