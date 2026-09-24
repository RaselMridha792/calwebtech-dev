'use client';
import type { AdminCampaign, CampaignBlockType, CampaignContent, CampaignTemplate, CampaignToken } from '@calwebtech/shared';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';
import { BlockEditor, toBlock, toDraftBlock, type DraftBlock } from './block-editor';
import { CampaignPreviewPanel } from './campaign-preview';
import { CampaignSchedulePanel } from './campaign-schedule';

/**
 * The campaign composer (docs/12-admin-dashboard.md, module 5; Task 5.4).
 *
 * Saving is separate from sending: nothing here reaches a subscriber. The screen writes a
 * draft, previews it and sends tests to the team; scheduling comes after, from a saved
 * draft.
 */

interface Segment {
  id: string;
  name: string;
  count: number;
}

const LABEL = 'text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase';
const INPUT =
  'h-[30px] w-full rounded-[4px] border bg-admin-surface px-2 text-[12.5px] text-admin-ink outline-none focus-visible:border-admin-focus disabled:opacity-60';

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
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3 border-t border-admin-line pt-4">
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
        </section>

        <section className="flex flex-col gap-3 border-t border-admin-line pt-4">
          <fieldset>
            <legend className="text-[10px] font-bold tracking-[0.14em] text-admin-muted uppercase">Template</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(Object.entries(templates) as [CampaignTemplate, { label: string; description: string }][]).map(
                ([key, template]) => (
                  <label
                    key={key}
                    className={`flex cursor-pointer gap-2 rounded-[4px] border p-3 ${
                      templateKey === key ? 'border-admin-edge bg-admin-nav' : 'border-admin-line'
                    }`}
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
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-[12.5px] font-semibold text-admin-ink">{template.label}</span>
                      <span className="block text-[11.5px] text-admin-body">{template.description}</span>
                    </span>
                  </label>
                ),
              )}
            </div>
          </fieldset>

          <label className="flex flex-col gap-[3px]">
            <span className={LABEL}>Send to</span>
            <select
              value={segmentId}
              disabled={disabled}
              aria-invalid={fieldError('segmentId') ? true : undefined}
              onChange={(event) => {
                edit(setSegmentId)(event.target.value);
              }}
              className={`${INPUT} ${fieldError('segmentId') ? 'border-danger' : 'border-admin-line'}`}
            >
              <option value="">Choose a segment later</option>
              {segments.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {`${entry.name} (${entry.count.toLocaleString()})`}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-admin-muted">
              {segment
                ? `${segment.count.toLocaleString()} ${segment.count === 1 ? 'subscriber' : 'subscribers'} today. Counted again at send time.`
                : segments.length === 0
                  ? 'No segments yet. Build one under Subscribers.'
                  : 'A campaign cannot be scheduled without a segment.'}
            </span>
          </label>
        </section>

        <section className="flex flex-col gap-3 border-t border-admin-line pt-4">
          <div>
            <h2 className="text-[10px] font-bold tracking-[0.14em] text-admin-muted uppercase">Body</h2>
            <p className="mt-1 text-[11.5px] text-admin-body">
              Tokens fill in per subscriber. Add a fallback after a bar for anyone who left it blank:{' '}
              <code className="text-admin-ink">{'{{firstName|there}}'}</code>.
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-admin-muted">
              {(Object.entries(tokens) as [CampaignToken, string][]).map(([token, help]) => (
                <li key={token}>
                  <code className="text-admin-ink">{`{{${token}}}`}</code> {help.toLowerCase()}
                </li>
              ))}
            </ul>
          </div>
          <BlockEditor blocks={blocks} onChange={edit(setBlocks)} onAdd={addBlock} disabled={disabled} errorFor={blockError} />
          {bodyError ? (
            <p role="alert" className="text-[11px] text-danger">
              {bodyError}
            </p>
          ) : null}
        </section>

        {error ? (
          <p role="alert" className="text-[12.5px] text-danger">
            {error}
          </p>
        ) : null}

        {mayWrite ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-admin-line pt-4">
            <button
              type="button"
              onClick={save}
              disabled={disabled}
              className="h-9 rounded-[4px] bg-primary px-4 text-[12.5px] font-semibold text-white hover:bg-admin-primaryh disabled:opacity-40"
            >
              {busy === 'save' ? 'Saving…' : campaign ? 'Save draft' : 'Create draft'}
            </button>
            <span role="status" className="text-[12px] text-admin-body">
              {saved ? 'Saved.' : unsaved && campaign ? 'Unsaved changes.' : ''}
            </span>
            {campaign ? (
              <span className="ms-auto flex flex-wrap items-center gap-2">
                {confirmingDelete ? (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingDelete(false);
                    }}
                    className="h-9 rounded-[4px] border border-admin-line px-3 text-[12.5px] font-semibold text-admin-body hover:border-admin-focus"
                  >
                    Keep it
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={destroy}
                  disabled={disabled}
                  className="h-9 rounded-[4px] border border-admin-line px-3 text-[12.5px] font-semibold text-danger hover:border-danger disabled:opacity-40"
                >
                  {busy === 'delete' ? 'Deleting…' : confirmingDelete ? 'Yes, delete the draft' : 'Delete draft'}
                </button>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-5 border-t border-admin-line pt-4 lg:sticky lg:top-0 lg:self-start">
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
    <div className="flex flex-col gap-[3px]">
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
        className={`${INPUT} ${error ? 'border-danger' : 'border-admin-line'}`}
      />
      {error ? (
        <p id={`${id}-note`} role="alert" className="text-[11px] text-danger">
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-note`} className="text-[11px] text-admin-muted">
          {help}
        </p>
      ) : null}
    </div>
  );
}
