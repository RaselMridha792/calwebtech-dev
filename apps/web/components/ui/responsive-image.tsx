import { preload } from 'react-dom';
import { imageProps } from '@/lib/image-props';

interface ResponsiveImageProps {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  draggable?: boolean;
  /** One of `images.qualities` in next.config.ts. */
  quality?: 50 | 75;
  /** For the largest image above the fold: preloaded and fetched at high priority. */
  priority?: boolean;
}

/**
 * Optimised, responsive image markup rendered on the server. Unlike `<Image>` it
 * ships no client JavaScript, which matters on every marketing route under the
 * 150KB budget. See lib/image-props.ts for why `next/image` is not imported.
 */
export function ResponsiveImage({ priority = false, draggable, ...options }: ResponsiveImageProps) {
  const props = imageProps({
    ...options,
    loading: priority ? 'eager' : 'lazy',
    ...(priority ? { fetchPriority: 'high' as const } : {}),
  });
  if (priority) {
    preload(props.src, {
      as: 'image',
      fetchPriority: 'high',
      ...(props.srcSet ? { imageSrcSet: props.srcSet } : {}),
      ...(props.sizes ? { imageSizes: props.sizes } : {}),
    });
  }
  // eslint-disable-next-line @next/next/no-img-element -- next/image markup without its client component
  return <img {...props} alt={options.alt} draggable={draggable} />;
}
