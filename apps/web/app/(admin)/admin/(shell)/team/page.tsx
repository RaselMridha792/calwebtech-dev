import { ADMIN_ROLES, adminTeamViewSchema } from '@calwebtech/shared';
import { TeamPanel } from '@/components/admin/ops/team-panel';
import { AdminPage, PageHeader } from '@/components/admin/ui/page';
import { adminGet } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

/**
 * Team and roles (docs/12-admin-dashboard.md, module 10). Retires `admin-cli` for
 * everything but the very first account, which by definition has nobody to create it.
 */
export default async function AdminTeamPage() {
  await requireModule('team', 'read');
  const view = await adminGet('/admin/team', adminTeamViewSchema);

  return (
    <AdminPage width="medium">
      <PageHeader
        eyebrow="Admin"
        title="Team and roles"
        count={view.members.length}
        description="Who can sign in to this dashboard, and what each person can reach. A role applies to everything someone does here, not only to what is shown on their screen."
      />
      <TeamPanel members={view.members} roles={[...ADMIN_ROLES]} />
    </AdminPage>
  );
}
