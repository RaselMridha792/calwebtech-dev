import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  adminLeadDetailSchema,
  adminLeadFilterOptionsSchema,
  adminLeadQuerySchema,
  canWrite,
} from '@calwebtech/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LeadPanel } from '@/components/admin/leads/lead-panel';
import { adminFind, adminGet } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

/**
 * One lead, full width (docs/12-admin-dashboard.md, screen 3).
 *
 * The same component as the panel beside the table, given the whole column instead of
 * 428px — the design asks for one implementation in two containers, and this is the second.
 */
export default async function LeadRecordPage({ params }: PageProps<'/admin/leads/[id]'>) {
  const user = await requireModule('leads', 'read');
  const { id } = await params;

  const [lead, options] = await Promise.all([
    adminFind(`/admin/leads/${encodeURIComponent(id)}`, adminLeadDetailSchema),
    adminGet('/admin/leads/filter-options', adminLeadFilterOptionsSchema),
  ]);
  if (!lead) notFound();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 pt-4">
        <Link href="/admin/leads/" className="text-[12.5px] font-semibold text-admin-link hover:underline">
          ← Back to the inbox
        </Link>
      </div>
      <LeadPanel
        lead={lead}
        query={adminLeadQuerySchema.parse({})}
        owners={options.owners}
        statuses={LEAD_STATUSES.map((value) => ({ value, label: LEAD_STATUS_LABELS[value] }))}
        mayWrite={canWrite(user.role, 'leads')}
        full
      />
    </div>
  );
}
