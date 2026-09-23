'use client';
import type { CampaignContent, CampaignPreview as Preview, CampaignTestSent } from '@calwebtech/shared';
import { useState } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';

const LABEL = 'text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase';

/**
 * The preview and the test send.
 *
 * The preview renders what is on screen, saved or not, through the API and the same
 * template the send uses. The email is shown in a sandboxed frame: it is HTML built for
 * mail clients, and it must not run anything or inherit the dashboard's styles.
 *
 * A test goes out as the campaign is saved, so the button waits until there is nothing
 * unsaved — otherwise the inbox would show something other than the screen.
 */
export function CampaignPreviewPanel({
  content,
  segmentId,
  campaignId,
  unsaved,
  mayWrite,
  userEmail,
}: {
  /** Null while the draft is not complete enough to render. */
  content: CampaignContent | null;
  segmentId: string | null;
  campaignId: string | null;
  unsaved: boolean;
  mayWrite: boolean;
  userEmail: string;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [to, setTo] = useState(userEmail);
  const [sending, setSending] = useState(false);
  const [testMessage, setTestMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function showPreview(): void {
    if (!content) return;
    setPreviewing(true);
    setPreviewError(null);
    adminMutate<Preview>('/admin/campaigns/preview', { method: 'POST', body: { content, segmentId } })
      .then(setPreview)
      .catch((cause: unknown) => {
        const detail = cause instanceof MutationError ? Object.values(cause.fieldErrors).flat()[0] : undefined;
        setPreviewError(detail ?? (cause instanceof MutationError ? cause.message : 'The preview could not be made.'));
      })
      .finally(() => {
        setPreviewing(false);
      });
  }

  function sendTest(): void {
    if (!campaignId) return;
    const addresses = to
      .split(/[\s,;]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    setSending(true);
    setTestMessage(null);
    adminMutate<CampaignTestSent>(`/admin/campaigns/${encodeURIComponent(campaignId)}/test`, {
      method: 'POST',
      body: { to: addresses },
    })
      .then((result) => {
        setTestMessage({ ok: true, text: `Test queued for ${result.to.join(', ')}. It arrives marked [Test].` });
      })
      .catch((cause: unknown) => {
        if (cause instanceof MutationError) {
          setTestMessage({ ok: false, text: Object.values(cause.fieldErrors).flat()[0] ?? cause.message });
        } else setTestMessage({ ok: false, text: 'The test could not be sent.' });
      })
      .finally(() => {
        setSending(false);
      });
  }

  const testBlocked = !campaignId ? 'Save the campaign to send a test.' : unsaved ? 'Save your changes to send a test.' : null;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[10px] font-bold tracking-[0.14em] text-admin-muted uppercase">Preview</h2>
          <button
            type="button"
            onClick={showPreview}
            disabled={!content || previewing}
            className="h-8 rounded-[4px] border border-admin-line px-3 text-[12.5px] font-semibold text-admin-body hover:border-admin-focus disabled:opacity-40"
          >
            {previewing ? 'Rendering…' : preview ? 'Refresh preview' : 'Show preview'}
          </button>
        </div>
        {!content ? (
          <p className="mt-2 text-[12px] text-admin-body">Add a subject and at least one block to preview.</p>
        ) : null}
        {previewError ? (
          <p role="alert" className="mt-2 text-[12px] text-danger">
            {previewError}
          </p>
        ) : null}
        {preview ? (
          <div className="mt-3" aria-live="polite">
            <dl className="mb-2 space-y-1 text-[12px]">
              <div className="flex gap-2">
                <dt className="w-[64px] shrink-0 text-admin-muted">Subject</dt>
                <dd className="font-semibold text-admin-ink">{preview.subject}</dd>
              </div>
              {preview.preheader ? (
                <div className="flex gap-2">
                  <dt className="w-[64px] shrink-0 text-admin-muted">Preview</dt>
                  <dd className="text-admin-body">{preview.preheader}</dd>
                </div>
              ) : null}
              <div className="flex gap-2">
                <dt className="w-[64px] shrink-0 text-admin-muted">As seen by</dt>
                <dd className="break-all text-admin-body">
                  {preview.sample.name ? `${preview.sample.name} · ${preview.sample.email}` : preview.sample.email}
                </dd>
              </div>
            </dl>
            <iframe
              title="Email preview"
              srcDoc={preview.html}
              sandbox=""
              className="h-[560px] w-full rounded-[4px] border border-admin-line bg-admin-surface"
            />
          </div>
        ) : null}
      </div>

      {mayWrite ? (
        <div className="border-t border-admin-line pt-4">
          <h2 className="text-[10px] font-bold tracking-[0.14em] text-admin-muted uppercase">Send a test</h2>
          <label className="mt-2 flex flex-col gap-[3px]">
            <span className={LABEL}>To (up to five addresses)</span>
            <input
              value={to}
              disabled={sending || testBlocked !== null}
              onChange={(event) => {
                setTo(event.target.value);
              }}
              aria-describedby="campaign-test-status"
              className="h-[30px] w-full rounded-[4px] border border-admin-line bg-admin-surface px-2 text-[12.5px] text-admin-ink outline-none focus-visible:border-admin-focus disabled:opacity-60"
            />
          </label>
          <button
            type="button"
            onClick={sendTest}
            disabled={sending || testBlocked !== null || !to.trim()}
            className="mt-2 h-8 rounded-[4px] border border-admin-line px-3 text-[12.5px] font-semibold text-admin-body hover:border-admin-focus disabled:opacity-40"
          >
            {sending ? 'Sending…' : 'Send test'}
          </button>
          <p
            id="campaign-test-status"
            role={testMessage && !testMessage.ok ? 'alert' : 'status'}
            className={`mt-2 text-[12px] ${testMessage && !testMessage.ok ? 'text-danger' : 'text-admin-body'}`}
          >
            {testMessage?.text ?? testBlocked ?? 'Your own name fills the tokens in a test.'}
          </p>
        </div>
      ) : null}
    </section>
  );
}
