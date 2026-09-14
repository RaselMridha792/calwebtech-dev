import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX } from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import { seoDescription, seoTitle } from '@/lib/seo/metadata';
import { workIndexPageSeo } from './index-metadata';

const seo = { title: 'Case studies', description: 'Websites and platforms we have built, and what changed for each client.' };

describe('workIndexPageSeo', () => {
  it('leaves the first page as written', () => {
    expect(workIndexPageSeo(seo, 1)).toEqual(seo);
  });

  it('puts the page number in the title and description of later pages', () => {
    expect(workIndexPageSeo(seo, 2)).toEqual({
      title: 'Case studies, page 2',
      description: 'Websites and platforms we have built, and what changed for each client. Page 2.',
    });
    expect(workIndexPageSeo({ ...seo, description: 'Websites we have built' }, 3).description).toBe(
      'Websites we have built. Page 3.',
    );
  });

  it('keeps the page number when the copy is already near the limits', () => {
    const long = {
      title: 'Custom website and ecommerce case studies from our studios',
      description:
        'Custom websites, ecommerce stores and web platforms we designed and built for manufacturers, distributors, clinics, and retail brands in every market.',
    };
    expect(long.title).toHaveLength(58);
    expect(long.description).toHaveLength(150);

    for (const page of [2, 12, 10_000]) {
      const result = workIndexPageSeo(long, page);
      const title = seoTitle(result.title);
      const description = seoDescription(result.description);
      expect(title.length).toBeLessThanOrEqual(SEO_TITLE_MAX);
      expect(title.endsWith(`, page ${String(page)}`)).toBe(true);
      expect(description.length).toBeLessThanOrEqual(SEO_DESCRIPTION_MAX);
      expect(description.endsWith(` Page ${String(page)}.`)).toBe(true);
    }
    expect(workIndexPageSeo(long, 2).description).not.toBe(workIndexPageSeo(long, 3).description);
  });
});
