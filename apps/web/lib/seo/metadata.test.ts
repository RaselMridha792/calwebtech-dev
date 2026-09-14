import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMetadata, clampText, seoDescription, seoTitle } from './metadata';
import { absoluteUrl, sitePath } from './site';

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', 'https://www.calwebtech.com');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('seoTitle', () => {
  it('adds the brand when it fits in 60 characters', () => {
    expect(seoTitle('Website redesign')).toBe('Website redesign | Calwebtech');
  });

  it('leaves the brand off when it would not fit, and never repeats it', () => {
    const long = 'Custom website development for B2B manufacturers';
    expect(seoTitle(long)).toBe(long);
    expect(seoTitle('Calwebtech careers')).toBe('Calwebtech careers');
  });

  it('shortens a title over 60 characters at a word boundary', () => {
    const title = seoTitle('Ecommerce development for distributors with account pricing and ERP sync');
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toBe('Ecommerce development for distributors with account pricing');
  });
});

describe('seoDescription and clampText', () => {
  it('keeps descriptions within 155 characters, ending on a whole word', () => {
    const description = seoDescription('Calwebtech builds fast, accessible websites. '.repeat(6));
    expect(description.length).toBeLessThanOrEqual(155);
    expect(description.endsWith('…')).toBe(true);
    expect(description).not.toMatch(/\s…$/);
  });

  it('collapses whitespace and leaves short copy alone', () => {
    expect(clampText('  Plain\n copy  ', 155)).toBe('Plain copy');
  });
});

describe('sitePath and absoluteUrl', () => {
  it('writes paths with a trailing slash and keeps a filter query', () => {
    expect(sitePath('/services/website-redesign')).toBe('/services/website-redesign/');
    expect(sitePath('/work/?service=ecommerce-development')).toBe('/work/?service=ecommerce-development');
    expect(absoluteUrl('/about/')).toBe('https://www.calwebtech.com/about/');
  });

  it('refuses paths that are not lowercase site paths', () => {
    expect(() => sitePath('services/')).toThrow();
    expect(() => sitePath('//example.com/')).toThrow();
    expect(() => sitePath('/Services/')).toThrow();
  });
});

describe('buildMetadata', () => {
  const page = {
    title: 'Website redesign',
    description: 'Rebuild a slow site into a fast one without losing rankings.',
    path: '/services/website-redesign/',
  };

  it('sets an absolute canonical, Open Graph and the default image', () => {
    const metadata = buildMetadata({ ...page, indexable: true });
    expect(metadata.title).toEqual({ absolute: 'Website redesign | Calwebtech' });
    expect(metadata.alternates?.canonical).toBe('https://www.calwebtech.com/services/website-redesign/');
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.openGraph).toMatchObject({
      url: 'https://www.calwebtech.com/services/website-redesign/',
      siteName: 'Calwebtech',
      images: [{ url: 'https://www.calwebtech.com/opengraph-image/', width: 1200, height: 630 }],
    });
  });

  it('is noindex, nofollow while the site is not indexable', () => {
    expect(buildMetadata({ ...page, indexable: false }).robots).toEqual({ index: false, follow: false });
  });

  it('points a filtered view at its parent and uses a page image when one is set', () => {
    const metadata = buildMetadata({
      ...page,
      path: '/work/?platform=wordpress',
      canonicalPath: '/work/',
      indexable: true,
      ogImage: '/media/work.jpg',
    });
    expect(metadata.alternates?.canonical).toBe('https://www.calwebtech.com/work/');
    expect(metadata.openGraph?.images).toEqual([{ url: 'https://www.calwebtech.com/media/work.jpg', alt: 'Website redesign | Calwebtech' }]);
  });
});
