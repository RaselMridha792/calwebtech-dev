import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ResponsiveImage } from './responsive-image';

function attributes(html: string): Record<string, string> {
  const tag = /<img\s([^>]*)\/?>/.exec(html)?.[1] ?? '';
  // HTML attribute names are case-insensitive; React writes fetchPriority and srcSet in camelCase.
  return Object.fromEntries(
    [...tag.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)].map((m) => [(m[1] ?? '').toLowerCase(), m[2] ?? '']),
  );
}

describe('ResponsiveImage markup', () => {
  it('emits width, height, sizes, lazy loading and async decoding for a sized image', () => {
    const img = attributes(
      renderToStaticMarkup(
        <ResponsiveImage src="/media/logo.png" alt="Northmark" width={140} height={32} sizes="140px" />,
      ),
    );
    expect(img).toMatchObject({ alt: 'Northmark', width: '140', height: '32', sizes: '140px', loading: 'lazy', decoding: 'async' });
    expect(img.fetchpriority).toBeUndefined();
  });

  it('marks the LCP image eager with fetchpriority="high"', () => {
    const img = attributes(
      renderToStaticMarkup(<ResponsiveImage src="/media/hero.jpg" alt="" fill sizes="100vw" priority />),
    );
    expect(img).toMatchObject({ loading: 'eager', fetchpriority: 'high', decoding: 'async', sizes: '100vw' });
  });

  it('omits width and height for fill images, which size from their container', () => {
    const img = attributes(renderToStaticMarkup(<ResponsiveImage src="/media/team.jpg" alt="Team" fill sizes="25vw" />));
    expect(img.width).toBeUndefined();
    expect(img.height).toBeUndefined();
    expect(img.style).toContain('position:absolute');
  });

  // Documents current behaviour: sources still go through the Next.js image optimiser.
  // They will come from stored media variants once the media pipeline exists.
  it('serves src and srcset through /_next/image today', () => {
    const img = attributes(
      renderToStaticMarkup(<ResponsiveImage src="/media/hero.jpg" alt="" fill sizes="100vw" quality={50} />),
    );
    expect(img.src).toMatch(/^\/_next\/image\?url=%2Fmedia%2Fhero\.jpg&amp;w=\d+&amp;q=\d+$/);
    expect(img.srcset?.split(', ').every((candidate) => candidate.startsWith('/_next/image?url='))).toBe(true);
  });
});
