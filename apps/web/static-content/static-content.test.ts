import { buildSiteChrome, homePageViewSchema, landingPageViewSchema, siteChromeViewSchema } from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import home from './home.json';
import landing from './landing-b2b-website-design.json';
import chrome from './site-chrome.json';

/**
 * The snapshot pages render from while no API is hosted (lib/api.ts). It holds the
 * approved mockups' demo content (docs/08-decisions.md, 33), must match the contract, and
 * stays noindex.
 */
describe('static content snapshot', () => {
  it('matches the homepage contract and stays noindex', () => {
    expect(homePageViewSchema.parse(home).indexable).toBe(false);
  });

  it('matches the landing page contract and stays noindex', () => {
    const view = landingPageViewSchema.parse(landing);
    expect(view.slug).toBe('b2b-website-design');
    expect(view.noindex).toBe(true);
  });

  it('derives the site chrome from the homepage snapshot, the way the API builds it, and stays noindex', () => {
    const view = homePageViewSchema.parse(home);
    const derived = buildSiteChrome({
      indexable: false,
      content: view.content,
      contact: view.contact,
      reviews: view.reviews,
      serviceGroups: view.serviceGroups,
      services: view.services,
      industries: view.industries,
      projects: view.projects,
      offices: view.locations,
    });
    // Regenerate site-chrome.json with the same call when home.json changes.
    expect(siteChromeViewSchema.parse(chrome)).toEqual(siteChromeViewSchema.parse(derived));
    expect(chrome.indexable).toBe(false);
  });

  it('gives the chrome no in-page anchors, since it renders on every page', () => {
    expect(JSON.stringify(chrome).match(/"href":\s*"#/g)).toBeNull();
  });
});
