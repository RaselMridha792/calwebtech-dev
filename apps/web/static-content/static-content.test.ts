import { homePageViewSchema, landingPageViewSchema } from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import home from './home.json';
import landing from './landing-b2b-website-design.json';

/**
 * The snapshot pages render from while no API is hosted (lib/api.ts). It must still match
 * the contract, stay noindex, and carry no proof the placeholder seed does not have.
 */
describe('static content snapshot', () => {
  it('matches the homepage contract and stays noindex', () => {
    const view = homePageViewSchema.parse(home);
    expect(view.indexable).toBe(false);
    expect(view.projects).toEqual([]);
    expect(view.testimonials).toEqual([]);
    expect(view.reviews.averageRating).toBeNull();
  });

  it('matches the landing page contract and stays noindex', () => {
    const view = landingPageViewSchema.parse(landing);
    expect(view.slug).toBe('b2b-website-design');
    expect(view.noindex).toBe(true);
    expect(view.results).toEqual([]);
    expect(view.testimonials).toEqual([]);
  });
});
