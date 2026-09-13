import { getImageProps, type ImageProps } from 'next/image';
import { describe, expect, it } from 'vitest';
import { imageProps } from './image-props';

// Local paths: the default loader rejects remote hosts that are not configured, and
// the test runs without next.config.
const cases: ImageProps[] = [
  {
    src: '/media/hero.jpg',
    alt: '',
    fill: true,
    sizes: '100vw',
    loading: 'eager',
    fetchPriority: 'high',
    className: 'object-cover opacity-[.26]',
  },
  { src: '/media/logo.png', alt: 'Northmark', width: 140, height: 32, sizes: '140px', loading: 'lazy' },
  { src: '/media/team.jpg', alt: 'Dana Whitfield, Delivery Manager', fill: true, sizes: '(min-width: 1024px) 25vw, 100vw' },
  { src: '/media/backdrop.jpg', alt: '', fill: true, sizes: '(min-width: 1024px) 100vw, 50vw', quality: 50 },
];

describe('imageProps', () => {
  it.each(cases)('matches getImageProps from next/image for $src', (options) => {
    expect(imageProps(options)).toEqual(getImageProps(options).props);
  });
});
