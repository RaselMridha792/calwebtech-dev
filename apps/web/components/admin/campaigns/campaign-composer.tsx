'use client';
import type { AdminCampaign, CampaignBlockType, CampaignContent, CampaignTemplate, CampaignToken } from '@calwebtech/shared';
import { useRouter } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';
import { CARD, CARD_PAD, CHECK, ERROR, H2, HELP, INPUT, LABEL, SELECT, button } from '../ui/styles';
import { BlockEditor, toBlock, toDraftBlock, type DraftBlock } from './block-editor';
import { CampaignPreviewPanel } from './campaign-preview';
import { CampaignSchedulePanel } from './campaign-schedule';

/**
 * The campaign composer (docs/12-admin-dashboard.md, module 5; Task 5.4).
 *
 * Saving is separate from sending: nothing here reaches a subscriber. The screen writes a
 * draft, previews it and sends tests to the team; scheduling comes after, from a saved
 * draft.
 *
 * The words are on the left and everything that acts on them — saving, sending, the
 * preview and the test — in a column on the right that stays in view while the body is
 * being written.
 */

interface Segment {
  id: string;
  name: string;
  count: number;
}

const STARTER: DraftBlock[] = [
  { key: 0, type: 'heading', text: '', label: '', url: '' },
  { key: 1, type: 'paragraph', text: 'Hi {{firstName|there}},', label: '', url: '' },
];

