'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
    <section className="mt-8 border-t border-admin-line pt-5">
      <h2 className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">Tags</h2>

      {current.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-admin-body">No tags.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {current.map((tag) => (
            <li
              key={tag}
              className="flex h-8 items-center gap-2 rounded-[4px] border border-admin-line px-3 text-[12.5px] text-admin-ink"
            >
              {tag}
              {mayWrite ? (
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Remove the tag ${tag}`}
                  onClick={() => {
                    setCurrent(current.filter((entry) => entry !== tag));
                  }}
                  className="text-admin-muted hover:text-admin-ink disabled:opacity-40"
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {mayWrite ? (
        <>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex min-w-[200px] flex-1 flex-col gap-[3px]">
              <span className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">Add a tag</span>
              <input
                value={draft}
                disabled={busy}
                maxLength={40}
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
                className="h-[30px] w-full rounded-[4px] border border-admin-line bg-admin-surface px-2 text-[12.5px] text-admin-ink outline-none focus-visible:border-admin-focus"
              />
            </label>
            <button
              type="button"
              onClick={add}
              disabled={busy || !draft.trim()}
              className="h-8 rounded-[4px] border border-admin-line px-3 text-[12.5px] font-semibold text-admin-body hover:border-admin-focus disabled:opacity-40"
            >
              Add
            </button>
          </div>

          {error ? (
            <p role="alert" className="mt-2 text-[12.5px] text-danger">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={save}
            disabled={busy || !changed}
            className="mt-3 h-9 rounded-[4px] bg-primary px-4 text-[12.5px] font-semibold text-white hover:bg-admin-primaryh disabled:opacity-40"
          >
            {busy ? 'Saving…' : 'Save tags'}
          </button>
        </>
      ) : null}
    </section>
  );
}
