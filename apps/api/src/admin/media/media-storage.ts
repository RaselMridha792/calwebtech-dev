import { MEDIA_FORMATS, MEDIA_WIDTHS, type MediaVariant } from '@calwebtech/shared';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/**
 * Where uploads live and what is made from them.
 *
 * Files go on the `media` volume, which the API mounts read-write and the backup service
 * snapshots read-only. The public path is `/api/media/...`: Traefik routes `/api` to this
 * service and strips the prefix, so the same path works in development through the Next
 * rewrite. Nothing is served from the web app's `public`, which is baked at build time and
 * could not hold an upload.
 *
 * Every asset gets its own directory named by its id, so deleting one is removing a
 * directory and a variant can never collide with another asset's.
 */
export const MEDIA_ROOT = process.env.MEDIA_ROOT?.trim() ?? '/media';
export const MEDIA_PUBLIC_PREFIX = '/api/media';

/** Quality per format: the point where a photograph stops losing anything a viewer sees. */
const QUALITY = { avif: 55, webp: 78 } as const;

export interface StoredUpload {
  url: string;
  width: number;
  height: number;
  variants: MediaVariant[];
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

/**
 * Writes the original and its modern-format variants, and returns what to store.
 *
 * The original is kept as it arrived: it is the one file guaranteed to open anywhere, and
 * it is what a later re-encode would start from. The variants are what pages actually
 * serve — AVIF first, WebP behind it.
 *
 * `failOn: 'error'` makes sharp refuse a truncated or malformed file rather than quietly
 * producing a half image, and the metadata read is what proves the upload is an image at
 * all, whatever its declared type said.
 */
export async function storeUpload(id: string, buffer: Buffer, mimeType: string): Promise<StoredUpload> {
  const directory = path.join(MEDIA_ROOT, id);
  await mkdir(directory, { recursive: true });

  const source = sharp(buffer, { failOn: 'error' });
  const metadata = await source.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('the upload has no readable image dimensions');
  }

  const extension = EXTENSIONS[mimeType] ?? 'bin';
  const originalName = `original.${extension}`;
  await writeFile(path.join(directory, originalName), buffer);

  const variants: MediaVariant[] = [];
  for (const format of MEDIA_FORMATS) {
    for (const width of MEDIA_WIDTHS) {
      // Never upscale: a wider copy of a narrow source is a bigger file of the same picture.
      if (width > metadata.width) continue;
      const name = `${String(width)}.${format}`;
      const encoded = await sharp(buffer, { failOn: 'error' })
        .rotate() // honour the EXIF orientation before resizing, or portraits come out sideways
        .resize({ width, withoutEnlargement: true })
        .toFormat(format, { quality: QUALITY[format] })
        .toBuffer();
      await writeFile(path.join(directory, name), encoded);
      variants.push({
        format,
        width,
        path: `${MEDIA_PUBLIC_PREFIX}/${id}/${name}`,
        sizeBytes: encoded.byteLength,
      });
    }
  }

  // A source narrower than the smallest width would leave nothing to serve, so it gets one
  // variant at its own width instead.
  if (variants.length === 0) {
    for (const format of MEDIA_FORMATS) {
      const name = `${String(metadata.width)}.${format}`;
      const encoded = await sharp(buffer, { failOn: 'error' })
        .rotate()
        .toFormat(format, { quality: QUALITY[format] })
        .toBuffer();
      await writeFile(path.join(directory, name), encoded);
      variants.push({
        format,
        width: metadata.width,
        path: `${MEDIA_PUBLIC_PREFIX}/${id}/${name}`,
        sizeBytes: encoded.byteLength,
      });
    }
  }

  return {
    url: `${MEDIA_PUBLIC_PREFIX}/${id}/${originalName}`,
    width: metadata.width,
    height: metadata.height,
    variants,
  };
}

/** Removes an asset's whole directory. Missing is success: the end state is what matters. */
export async function removeUpload(id: string): Promise<void> {
  await rm(path.join(MEDIA_ROOT, id), { recursive: true, force: true });
}
