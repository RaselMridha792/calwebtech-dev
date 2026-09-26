'use client';
import type { CampaignContent, CampaignPreview as Preview, CampaignTestSent } from '@calwebtech/shared';
import { useState } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';
import { CARD, CARD_PAD, ERROR, H2, HELP, INPUT, LABEL, button } from '../ui/styles';

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
    <>
      <section aria-labelledby="campaign-preview" className={`${CARD} ${CARD_PAD}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id="campaign-preview" className={H2}>
              Preview
            </h2>
            <p className={HELP}>The email as a subscriber will see it, saved or not.</p>
          </div>
          <button type="button" onClick={showPreview} disabled={!content || previewing} className={button('secondary', 'sm')}>
            {previewing ? 'Rendering…' : preview ? 'Refresh preview' : 'Show preview'}
          </button>
        </div>
        {!content ? <p className="mt-4 text-[14px] text-ink-invert-muted">Add a subject and at least one block to preview.</p> : null}
        {previewError ? (
          <p role="alert" className={`${ERROR} mt-4`}>
            {previewError}
          </p>
        ) : null}
        {preview ? (
          <div className="mt-4" aria-live="polite">
            <dl className="mb-3 grid grid-cols-[minmax(0,84px)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13.5px]">
              <dt className="text-admin-muted">Subject</dt>
              <dd className="min-w-0 font-semibold break-words text-ink-invert">{preview.subject}</dd>
              {preview.preheader ? (
                <>
                  <dt className="text-admin-muted">Preview</dt>
                  <dd className="min-w-0 break-words text-ink-invert-muted">{preview.preheader}</dd>
                </>
              ) : null}
              <dt className="text-admin-muted">As seen by</dt>
              <dd className="min-w-0 break-all text-ink-invert-muted">
                {preview.sample.name ? `${preview.sample.name} · ${preview.sample.email}` : preview.sample.email}
              </dd>
            </dl>
            {/* The email keeps its own look inside the frame; only the frame is the dashboard's. */}
            <iframe
              title="Email preview"
              srcDoc={preview.html}
              sandbox=""
              className="h-[560px] w-full rounded-lg border border-admin-line2 bg-admin-surface"
            />
          </div>
        ) : null}
      </section>

      {mayWrite ? (
        <section aria-labelledby="campaign-test" className={`${CARD} ${CARD_PAD}`}>
          <h2 id="campaign-test" className={H2}>
            Send a test
          </h2>
          <p className={`${HELP} mt-1`}>A copy of the saved draft to your own inbox, marked [Test]. Nothing reaches a subscriber.</p>
          <label className="mt-4 flex flex-col gap-1.5">
            <span className={LABEL}>To (up to five addresses)</span>
            <input
              value={to}
              disabled={sending || testBlocked !== null}
              onChange={(event) => {
                setTo(event.target.value);
              }}
              aria-describedby="campaign-test-status"
              className={INPUT}
            />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={sendTest}
              disabled={sending || testBlocked !== null || !to.trim()}
              className={button('secondary')}
            >
              {sending ? 'Sending…' : 'Send test'}
            </button>
          </div>
          <p
            id="campaign-test-status"
            role={testMessage && !testMessage.ok ? 'alert' : 'status'}
            className={`mt-3 flex items-start gap-2 text-[13px] leading-[1.5] ${testMessage && !testMessage.ok ? 'font-semibold text-danger' : 'text-ink-invert-muted'}`}
          >
            {testMessage?.ok ? <span aria-hidden className="mt-[5px] size-2 shrink-0 rounded-full bg-result" /> : null}
            <span>{testMessage?.text ?? testBlocked ?? 'Your own name fills the tokens in a test.'}</span>
          </p>
        </section>
      ) : null}
    </>
  );
}
