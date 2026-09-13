import { getImgProps, type ImgProps } from 'next/dist/shared/lib/get-img-props';
import type { ImageConfigComplete } from 'next/dist/shared/lib/image-config';
import defaultLoader from 'next/dist/shared/lib/image-loader';
import type { ImageProps } from 'next/image';

/**
 * The same result as `getImageProps` from `next/image`, without importing `next/image`.
 *
 * That entry point also requires the `'use client'` image component, so importing it
 * anywhere in the server graph ships the component and its helpers (about 4KB gzip)
 * to every page that renders an image, even when `<Image>` is never used. Under a
 * 150KB budget with a ~132KB framework floor, that is a quarter of the headroom.
 *
 * This reaches into Next internals on purpose. lib/image-props.test.ts compares the
 * output with `next/image` so an upgrade that changes either one fails loudly.
 */
export function imageProps(options: ImageProps): ImgProps {
  const { props } = getImgProps(options, {
    defaultLoader,
    // Replaced at build time by Next's define plugin, exactly as in next/image.
    imgConf: process.env.__NEXT_IMAGE_OPTS as unknown as ImageConfigComplete,
  });
  return Object.fromEntries(
    Object.entries(props).filter(([, value]) => value !== undefined),
  ) as ImgProps;
}