export function CampaignComposer({
  campaign,
  segments,
  templates,
  tokens,
  mayWrite,
  maySend,
  userEmail,
}: {
  campaign: AdminCampaign | null;
  segments: Segment[];
  templates: Record<CampaignTemplate, { label: string; description: string }>;
  tokens: Record<CampaignToken, string>;
  mayWrite: boolean;
  /** Whether this role may schedule, unschedule and send; editing needs a draft as well. */
  maySend: boolean;
  userEmail: string;
}) {
  const router = useRouter();
  const initialBlocks = campaign ? campaign.body.blocks.map((block, index) => toDraftBlock(block, index)) : STARTER;
  const nextKey = useRef(initialBlocks.length);

  const [name, setName] = useState(campaign?.name ?? '');
  const [subject, setSubject] = useState(campaign?.subject ?? '');
  const [preheader, setPreheader] = useState(campaign?.preheader ?? '');
  const [templateKey, setTemplateKey] = useState<CampaignTemplate>(campaign?.templateKey ?? 'letter');
  const [segmentId, setSegmentId] = useState(campaign?.segment?.id ?? '');
  const [blocks, setBlocks] = useState(initialBlocks);
  const [unsaved, setUnsaved] = useState(false);
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function edit<T>(setter: (value: T) => void): (value: T) => void {
    return (value) => {
      setter(value);
      setUnsaved(true);
      setSaved(false);
    };
  }

  const content: CampaignContent | null =
    subject.trim() && blocks.length > 0
      ? { subject, preheader: preheader.trim() || null, templateKey, body: { blocks: blocks.map(toBlock) } }
      : null;

  function addBlock(type: CampaignBlockType): void {
    const key = nextKey.current;
    nextKey.current += 1;
    edit(setBlocks)([...blocks, { key, type, text: '', label: '', url: type === 'button' ? 'https://' : '' }]);
  }

  function run<T>(label: 'save' | 'delete', promise: Promise<T>, after: (result: T) => void): void {
    setBusy(label);
    setError(null);
    setFieldErrors({});
    promise
      .then(after)
      .catch((cause: unknown) => {
        if (cause instanceof MutationError) {
          setError(cause.message);
          setFieldErrors(cause.fieldErrors);
        } else setError('That could not be saved.');
      })
      .finally(() => {
        setBusy(null);
      });
  }

  function save(): void {
    const body = {
      name,
      subject,
      preheader,
      templateKey,
      segmentId: segmentId || null,
      body: { blocks: blocks.map(toBlock) },
    };
    if (campaign) {
      run('save', adminMutate<AdminCampaign>(`/admin/campaigns/${encodeURIComponent(campaign.id)}`, { method: 'PATCH', body }), () => {
        setUnsaved(false);
        setSaved(true);
        router.refresh();
      });
      return;
    }
    run('save', adminMutate<AdminCampaign>('/admin/campaigns', { method: 'POST', body }), (created) => {
      router.push(`/admin/campaigns/${created.id}/`);
    });
  }

  function destroy(): void {
    if (!campaign) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    run('delete', adminMutate(`/admin/campaigns/${encodeURIComponent(campaign.id)}`, { method: 'DELETE' }), () => {
      router.push('/admin/campaigns/');
      router.refresh();
    });
  }

  const disabled = !mayWrite || busy !== null;
  const fieldError = (key: string): string | undefined => fieldErrors[key]?.[0];
  const blockError = (index: number): string | undefined =>
    Object.entries(fieldErrors).find(([key]) => key.startsWith(`body.blocks.${String(index)}`))?.[1][0];
  const bodyError = fieldErrors['body.blocks']?.[0] ?? fieldErrors.body?.[0];
  const segment = segments.find((entry) => entry.id === segmentId);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
      <div className="flex min-w-0 flex-col gap-6">
        <Card id="campaign-email" title="The email" description="What the team calls it, and what the inbox shows before it is opened.">
          <div className="flex flex-col gap-4">
            <Field
              id="campaign-name"
              label="Name"
              help="For the team only. Subscribers never see it."
              value={name}
              onChange={edit(setName)}
              disabled={disabled}
              error={fieldError('name')}
              maxLength={120}
            />
            <Field
              id="campaign-subject"
              label="Subject line"
              value={subject}
              onChange={edit(setSubject)}
              disabled={disabled}
              error={fieldError('subject')}
              maxLength={150}
            />
            <Field
              id="campaign-preheader"
              label="Preview text"
              help="The line an inbox shows after the subject. Optional."
              value={preheader}
              onChange={edit(setPreheader)}
              disabled={disabled}
              error={fieldError('preheader')}
              maxLength={150}
            />
          </div>
        </Card>

        <Card id="campaign-audience" title="Look and audience" description="Which branded template dresses the words, and which subscribers receive them.">
          <fieldset>
            <legend className={LABEL}>Template</legend>
            <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {(Object.entries(templates) as [CampaignTemplate, { label: string; description: string }][]).map(
                ([key, template]) => (
                  <label
                    key={key}
                    className={`flex cursor-pointer gap-3 rounded-lg border p-3.5 transition-colors duration-150 ${
                      templateKey === key
                        ? 'border-admin-edge bg-admin-nav'
                        : 'border-admin-line bg-admin-sunken hover:border-admin-edge'
                    } ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
                  >
                    <input
                      type="radio"
                      name="campaign-template"
                      value={key}
                      checked={templateKey === key}
                      disabled={disabled}
                      onChange={() => {
                        edit(setTemplateKey)(key);
                      }}
                      className={`${CHECK} mt-0.5`}
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[14px] font-semibold text-ink-invert">{template.label}</span>
                      <span className="text-[12.5px] leading-[1.5] text-ink-invert-muted">{template.description}</span>
                    </span>
                  </label>
                ),
              )}
            </div>
          </fieldset>

          <label className="mt-5 flex flex-col gap-1.5">
            <span className={LABEL}>Send to</span>
            <select
              value={segmentId}
              disabled={disabled}
              aria-invalid={fieldError('segmentId') ? true : undefined}
              onChange={(event) => {
                edit(setSegmentId)(event.target.value);
              }}
              className={SELECT}
            >
              <option value="">Choose a segment later</option>
              {segments.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {`${entry.name} (${entry.count.toLocaleString()})`}
                </option>
              ))}
            </select>
            <span className={fieldError('segmentId') ? ERROR : HELP}>
              {fieldError('segmentId') ??
                (segment
                  ? `${segment.count.toLocaleString()} ${segment.count === 1 ? 'subscriber' : 'subscribers'} today. Counted again at send time.`
                  : segments.length === 0
                    ? 'No segments yet. Build one under Subscribers.'
                    : 'A campaign cannot be scheduled without a segment.')}
            </span>
          </label>
        </Card>

        <Card
          id="campaign-body"
          title="Body"
          description="The email as a list of blocks. The template decides how each one looks, so it is on brand without any markup."
        >
          <div className="mb-5 rounded-lg border border-admin-line2 bg-admin-sunken px-3.5 py-3 text-[13px] leading-[1.6] text-ink-invert-muted">
            <p>
              Personalise with a token, and add a fallback after a bar for anyone who left it blank:{' '}
              <code className="rounded-md bg-admin-mist px-1.5 py-0.5 text-[12.5px] text-ink-invert">{'{{firstName|there}}'}</code>
            </p>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-admin-muted">
              {(Object.entries(tokens) as [CampaignToken, string][]).map(([token, help]) => (
                <li key={token}>
                  <code className="text-ink-invert">{`{{${token}}}`}</code> {help.toLowerCase()}
                </li>
              ))}
            </ul>
          </div>
          <BlockEditor blocks={blocks} onChange={edit(setBlocks)} onAdd={addBlock} disabled={disabled} errorFor={blockError} />
          {bodyError ? (
            <p role="alert" className={`${ERROR} mt-3`}>
              {bodyError}
            </p>
          ) : null}
        </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto">
        {mayWrite ? (
          <section aria-labelledby="campaign-draft" className={`${CARD} ${CARD_PAD}`}>
            <h2 id="campaign-draft" className={H2}>
              {campaign ? 'Draft' : 'Create the draft'}
            </h2>
            <p className={`${HELP} mt-1`}>
              {campaign
                ? 'Saving keeps the draft; nothing is sent until it is scheduled below.'
                : 'Saving creates the draft. Previews and tests come from the saved copy.'}
            </p>
            {error ? (
              <p role="alert" className={`${ERROR} mt-3`}>
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" onClick={save} disabled={disabled} className={button('primary')}>
                {busy === 'save' ? 'Saving…' : campaign ? 'Save draft' : 'Create draft'}
              </button>
              <span role="status" className="flex items-center gap-2 text-[13px] text-ink-invert-muted">
                {saved ? (
                  <>
                    <span aria-hidden className="size-2 shrink-0 rounded-full bg-result" />
                    Saved.
                  </>
                ) : unsaved && campaign ? (
                  'Unsaved changes.'
                ) : (
                  ''
                )}
              </span>
            </div>
            {campaign ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-admin-line2 pt-4">
                <button type="button" onClick={destroy} disabled={disabled} className={button('danger', 'sm')}>
                  {busy === 'delete' ? 'Deleting…' : confirmingDelete ? 'Yes, delete the draft' : 'Delete draft'}
                </button>
                {confirmingDelete ? (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingDelete(false);
                    }}
                    className={button('ghost', 'sm')}
                  >
                    Keep it
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : error ? (
          <p role="alert" className={ERROR}>
            {error}
          </p>
        ) : null}

        {campaign ? (
          <CampaignSchedulePanel
            campaign={campaign}
            segmentCount={segments.find((entry) => entry.id === campaign.segment?.id)?.count ?? null}
            unsaved={unsaved}
            mayWrite={maySend}
          />
        ) : null}
        <CampaignPreviewPanel
          content={content}
          segmentId={segmentId || null}
          campaignId={campaign?.id ?? null}
          unsaved={unsaved}
          mayWrite={mayWrite}
          userEmail={userEmail}
        />
      </div>
    </div>
  );
}

/** A card with a heading and one line on what it holds, the shape every group here sits in. */
function Card({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={`${CARD} ${CARD_PAD}`}>
      <div className="mb-5 flex flex-col gap-1">
        <h2 id={id} className={H2}>
          {title}
        </h2>
        <p className="text-[13.5px] leading-[1.55] text-ink-invert-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  help,
  value,
  onChange,
  disabled,
  error,
  maxLength,
}: {
  id: string;
  label: string;
  help?: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error?: string;
  maxLength: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <input
        id={id}
        value={value}
        disabled={disabled}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || help ? `${id}-note` : undefined}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={INPUT}
      />
      {error ? (
        <p id={`${id}-note`} role="alert" className={ERROR}>
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-note`} className={HELP}>
          {help}
        </p>
      ) : null}
    </div>
  );
}
