import { ADMIN_SETTING_LABELS, adminSettingsViewSchema } from '@calwebtech/shared';
import { SettingsForm, type SettingRow } from '@/components/admin/ops/settings-form';
import { AdminPage, PageHeader } from '@/components/admin/ui/page';
import { adminGet } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

/**
 * Settings (docs/12-admin-dashboard.md, module 11).
 *
 * The same five keys `settings-cli` changes on the server, with the difference that makes
 * the screen worth having: every change from here is written to the audit log.
 */
export default async function AdminSettingsPage() {
  await requireModule('settings', 'read');
  const view = await adminGet('/admin/settings', adminSettingsViewSchema);

  const rows: SettingRow[] = view.settings.map((setting) => ({
    key: setting.key,
    title: ADMIN_SETTING_LABELS[setting.key].title,
    help: ADMIN_SETTING_LABELS[setting.key].help,
    value: setting.value,
    updatedAt: setting.updatedAt,
  }));

  return (
    <AdminPage width="narrow">
      <PageHeader
        eyebrow="Site"
        title="Settings"
        description="The few things the site reads every time a page loads: your contact details, who hears about new leads, the proof figures on the homepage, and whether search engines can see the site. Each saves on its own and applies to the next visitor."
      />
      <SettingsForm settings={rows} />
    </AdminPage>
  );
}
