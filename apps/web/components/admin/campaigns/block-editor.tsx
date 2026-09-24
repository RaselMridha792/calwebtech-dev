'use client';
import type { CampaignBlock, CampaignBlockType } from '@calwebtech/shared';

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

const LABEL = 'text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase';
const INPUT =
  'h-[30px] w-full rounded-[4px] border bg-admin-surface px-2 text-[12.5px] text-admin-ink outline-none focus-visible:border-admin-focus disabled:opacity-60';
const SMALL_BUTTON =
  'h-[30px] rounded-[4px] border border-admin-line px-2.5 text-[12px] font-semibold text-admin-body hover:border-admin-focus disabled:opacity-40';

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
      {blocks.length === 0 ? <p className="text-[12.5px] text-admin-body">No blocks yet. Add one below.</p> : null}
      <ol className="border-t border-admin-line">
        {blocks.map((block, index) => {
          const problem = errorFor(index);
          const id = `block-${String(block.key)}`;
          const describedBy = problem ? `${id}-error` : undefined;
          return (
            <li key={block.key} className="border-b border-admin-line py-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={LABEL}>{`${String(index + 1)}. ${BLOCK_LABELS[block.type]}`}</span>
                {disabled ? null : (
                  <span className="ms-auto flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        move(index, -1);
                      }}
                      disabled={index === 0}
                      aria-label={`Move block ${String(index + 1)} up`}
                      className={SMALL_BUTTON}
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
                      className={SMALL_BUTTON}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(blocks.filter((entry) => entry.key !== block.key));
                      }}
                      aria-label={`Remove block ${String(index + 1)}`}
                      className={SMALL_BUTTON}
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
                  aria-invalid={problem ? true : undefined}
                  aria-describedby={describedBy}
                  onChange={(event) => {
                    update(block.key, { text: event.target.value });
                  }}
                  className={`${INPUT} font-semibold ${problem ? 'border-danger' : 'border-admin-line'}`}
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
                  aria-invalid={problem ? true : undefined}
                  aria-describedby={describedBy}
                  onChange={(event) => {
                    update(block.key, { text: event.target.value });
                  }}
                  className={`w-full rounded-[4px] border bg-admin-surface px-2 py-1.5 text-[12.5px] text-admin-ink outline-none focus-visible:border-admin-focus disabled:opacity-60 ${
                    problem ? 'border-danger' : 'border-admin-line'
                  }`}
                />
              ) : null}

              {block.type === 'button' ? (
                <div className="flex flex-wrap gap-2">
                  <label className="flex min-w-[160px] flex-1 flex-col gap-[3px]">
                    <span className={LABEL}>Label</span>
                    <input
                      id={id}
                      value={block.label}
                      disabled={disabled}
                      maxLength={60}
                      aria-invalid={problem ? true : undefined}
                      aria-describedby={describedBy}
                      onChange={(event) => {
                        update(block.key, { label: event.target.value });
                      }}
                      className={`${INPUT} ${problem ? 'border-danger' : 'border-admin-line'}`}
                    />
                  </label>
                  <label className="flex min-w-[220px] flex-[2] flex-col gap-[3px]">
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
                      className={`${INPUT} ${problem ? 'border-danger' : 'border-admin-line'}`}
                    />
                  </label>
                </div>
              ) : null}

              {block.type === 'divider' ? <hr className="border-admin-line" aria-hidden="true" /> : null}

              {problem ? (
                <p id={`${id}-error`} role="alert" className="mt-1 text-[11px] text-danger">
                  {problem}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      {disabled ? null : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={LABEL}>Add</span>
          {BLOCK_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                onAdd(type);
              }}
              disabled={blocks.length >= 60}
              className="h-8 rounded-[4px] border border-admin-line px-3 text-[12.5px] font-semibold text-admin-body hover:border-admin-focus disabled:opacity-40"
            >
              {BLOCK_LABELS[type]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
