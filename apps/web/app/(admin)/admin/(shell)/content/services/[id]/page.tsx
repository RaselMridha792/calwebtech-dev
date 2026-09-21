import { CONTENT_STATUS_LABELS, adminServiceDetailSchema, adminServiceListSchema } from '@calwebtech/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ServiceEditor, type ServiceDraft } from '@/components/admin/content/service-editor';
import { adminFind, adminGet } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

/**
 * One service, or a new one when the id is `new` (docs/12-admin-dashboard.md, M4).
 *
 * The same screen for both, because a record being created and a record being edited differ
 * only in whether the API has seen it yet.
 */
const EMPTY: ServiceDraft = {
  id: null,
  title: '',
  slug: '',
  shortDescription: '',
  answerBlock: '',
  categoryId: null,
  icon: null,
  heroMediaUrl: null,
  problemStatement: null,
  deliverables: [],
  processSteps: [],
  startingPriceBand: null,
  order: 0,
  seoTitle: '',
  seoDescription: '',
  status: 'DRAFT',
  shadowsSnapshot: false,
  hasOwnContent: false,
};

export default async function AdminServiceEditorPage({ params }: PageProps<'/admin/content/services/[id]'>) {
  await requireModule('content', 'full');
  const { id } = await params;
  const creating = id === 'new';

  const [list, existing] = await Promise.all([
    adminGet('/admin/services', adminServiceListSchema),
    creating ? null : adminFind(`/admin/services/${encodeURIComponent(id)}`, adminServiceDetailSchema),
  ]);
  if (!creating && !existing) notFound();

  const draft: ServiceDraft = existing
    ? {
        id: existing.id,
        title: existing.title,
        slug: existing.slug,
        shortDescription: existing.shortDescription,
        answerBlock: existing.answerBlock,
        categoryId: existing.categoryId,
        icon: existing.icon,
        heroMediaUrl: existing.heroMediaUrl,
        problemStatement: existing.problemStatement,
        deliverables: existing.deliverables,
        processSteps: existing.processSteps,
        startingPriceBand: existing.startingPriceBand,
        order: existing.order,
        seoTitle: existing.seo.title ?? '',
        seoDescription: existing.seo.description ?? '',
        status: existing.status,
        shadowsSnapshot: existing.shadowsSnapshot,
        hasOwnContent: existing.hasOwnContent,
      }
    : EMPTY;

  return (
    <main className="min-h-0 flex-1 overflow-auto px-4 py-5">
      <div className="mx-auto w-full max-w-[860px]">
        <Link href="/admin/content/" className="text-[12.5px] font-semibold text-admin-link hover:underline">
          ← Back to services
        </Link>
        <h1 className="mt-2 mb-4 font-display text-[21px] font-bold tracking-[-0.02em] text-admin-ink">
          {creating ? 'New service' : draft.title}
        </h1>
        <ServiceEditor
          draft={draft}
          categories={list.categories.map((category) => ({ id: category.id, name: category.name }))}
          statusLabels={CONTENT_STATUS_LABELS}
        />
      </div>
    </main>
  );
}
