import {
  CONTENT_STATUS_LABELS,
  adminComparisonDetailSchema,
  adminComparisonListSchema,
  type ContentStatus,
} from '@calwebtech/shared';
import { notFound } from 'next/navigation';
import {
  ComparisonEditor,
  type ComparisonDraft,
  type ComparisonForm,
  type FigureForm,
  type PictureForm,
} from '@/components/admin/content/comparison-editor';
import { AdminPage, BackLink, PageHeader } from '@/components/admin/ui/page';
import { PILL } from '@/components/admin/ui/styles';
import { adminFind, adminGet } from '@/lib/admin/api';
import { comparisonsLiveNote } from '@/lib/admin/comparisons';
import { requireModule } from '@/lib/admin/session';

/** One comparison, or a new one when the id is `new` (docs/08-decisions.md, 70). */
const EMPTY_PICTURE: PictureForm = { src: '', alt: '', width: '', height: '' };

const EMPTY: ComparisonForm = {
  clientName: '',
  heading: '',
  summary: '',
  before: EMPTY_PICTURE,
  after: EMPTY_PICTURE,
  metrics: [],
  projectId: null,
  order: 0,
  onHomepage: false,
};

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const size = (value: unknown): string => (typeof value === 'number' ? String(value) : '');

/** A stored picture in the form's shape; the API sends the record as stored, so read leniently. */
function pictureOf(value: unknown): PictureForm {
  const image = (value ?? {}) as Record<string, unknown>;
  return { src: text(image.src), alt: text(image.alt), width: size(image.width), height: size(image.height) };
}

function figuresOf(value: unknown): FigureForm[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const figure = (entry ?? {}) as Record<string, unknown>;
    return { label: text(figure.label), before: text(figure.before), after: text(figure.after) };
  });
}

function formOf(record: Record<string, unknown>): ComparisonForm {
  return {
    clientName: text(record.clientName),
    heading: text(record.heading),
    summary: text(record.summary),
    before: pictureOf(record.before),
    after: pictureOf(record.after),
    metrics: figuresOf(record.metrics),
    projectId: typeof record.projectId === 'string' ? record.projectId : null,
    order: typeof record.order === 'number' ? record.order : 0,
    onHomepage: record.onHomepage === true,
  };
}

export default async function AdminComparisonEditorPage({ params }: PageProps<'/admin/before-and-after/[id]'>) {
  await requireModule('content', 'full');
  const { id } = await params;
  const creating = id === 'new';
  const [list, existing] = await Promise.all([
    adminGet('/admin/comparisons', adminComparisonListSchema),
    creating ? null : adminFind(`/admin/comparisons/${encodeURIComponent(id)}`, adminComparisonDetailSchema),
  ]);
  if (!creating && !existing) notFound();

  // A new comparison joins the end of the list.
  const next = list.items.reduce((highest, item) => Math.max(highest, item.order + 1), 0);
  const draft: ComparisonDraft = existing
    ? { id: existing.id, status: existing.status, shownOnHomepage: existing.shownOnHomepage, record: formOf(existing.record) }
    : { id: null, status: 'DRAFT', shownOnHomepage: false, record: { ...EMPTY, order: next } };

  return (
    <AdminPage width="medium">
      <BackLink href="/admin/before-and-after/">Back to before and after</BackLink>

      <PageHeader
        eyebrow="Before and after"
        title={creating ? 'New comparison' : draft.record.clientName || 'Untitled comparison'}
        badge={existing ? <StatusPill status={existing.status} /> : undefined}
        description={
          existing
            ? `On /before-and-after/ · last edited ${edited(existing.updatedAt)}`
            : 'Save a draft with the words and both pictures first. Publish it when it is ready to show.'
        }
      />

      <ComparisonEditor
        draft={draft}
        caseStudies={list.caseStudies}
        statusLabels={CONTENT_STATUS_LABELS}
        liveNote={comparisonsLiveNote()}
      />
    </AdminPage>
  );
}

/** Teal is a round affirmative mark and nothing else, so only a published comparison gets it. */
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
