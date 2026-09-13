import { homePageViewSchema, landingPageViewSchema } from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import home from './home.json';
import landing from './landing-b2b-website-design.json';

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
});
