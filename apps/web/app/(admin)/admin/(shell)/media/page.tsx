import { MEDIA_MAX_BYTES, MEDIA_MIME_TYPES, adminMediaListSchema } from '@calwebtech/shared';
import { MediaLibrary, type Asset } from '@/components/admin/media/media-library';
import { adminGet } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

/**
 * The media library (docs/12-admin-dashboard.md, module 7).
 *
 * The list is server-rendered; only the upload form and the per-asset actions are client
 * code, because a file picker and a delete are the two things that genuinely need it.
 */
export default async function AdminMediaPage({ searchParams }: PageProps<'/admin/media'>) {
  await requireModule('media', 'read');
  const params = await searchParams;
  const search = typeof params.search === 'string' ? params.search : '';
  const list = await adminGet(
    `/admin/media${search ? `?search=${encodeURIComponent(search)}` : ''}`,
    adminMediaListSchema,
  );

  const assets: Asset[] = list.items.map((asset) => ({
    id: asset.id,
    url: asset.url,
    altText: asset.altText,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    sizeBytes: asset.sizeBytes,
    variantCount: asset.variants.length,
    uploadedBy: asset.uploadedBy?.name ?? null,
    createdAt: asset.createdAt,
  }));

  return (
    <main className="min-h-0 flex-1 overflow-auto px-4 py-5">
      <div className="mx-auto w-full max-w-[1100px]">
        <h1 className="font-display text-[21px] font-bold tracking-[-0.02em] text-admin-ink">Media</h1>
        <p className="mt-0.5 mb-4 text-[12.5px] text-admin-body">
          {list.total} {list.total === 1 ? 'image' : 'images'}. Every upload is described before it is accepted, and
          kept as AVIF and WebP at four widths beside the original.
        </p>
        <MediaLibrary assets={assets} accept={MEDIA_MIME_TYPES.join(',')} maxBytes={MEDIA_MAX_BYTES} />
      </div>
    </main>
  );
}
