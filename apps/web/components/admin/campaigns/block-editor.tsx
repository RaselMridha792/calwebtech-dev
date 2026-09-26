'use client';
import type { CampaignBlock, CampaignBlockType } from '@calwebtech/shared';
import { PlusIcon } from '../icons';
import { ERROR, INPUT, KICKER, LABEL, TAG, TEXTAREA, button, iconButton } from '../ui/styles';

/**
 * The campaign body as a list of blocks: heading, paragraph, button, divider. Each can be
 * moved up or down with a button, so the order is changed by keyboard as easily as by
 * mouse, and nothing depends on dragging.
 */

export interface DraftBlock {
  key: number;
  type: CampaignBlockType;
  text: string;
  label: string;
  url: string;
}

export const BLOCK_TYPES: readonly CampaignBlockType[] = ['heading', 'paragraph', 'button', 'divider'];

export const BLOCK_LABELS: Record<CampaignBlockType, string> = {
  heading: 'Heading',
  paragraph: 'Paragraph',
  button: 'Button',
  divider: 'Divider',
};

export function toDraftBlock(block: CampaignBlock, key: number): DraftBlock {
  return {
    key,
    type: block.type,
    text: block.type === 'heading' || block.type === 'paragraph' ? block.text : '',
    label: block.type === 'button' ? block.label : '',
    url: block.type === 'button' ? block.url : '',
  };
}

/** The draft as the API's block. Checking is the API's job; this only shapes it. */
export function toBlock(draft: DraftBlock): CampaignBlock {
  switch (draft.type) {
    case 'heading':
      return { type: 'heading', text: draft.text };
    case 'paragraph':
      return { type: 'paragraph', text: draft.text };
    case 'button':
      return { type: 'button', label: draft.label, url: draft.url };
    case 'divider':
      return { type: 'divider' };
  }
}

export function BlockEditor({
  blocks,
  onChange,
  onAdd,
  disabled,
  errorFor,
}: {
  blocks: DraftBlock[];
  onChange: (blocks: DraftBlock[]) => void;
  onAdd: (type: CampaignBlockType) => void;
  disabled: boolean;
  /** The API's message for a block, by its position, when the last save was refused. */
  errorFor: (index: number) => string | undefined;
}) {
  function update(key: number, change: Partial<DraftBlock>): void {
    onChange(blocks.map((block) => (block.key === key ? { ...block, ...change } : block)));
  }

  function move(index: number, by: -1 | 1): void {
    const target = index + by;
    const current = blocks[index];
    const other = blocks[target];
    if (!current || !other) return;
    const next = [...blocks];
    next[index] = other;
    next[target] = current;
    onChange(next);
  }

  return (
    <div>
      {blocks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-admin-line px-4 py-6 text-center text-[14px] text-ink-invert-muted">
          No blocks yet. Add one below.
        </p>
      ) : null}
      <ol className="flex flex-col gap-3">
        {blocks.map((block, index) => {
          const problem = errorFor(index);
          const id = `block-${String(block.key)}`;
          const describedBy = problem ? `${id}-error` : undefined;
          return (
            <li key={block.key} className={`rounded-lg border bg-admin-sunken p-3.5 sm:p-4 ${problem ? 'border-danger' : 'border-admin-line2'}`}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={TAG}>
                  <span className="mr-1.5 text-admin-muted tabular-nums">{index + 1}</span>
                  {BLOCK_LABELS[block.type]}
                </span>
                {disabled ? null : (
                  <span className="ms-auto flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        move(index, -1);
                      }}
                      disabled={index === 0}
                      aria-label={`Move block ${String(index + 1)} up`}
                      className={iconButton('sm')}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        move(index, 1);
                      }}
                      disabled={index === blocks.length - 1}
                      aria-label={`Move block ${String(index + 1)} down`}
                      className={iconButton('sm')}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(blocks.filter((entry) => entry.key !== block.key));
                      }}
                      aria-label={`Remove block ${String(index + 1)}`}
                      className={button('ghost', 'sm')}
                    >
                      Remove
                    </button>
                  </span>
                )}
              </div>

              {block.type === 'heading' ? (
                <input
                  id={id}
                  aria-label={`Block ${String(index + 1)}, heading`}
                  value={block.text}
                  disabled={disabled}
                  maxLength={200}
                  placeholder="A heading"
                  aria-invalid={problem ? true : undefined}
                  aria-describedby={describedBy}
                  onChange={(event) => {
                    update(block.key, { text: event.target.value });
                  }}
                  className={`${INPUT} font-display text-[16px] font-bold`}
                />
              ) : null}

              {block.type === 'paragraph' ? (
                <textarea
                  id={id}
                  aria-label={`Block ${String(index + 1)}, paragraph`}
                  value={block.text}
                  disabled={disabled}
                  rows={4}
                  maxLength={5000}
                  placeholder="What you want to say"
                  aria-invalid={problem ? true : undefined}
                  aria-describedby={describedBy}
                  onChange={(event) => {
                    update(block.key, { text: event.target.value });
                  }}
                  className={TEXTAREA}
                />
              ) : null}

              {block.type === 'button' ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className={LABEL}>Label</span>
                    <input
                      id={id}
                      value={block.label}
                      disabled={disabled}
                      maxLength={60}
                      placeholder="Read more"
                      aria-invalid={problem ? true : undefined}
                      aria-describedby={describedBy}
                      onChange={(event) => {
                        update(block.key, { label: event.target.value });
                      }}
                      className={INPUT}
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className={LABEL}>Link</span>
                    <input
                      type="url"
                      value={block.url}
                      disabled={disabled}
                      placeholder="https://"
                      aria-invalid={problem ? true : undefined}
                      aria-describedby={describedBy}
                      onChange={(event) => {
                        update(block.key, { url: event.target.value });
                      }}
                      className={INPUT}
                    />
                  </label>
                </div>
              ) : null}

              {block.type === 'divider' ? (
                <div className="flex items-center gap-3 py-1">
                  <hr className="flex-1 border-admin-line" aria-hidden="true" />
                  <span className="text-[12px] text-admin-muted">A thin rule between two parts of the email</span>
                  <hr className="flex-1 border-admin-line" aria-hidden="true" />
                </div>
              ) : null}

              {problem ? (
                <p id={`${id}-error`} role="alert" className={`${ERROR} mt-2`}>
                  {problem}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      {disabled ? null : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className={`${KICKER} mr-1`}>Add a block</span>
          {BLOCK_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                onAdd(type);
              }}
              disabled={blocks.length >= 60}
              className={button('secondary', 'sm')}
            >
              <PlusIcon className="size-3.5" />
              {BLOCK_LABELS[type]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
