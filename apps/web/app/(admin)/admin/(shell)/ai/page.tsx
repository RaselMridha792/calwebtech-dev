import { adminAiViewSchema } from '@calwebtech/shared';
import { AiWorkspace } from '@/components/admin/ai/ai-workspace';
import { AdminPage, PageHeader, Panel } from '@/components/admin/ui/page';
import { adminGet } from '@/lib/admin/api';
import { requireModule } from '@/lib/admin/session';

/**
 * AI (docs/08-decisions.md, 64): connect any AI provider with a key entered here rather than
 * in the server's environment, pick the model, choose which connection the site uses, and
 * try it before anything depends on it.
 *
 * The owner's alone, like the keys to anything else that spends money. No key ever reaches
 * this page: the API sends the last four characters and nothing more.
 */
export default async function AdminAiPage() {
  await requireModule('ai', 'read');
  const view = await adminGet('/admin/ai', adminAiViewSchema);

  return (
    <AdminPage>
      <PageHeader
        eyebrow="Site"
        title="AI"
        count={view.connections.length}
        description="Connect an AI provider with your own API key, choose the model, and switch provider whenever you like — no developer, no deploy. Keys are encrypted and never shown again."
      />

      {view.storage.available ? null : (
        <Panel title="This server cannot store keys yet" labelledBy="ai-storage">
          <p className="text-[14px] leading-[1.6] text-ink-invert-muted">
            Keys are encrypted with a secret that lives only on the server. Ask whoever runs the server to set{' '}
            <code className="rounded bg-admin-sunken px-1.5 py-0.5 font-mono text-[13px] text-ink-invert">CREDENTIALS_KEY</code>{' '}
            (made with <code className="font-mono text-[13px]">openssl rand -base64 32</code>) and restart the API. It is set
            once and never changes; the provider keys themselves are entered here.
          </p>
        </Panel>
      )}

      <AiWorkspace connections={view.connections} canStore={view.storage.available} />

      <p className="max-w-[760px] text-[12.5px] leading-[1.6] text-admin-muted">
        {view.storage.source === 'auth-secret'
          ? 'Keys are encrypted with a secret derived from the server’s AUTH_SECRET. Setting a dedicated CREDENTIALS_KEY later is better; stored keys keep working and move across when next saved.'
          : 'Keys are encrypted on the server before they are stored, and are sent only to the provider they belong to.'}{' '}
        Nothing on the site calls the AI yet: features that use it will call whichever connection is in use.
      </p>
    </AdminPage>
  );
}
