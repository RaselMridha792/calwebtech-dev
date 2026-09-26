import {
  CASE_STUDY_SHAPES,
  CONTENT_STATUS_LABELS,
  adminCaseStudyDetailSchema,
  adminCaseStudyListSchema,
  type ContentStatus,
} from '@calwebtech/shared';
import { notFound } from 'next/navigation';
import { CaseStudyEditor, type CaseStudyDraft, type CaseStudyRecord } from '@/components/admin/content/case-study-editor';
import type { Json } from '@/components/admin/content/copy-editor';
import { AdminPage, BackLink, PageHeader } from '@/components/admin/ui/page';
import { PILL } from '@/components/admin/ui/styles';
import { adminFind, adminGet } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

/** One case study, or a new one when the id is `new` (docs/14-remaining-work.md, task 4). */
const EMPTY: CaseStudyRecord = {
  title: '',
  slug: '',
  clientName: '',
  clientAlias: null,
  summary: '',
  answerBlock: '',
  metrics: [
    { value: '', label: '' },
    { value: '', label: '' },
    { value: '', label: '' },
  ],
  industryId: null,
  services: [],
  platforms: [],
  location: null,
  segment: null,
  duration: null,
  year: null,
  liveUrl: null,
  featured: false,
  cover: null,
  gallery: [],
  challenge: null,
  approach: null,
  build: null,
  outcome: null,
  beforeAfter: null,
  seo: {},
};

export default async function AdminCaseStudyEditorPage({ params }: PageProps<'/admin/case-studies/[id]'>) {
  await requireModule('content', 'full');
  const { id } = await params;
  const creating = id === 'new';
  const [list, existing] = await Promise.all([
    adminGet('/admin/case-studies', adminCaseStudyListSchema),
    creating ? null : adminFind(`/admin/case-studies/${encodeURIComponent(id)}`, adminCaseStudyDetailSchema),
  ]);
  if (!creating && !existing) notFound();

  const draft: CaseStudyDraft = existing
    ? {
        id: existing.id,
        status: existing.status,
        notReady: existing.notReady,
        shadowsSnapshot: existing.shadowsSnapshot,
        // The API sends the record in the editor's own shape.
        record: { ...EMPTY, ...(existing.record as Partial<CaseStudyRecord>) },
      }
    : { id: null, status: 'DRAFT', notReady: null, shadowsSnapshot: false, record: EMPTY };

  return (
    <AdminPage width="medium">
      <BackLink href="/admin/case-studies/">Back to case studies</BackLink>

      <PageHeader
        eyebrow="Case study"
        title={creating ? 'New case study' : draft.record.clientName || draft.record.title || 'Untitled case study'}
        badge={existing ? <StatusPill status={existing.status} /> : undefined}
        description={
          existing
            ? `/work/${draft.record.slug}/ · last edited ${edited(existing.updatedAt)}`
            : 'Save a draft with the title, the client and the answer block first. It can be published once it has at least three figures.'
        }
      />

      <CaseStudyEditor
        draft={draft}
        options={list.options}
        shapes={CASE_STUDY_SHAPES as Record<string, Json>}
        statusLabels={CONTENT_STATUS_LABELS}
        testimonials={existing?.testimonials ?? []}
      />
    </AdminPage>
  );
}

/** Teal is a round affirmative mark and nothing else, so only a published page gets it. */
const DOT: Record<ContentStatus, string> = {
  PUBLISHED: 'rounded-full bg-result',
  SCHEDULED: 'rounded-full bg-gold-500',
  DRAFT: 'rounded-full bg-admin-surface ring-2 ring-admin-muted ring-inset',
  ARCHIVED: 'rounded-full bg-admin-muted',
};

function StatusPill({ status }: { status: ContentStatus }) {
  return (
    <span className={`${PILL} pl-2 font-sans tracking-normal`}>
      <span aria-hidden className={`size-2 shrink-0 ${DOT[status]}`} />
      {CONTENT_STATUS_LABELS[status]}
    </span>
  );
}

function edited(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
