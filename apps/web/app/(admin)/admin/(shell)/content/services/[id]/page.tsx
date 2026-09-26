import { CONTENT_STATUS_LABELS, adminServiceDetailSchema, adminServiceListSchema } from '@calwebtech/shared';
import { notFound } from 'next/navigation';
import { StatusPill } from '@/components/admin/content/editor-parts';
import { ServiceEditor, type ServiceDraft } from '@/components/admin/content/service-editor';
import { AdminPage, BackLink, PageHeader } from '@/components/admin/ui/page';
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
    <AdminPage width="medium">
      <BackLink href="/admin/content/">Back to services</BackLink>
      <PageHeader
        eyebrow="Service"
        title={creating ? 'New service' : draft.title}
        badge={existing ? <StatusPill status={existing.status} label={CONTENT_STATUS_LABELS[existing.status]} /> : undefined}
        description={
          existing
            ? `/services/${existing.slug}/ · last edited ${when(existing.updatedAt)}`
            : 'Four fields make a complete page: the name, the address, a summary and the answer block. Save a draft, then publish when it reads well.'
        }
      />
      <ServiceEditor
        draft={draft}
        categories={list.categories.map((category) => ({ id: category.id, name: category.name }))}
        statusLabels={CONTENT_STATUS_LABELS}
      />
    </AdminPage>
  );
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}
