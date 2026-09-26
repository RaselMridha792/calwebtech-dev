import { z } from 'zod';

/** An absolute URL or a site-relative path such as `/media/abc.webp`. */
export const mediaSrcSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine((value) => value.startsWith('/') || URL.canParse(value), 'Must be a URL or a site path');

/** A meaningful image. Alt text is mandatory, matching the media library rule. */
export const imageSchema = z.object({
  src: mediaSrcSchema,
  alt: z.string().trim().min(1, 'Alt text is required'),
  /**
   * The picture's own size in pixels, when it is known. Optional: a frame that knows it can
   * take the picture's shape instead of cropping it (the before and after slider does).
   */
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

/** A purely decorative image, rendered with empty alt and aria-hidden. */
export const decorativeImageSchema = z.object({
  src: mediaSrcSchema,
});

export type Image = z.infer<typeof imageSchema>;
export type DecorativeImage = z.infer<typeof decorativeImageSchema>;
