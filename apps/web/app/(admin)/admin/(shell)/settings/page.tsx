import { ADMIN_SETTING_LABELS, adminSettingsViewSchema } from '@calwebtech/shared';
import { SettingsForm, type SettingRow } from '@/components/admin/ops/settings-form';
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
    <main className="min-h-0 flex-1 overflow-auto px-4 py-5">
      <div className="mx-auto w-full max-w-[860px]">
        <h1 className="font-display text-[21px] font-bold tracking-[-0.02em] text-admin-ink">Settings</h1>
        <p className="mt-0.5 mb-2 text-[12.5px] text-admin-body">
          Five settings the site reads at request time, so a change applies to the next visitor without a deploy.
        </p>
        <SettingsForm settings={rows} />
      </div>
    </main>
  );
}
