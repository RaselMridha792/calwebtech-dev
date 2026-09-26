import { MEDIA_MAX_BYTES, MEDIA_MIME_TYPES, adminMediaListSchema } from '@calwebtech/shared';
import Link from 'next/link';
import { SearchIcon } from '@/components/admin/icons';
import { MediaLibrary, type Asset } from '@/components/admin/media/media-library';
import { AdminPage, PageHeader } from '@/components/admin/ui/page';
import { INPUT, LINK } from '@/components/admin/ui/styles';
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
    <AdminPage>
      <PageHeader
        eyebrow="Content"
        title="Media"
        count={list.total}
        description="Every image the site uses, in one place. Describe each one as you add it and it can be reused on any page; copies are kept in modern formats at four sizes so pages stay fast."
        actions={
          <form role="search" method="get" action="/admin/media/" className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-[260px]">
              <label htmlFor="media-search" className="sr-only">
                Search the library
              </label>
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-admin-muted" />
              <input
                id="media-search"
                name="search"
                type="search"
                defaultValue={search}
                placeholder="Search by description"
                className={`${INPUT} pl-9 ${search ? 'border-admin-edge' : ''}`}
              />
            </div>
            {/* Reachable by keyboard and the only way to search without JavaScript. */}
            <button type="submit" className="sr-only focus:not-sr-only focus:rounded-lg focus:px-3 focus:py-2 focus:text-ink-invert">
              Search
            </button>
            {search ? (
              <Link href="/admin/media/" className={`${LINK} text-[13.5px]`}>
                Clear
              </Link>
            ) : null}
          </form>
        }
      />
      <MediaLibrary assets={assets} accept={MEDIA_MIME_TYPES.join(',')} maxBytes={MEDIA_MAX_BYTES} />
    </AdminPage>
  );
}
