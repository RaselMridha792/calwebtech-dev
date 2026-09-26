import Link from 'next/link';
import { AdminPage, EmptyState, PageHeader, Panel } from '@/components/admin/ui/page';
import { button } from '@/components/admin/ui/styles';

/**
 * A module that has its place in the shell but nothing behind it yet
 * (docs/12-admin-dashboard.md, screen 4).
 *
 * The note says what the module will do, so the dashboard is honest about what it cannot
 * do yet rather than showing an empty screen that looks broken.
 */
export function ModuleStub({ group, title, note }: { group: string; title: string; note: string }) {
  return (
    <AdminPage width="medium">
      <PageHeader
        eyebrow={group}
        title={title}
        description="This screen is on its way. It has its place in the menu already so nothing moves around later; there is simply nothing behind it yet."
      />
      <Panel>
        <EmptyState
          title="Nothing to manage here yet"
          actions={
            <Link href="/admin/" className={button('secondary')}>
              Back to the dashboard
            </Link>
          }
        >
          {note}
        </EmptyState>
      </Panel>
    </AdminPage>
  );
}
