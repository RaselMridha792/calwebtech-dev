import {
  CONTENT_STATUS_LABELS,
  INDUSTRY_CONTENT_SHAPES,
  adminIndustryDetailSchema,
  templateIndustryContent,
} from '@calwebtech/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Json } from '@/components/admin/content/copy-editor';
import { IndustryEditor, type IndustryDraft } from '@/components/admin/content/industry-editor';
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
    <main className="min-h-0 flex-1 overflow-auto px-4 py-5">
      <div className="mx-auto w-full max-w-[860px]">
        <Link href="/admin/industries/" className="text-[12.5px] font-semibold text-admin-link hover:underline">
          ← Back to industries
        </Link>
        <h1 className="mt-2 mb-4 font-display text-[21px] font-bold tracking-[-0.02em] text-admin-ink">
          {creating ? 'New industry' : draft.name}
        </h1>
        <IndustryEditor
          draft={draft}
          template={templateIndustryContent(draft.name || 'Industry website design')}
          shapes={INDUSTRY_CONTENT_SHAPES as Record<string, Json>}
          statusLabels={CONTENT_STATUS_LABELS}
        />
      </div>
    </main>
  );
}
