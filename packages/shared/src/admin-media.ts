import { z } from 'zod';

/**
 * The media library (docs/12-admin-dashboard.md, module 7).
 *
 * Alt text is required at upload and the library refuses an image without it, because a
 * rule applied later is a rule nobody follows: by the time an editor is looking for an
 * image to reuse, the moment to describe it has passed.
 */

/** What the library accepts. Anything else is refused before a byte is written. */
export const MEDIA_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
export type MediaMimeType = (typeof MEDIA_MIME_TYPES)[number];

/** 12 MB: larger than any photograph a page should carry, small enough to refuse a mistake. */
export const MEDIA_MAX_BYTES = 12 * 1024 * 1024;

/**
 * The widths generated for every upload, in the modern formats. A source narrower than a
 * width is not upscaled — enlarging a small image only makes a bigger file of the same
 * picture.
 */
export const MEDIA_WIDTHS = [400, 800, 1200, 1600] as const;
export const MEDIA_FORMATS = ['avif', 'webp'] as const;
export type MediaFormat = (typeof MEDIA_FORMATS)[number];

/** One generated file: which format, which width, and where it is served from. */
export const mediaVariantSchema = z.object({
  format: z.enum(MEDIA_FORMATS),
  width: z.number().int().positive(),
  path: z.string(),
  sizeBytes: z.number().int().nonnegative(),
});
export type MediaVariant = z.infer<typeof mediaVariantSchema>;

/** Where an asset is used, so nothing in use is deleted by accident. */
export const mediaUsageSchema = z.object({
  /** The record's type, in words: "Service", "Page section". */
  entityType: z.string(),
  entityId: z.string(),
  label: z.string(),
});
export type MediaUsage = z.infer<typeof mediaUsageSchema>;

export const adminMediaAssetSchema = z.object({
  id: z.string(),
  /** The original, at its public path. Always safe to use as an `<img src>`. */
  url: z.string(),
  altText: z.string(),
  mimeType: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  sizeBytes: z.number().int().nullable(),
  variants: z.array(mediaVariantSchema),
  uploadedBy: z.object({ id: z.string(), name: z.string() }).nullable(),
  createdAt: z.iso.datetime(),
  /** Empty means nothing references it, which is what makes a delete safe. */
  usage: z.array(mediaUsageSchema),
});
export type AdminMediaAsset = z.infer<typeof adminMediaAssetSchema>;

export const ADMIN_MEDIA_PAGE_SIZE = 40;

const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export const adminMediaQuerySchema = z.object({
  /** Matched against the alt text, which is the only thing about an image worth searching. */
  search: z.preprocess(blankToUndefined, z.string().trim().max(120).optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(ADMIN_MEDIA_PAGE_SIZE),
});
export type AdminMediaQuery = z.output<typeof adminMediaQuerySchema>;

export const adminMediaListSchema = z.object({
  items: z.array(adminMediaAssetSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type AdminMediaList = z.infer<typeof adminMediaListSchema>;

/** Alt text is the one thing about an asset that can be corrected after the fact. */
export const mediaAltUpdateSchema = z.object({
  altText: z.string().trim().min(1, 'Alt text is required').max(300),
});
export type MediaAltUpdate = z.infer<typeof mediaAltUpdateSchema>;

/** Why an upload or a delete was refused, in words the screen shows as they are. */
export const MEDIA_ERRORS = {
  missingAlt: 'alt_required',
  badType: 'unsupported_type',
  tooLarge: 'too_large',
  inUse: 'in_use',
  notAnImage: 'not_an_image',
} as const;

/**
 * The `srcset` for a format, largest last. Built here rather than in a component so the
 * admin preview and the public templates cannot drift apart.
 */
export function srcSet(variants: MediaVariant[], format: MediaFormat): string {
  return variants
    .filter((variant) => variant.format === format)
    .sort((a, b) => a.width - b.width)
    .map((variant) => `${variant.path} ${String(variant.width)}w`)
    .join(', ');
}
