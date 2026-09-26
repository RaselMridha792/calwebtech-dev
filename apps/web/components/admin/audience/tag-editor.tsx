'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CloseIcon } from '@/components/admin/icons';
import { ERROR, HELP, INPUT, LABEL, TAG, button } from '@/components/admin/ui/styles';
import { MutationError, adminMutate } from '@/lib/admin/mutate';

/**
 * A subscriber's tags. The whole set is saved at once, the way the screen shows it, so
 * two edits in a row cannot leave a set nobody looked at.
 *
 * The tag's shape is checked by the API (`tagNameSchema`); this only lower-cases and trims,
 * so what is typed matches what the list shows after saving.
 */
export function TagEditor({ subscriberId, tags, mayWrite }: { subscriberId: string; tags: string[]; mayWrite: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState(tags);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = current.join('\n') !== tags.join('\n');

  function add(): void {
    const name = draft.trim().toLowerCase();
    if (!name) return;
    if (!current.includes(name)) setCurrent([...current, name]);
    setDraft('');
  }

  function save(): void {
    setBusy(true);
    setError(null);
    void adminMutate(`/admin/subscribers/${encodeURIComponent(subscriberId)}/tags`, {
      method: 'PUT',
      body: { tags: current },
    })
      .then(() => {
        router.refresh();
      })
      .catch((cause: unknown) => {
        if (cause instanceof MutationError) {
          const detail = Object.values(cause.fieldErrors).flat()[0];
          setError(detail ?? cause.message);
        } else setError('That could not be saved.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  return (
    <div className="flex flex-col gap-5">
      {current.length === 0 ? (
        <p className="text-[14px] text-ink-invert-muted">No tags yet.</p>
      ) : (
        <ul aria-label="Current tags" className="flex flex-wrap gap-2">
          {current.map((tag) => (
            <li key={tag} className={`${TAG} h-8 gap-1.5 pr-1 text-[13px]`}>
              {tag}
              {mayWrite ? (
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Remove the tag ${tag}`}
                  onClick={() => {
                    setCurrent(current.filter((entry) => entry !== tag));
                  }}
                  className="flex size-6 items-center justify-center rounded text-admin-muted transition-colors duration-150 hover:bg-admin-mist hover:text-ink-invert disabled:opacity-40"
                >
                  <CloseIcon className="size-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {mayWrite ? (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="subscriber-tag-draft" className={LABEL}>
              Add a tag
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="subscriber-tag-draft"
                value={draft}
                disabled={busy}
                maxLength={40}
                aria-describedby="subscriber-tag-help"
                onChange={(event) => {
                  setDraft(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    add();
                  }
                }}
                placeholder="newsletter"
                className={`${INPUT} min-w-50 flex-1`}
              />
              <button type="button" onClick={add} disabled={busy || !draft.trim()} className={button('secondary')}>
                Add
              </button>
            </div>
            <p id="subscriber-tag-help" className={HELP}>
              Short and lower-case, like “newsletter” or “vip”. Press Enter or Add to put it in the set.
            </p>
          </div>

          {error ? (
            <p role="alert" className={ERROR}>
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} disabled={busy || !changed} className={button('primary')}>
              {busy ? 'Saving…' : 'Save tags'}
            </button>
            {changed && !busy ? <span className="text-[13px] text-admin-muted">Not saved yet.</span> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
