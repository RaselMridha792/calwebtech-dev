import {
  CONTENT_STATUS_LABELS,
  INDUSTRY_CONTENT_SHAPES,
  adminIndustryDetailSchema,
  templateIndustryContent,
} from '@calwebtech/shared';
import { notFound } from 'next/navigation';
import type { Json } from '@/components/admin/content/copy-editor';
import { StatusPill } from '@/components/admin/content/editor-parts';
import { IndustryEditor, type IndustryDraft } from '@/components/admin/content/industry-editor';
import { AdminPage, BackLink, PageHeader } from '@/components/admin/ui/page';
import { adminFind } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

/** One industry, or a new one when the id is `new` (docs/14-remaining-work.md, task 4). */
const EMPTY: IndustryDraft = {
  id: null,
  name: '',
  slug: '',
  answerBlock: '',
  heroCopy: '',
  order: 0,
  seoTitle: '',
  seoDescription: '',
  seoOgImage: '',
  content: null,
  faqs: [],
  status: 'DRAFT',
  shadowsSnapshot: false,
};

export default async function AdminIndustryEditorPage({ params }: PageProps<'/admin/industries/[id]'>) {
  await requireModule('content', 'full');
  const { id } = await params;
  const creating = id === 'new';
  const existing = creating
    ? null
    : await adminFind(`/admin/industries/${encodeURIComponent(id)}`, adminIndustryDetailSchema);
  if (!creating && !existing) notFound();

  const draft: IndustryDraft = existing
    ? {
        id: existing.id,
        name: existing.name,
        slug: existing.slug,
        answerBlock: existing.answerBlock,
        heroCopy: existing.heroCopy ?? '',
        order: existing.order,
        seoTitle: existing.seo.title ?? '',
        seoDescription: existing.seo.description ?? '',
        seoOgImage: existing.seo.ogImage ?? '',
        content: (existing.content ?? null) as Json | null,
        faqs: existing.faqs,
        status: existing.status,
        shadowsSnapshot: existing.shadowsSnapshot,
      }
    : EMPTY;

  return (
    <AdminPage width="medium">
      <BackLink href="/admin/industries/">Back to industries</BackLink>
      <PageHeader
        eyebrow="Industry"
        title={creating ? 'New industry' : draft.name}
        badge={existing ? <StatusPill status={existing.status} label={CONTENT_STATUS_LABELS[existing.status]} /> : undefined}
        description={
          existing
            ? `/industries/${existing.slug}/ · last edited ${when(existing.updatedAt)}`
            : 'Three fields make a page: the name, the address and the answer block. Save a draft, add the page copy when you are ready, then publish.'
        }
      />
      <IndustryEditor
        draft={draft}
        template={templateIndustryContent(draft.name || 'Industry website design')}
        shapes={INDUSTRY_CONTENT_SHAPES as Record<string, Json>}
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
