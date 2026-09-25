import {
  CASE_STUDY_SHAPES,
  CONTENT_STATUS_LABELS,
  adminCaseStudyDetailSchema,
  adminCaseStudyListSchema,
} from '@calwebtech/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CaseStudyEditor, type CaseStudyDraft, type CaseStudyRecord } from '@/components/admin/content/case-study-editor';
import type { Json } from '@/components/admin/content/copy-editor';
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
    <main className="min-h-0 flex-1 overflow-auto px-4 py-5">
      <div className="mx-auto w-full max-w-[860px]">
        <Link href="/admin/case-studies/" className="text-[12.5px] font-semibold text-admin-link hover:underline">
          ← Back to case studies
        </Link>
        <h1 className="mt-2 mb-4 font-display text-[21px] font-bold tracking-[-0.02em] text-admin-ink">
          {creating ? 'New case study' : draft.record.clientName}
        </h1>
        <CaseStudyEditor
          draft={draft}
          options={list.options}
          shapes={CASE_STUDY_SHAPES as Record<string, Json>}
          statusLabels={CONTENT_STATUS_LABELS}
        />
      </div>
    </main>
  );
}
