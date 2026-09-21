import { ADMIN_ROLES, adminTeamViewSchema } from '@calwebtech/shared';
import { TeamPanel } from '@/components/admin/ops/team-panel';
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
    <main className="min-h-0 flex-1 overflow-auto px-4 py-5">
      <div className="mx-auto w-full max-w-[860px]">
        <h1 className="font-display text-[21px] font-bold tracking-[-0.02em] text-admin-ink">Team and roles</h1>
        <p className="mt-0.5 mb-4 text-[12.5px] text-admin-body">
          {view.members.length} {view.members.length === 1 ? 'account' : 'accounts'}. A role decides which modules
          someone reaches; the API applies it to every request, not just to what is shown here.
        </p>
        <TeamPanel members={view.members} roles={[...ADMIN_ROLES]} />
      </div>
    </main>
  );
}
