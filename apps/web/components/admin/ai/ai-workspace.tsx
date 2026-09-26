'use client';
import type { AiConnection, AiTestResult } from '@calwebtech/shared';
import { aiProvider } from '@calwebtech/shared/ai-providers';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';
import { PlusIcon, SparkIcon } from '../icons';
import { CARD, ERROR, H2, HELP, KICKER, LABEL, PILL, SELECT, TEXTAREA, button } from '../ui/styles';
import { ConnectionForm, TEST_PROMPT } from './connection-form';

/**
 * The AI screen's working parts (docs/08-decisions.md, 64): the saved connections, the form
 * that adds or changes one, and a test bench that sends a prompt through a connection and
 * shows exactly what came back.
 *
 * The connections are read on the server and handed in; after any change the page is
 * refreshed from the server rather than patched here, so what is shown is always what the
 * API holds.
 */
export function AiWorkspace({ connections, canStore }: { connections: AiConnection[]; canStore: boolean }) {
  const [mode, setMode] = useState<{ kind: 'idle' } | { kind: 'add' } | { kind: 'edit'; id: string }>(
    connections.length === 0 && canStore ? { kind: 'add' } : { kind: 'idle' },
  );
  const [results, setResults] = useState<Record<string, AiTestResult>>({});
  const fallback = connections.find((connection) => connection.isDefault)?.id ?? connections[0]?.id ?? '';
  const [chosen, setChosen] = useState(fallback);
  // The connection on the bench: the one chosen, or the default when that one is gone.
  const benchId = connections.some((connection) => connection.id === chosen) ? chosen : fallback;

  const tested = (id: string, result: AiTestResult): void => {
    setResults((current) => ({ ...current, [id]: result }));
    setChosen(id);
  };

  const editing = mode.kind === 'edit' ? connections.find((connection) => connection.id === mode.id) : undefined;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="flex min-w-0 flex-col gap-4">
        <section aria-labelledby="ai-connections" className={`${CARD} overflow-hidden`}>
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-5 pb-4 sm:px-6">
            <div>
              <h2 id="ai-connections" className={H2}>
                Connections
              </h2>
              <p className="mt-1 text-[13.5px] text-ink-invert-muted">
                The one marked “In use” is what the site calls. Keep others ready and switch at any time.
              </p>
            </div>
            {mode.kind === 'add' || !canStore ? null : (
              <button
                type="button"
                onClick={() => {
                  setMode({ kind: 'add' });
                }}
                className={button('primary')}
              >
                <PlusIcon className="size-4" />
                Add a connection
              </button>
            )}
          </div>
          {connections.length === 0 ? (
            <p className="border-t border-admin-line2 px-4 py-6 text-[14px] text-ink-invert-muted sm:px-6">
              No AI is connected yet. Add a provider and its key below; nothing is sent anywhere until you do.
            </p>
          ) : (
            <ul className="divide-y divide-admin-line2 border-t border-admin-line2">
              {connections.map((connection) => (
                <ConnectionRow
                  key={connection.id}
                  connection={connection}
                  result={results[connection.id]}
                  onEdit={() => {
                    setMode({ kind: 'edit', id: connection.id });
                  }}
                  onTest={() => {
                    setChosen(connection.id);
                    document.getElementById('ai-bench')?.scrollIntoView({ block: 'start' });
                  }}
                />
              ))}
            </ul>
          )}
        </section>

        {mode.kind === 'add' ? (
          <section aria-labelledby="ai-add" className={`${CARD} p-4 sm:p-6 motion-safe:animate-[admin-rise_180ms_var(--ease-out-quint)]`}>
            <h2 id="ai-add" className={`${H2} mb-5`}>
              Add a connection
            </h2>
            <ConnectionForm
              onDone={() => {
                setMode({ kind: 'idle' });
              }}
              onTested={tested}
            />
          </section>
        ) : null}

        {editing ? (
          <section aria-labelledby="ai-edit" className={`${CARD} p-4 sm:p-6 motion-safe:animate-[admin-rise_180ms_var(--ease-out-quint)]`}>
            <h2 id="ai-edit" className={`${H2} mb-5`}>
              Change “{editing.label}”
            </h2>
            <ConnectionForm
              key={editing.id}
              existing={editing}
              onDone={() => {
                setMode({ kind: 'idle' });
              }}
              onTested={tested}
            />
          </section>
        ) : null}
      </div>

      <TestBench
        connections={connections}
        chosen={benchId}
        onChoose={setChosen}
        result={results[benchId]}
        onResult={(result) => {
          tested(benchId, result);
        }}
      />
    </div>
  );
}

function ConnectionRow({
  connection,
  result,
  onEdit,
  onTest,
}: {
  connection: AiConnection;
  result: AiTestResult | undefined;
  onEdit: () => void;
  onTest: () => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const info = aiProvider(connection.provider);
  const last = result
    ? { ok: result.ok, latencyMs: result.latencyMs, error: result.error, at: null }
    : connection.lastTest
      ? { ...connection.lastTest }
      : null;

  const act = async (path: string, method: 'POST' | 'DELETE'): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await adminMutate(path, { method });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof MutationError ? cause.message : 'That did not work.');
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg border border-admin-line bg-admin-sunken text-admin-link">
            <SparkIcon className="size-[18px]" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink-invert">
              {connection.label}
              {connection.isDefault ? (
                <span className={PILL}>
                  <span aria-hidden className="size-2 rounded-full bg-gold-500" />
                  In use
                </span>
              ) : null}
            </p>
            <p className="text-[13px] break-all text-ink-invert-muted">
              {info?.name ?? connection.provider} · <span className="font-mono text-[12.5px]">{connection.model}</span>
            </p>
            <p className="text-[12.5px] text-admin-muted">
              Key <span className="font-mono">•••• {connection.keyHint}</span>
              {connection.baseUrl ? <> · {connection.baseUrl}</> : null}
            </p>
          </div>
        </div>
        <Health last={last} readable={connection.keyReadable} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onTest} className={button('secondary', 'sm')}>
          Test it
        </button>
        {connection.isDefault ? null : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void act(`/admin/ai/connections/${encodeURIComponent(connection.id)}/default`, 'POST')}
            className={button('secondary', 'sm')}
          >
            Use this one
          </button>
        )}
        <button type="button" onClick={onEdit} className={button('ghost', 'sm')}>
          Change
        </button>
        {confirming ? (
          <span role="group" aria-label={`Remove ${connection.label}?`} className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-ink-invert-muted">Remove it and its key for good?</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void act(`/admin/ai/connections/${encodeURIComponent(connection.id)}`, 'DELETE')}
              className={button('danger', 'sm')}
            >
              Yes, remove
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
              }}
              className={button('ghost', 'sm')}
            >
              Keep it
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setConfirming(true);
            }}
            className={button('ghost', 'sm')}
          >
            Remove
          </button>
        )}
      </div>
      {error ? (
        <p role="alert" className={ERROR}>
          {error}
        </p>
      ) : null}
    </li>
  );
}

/** Whether the connection worked the last time it was tried, in a word and a dot. */
function Health({
  last,
  readable,
}: {
  last: { ok: boolean; latencyMs: number | null; error: string | null; at: string | null } | null;
  readable: boolean;
}) {
  if (!readable) {
    return (
      <span className={PILL}>
        <span aria-hidden className="size-2 rounded-full bg-danger" />
        Key needs entering again
      </span>
    );
  }
  if (!last) {
    return (
      <span className={PILL}>
        <span aria-hidden className="size-2 rounded-full bg-admin-surface ring-2 ring-admin-muted ring-inset" />
        Not tested yet
      </span>
    );
  }
  return (
    <span className="flex flex-col items-end gap-1">
      <span className={PILL}>
        <span aria-hidden className={`size-2 rounded-full ${last.ok ? 'bg-result' : 'bg-danger'}`} />
        {last.ok ? 'Working' : 'Not working'}
      </span>
      {/* "2 min ago" is worked out again in the browser, a moment after the server did. */}
      <span suppressHydrationWarning className="text-[12px] text-admin-muted">
        {last.latencyMs === null ? '' : `${String(last.latencyMs)} ms`}
        {last.at ? ` · ${when(last.at)}` : ''}
      </span>
    </span>
  );
}

/**
 * Sends a prompt through a connection and shows the reply as the provider gave it, with the
 * model it says it used, how long it took and what it cost in tokens. Each run is a real
 * call on the owner's account, which the API limits per minute.
 */
function TestBench({
  connections,
  chosen,
  onChoose,
  result,
  onResult,
}: {
  connections: AiConnection[];
  chosen: string;
  onChoose: (id: string) => void;
  result: AiTestResult | undefined;
  onResult: (result: AiTestResult) => void;
}) {
  const router = useRouter();
  const id = useId();
  const [prompt, setPrompt] = useState(TEST_PROMPT);
  const [system, setSystem] = useState('');
  const [maxTokens, setMaxTokens] = useState(400);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (): Promise<void> => {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const answer = await adminMutate<AiTestResult>(`/admin/ai/connections/${encodeURIComponent(chosen)}/test`, {
        method: 'POST',
        body: { prompt, ...(system.trim() ? { system } : {}), maxTokens },
      });
      onResult(answer);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof MutationError ? cause.message : 'The test could not be run.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      id="ai-bench"
      aria-labelledby="ai-bench-title"
      className={`${CARD} flex scroll-mt-6 flex-col gap-4 p-4 sm:p-6 xl:sticky xl:top-6 xl:self-start`}
    >
      <div>
        <h2 id="ai-bench-title" className={H2}>
          Test bench
        </h2>
        <p className="mt-1 text-[13.5px] text-ink-invert-muted">
          Send a message through a connection and see exactly what comes back. Each run is a real request on your
          provider account.
        </p>
      </div>

      {connections.length === 0 ? (
        <p className="rounded-lg border border-dashed border-admin-line px-4 py-6 text-center text-[14px] text-ink-invert-muted">
          Add a connection first, then try it here.
        </p>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void run();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-connection`} className={LABEL}>
              Connection
            </label>
            <select
              id={`${id}-connection`}
              value={chosen}
              onChange={(event) => {
                onChoose(event.target.value);
              }}
              className={SELECT}
            >
              {connections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.label} · {connection.model}
                  {connection.isDefault ? ' (in use)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-prompt`} className={LABEL}>
              Message
            </label>
            <textarea
              id={`${id}-prompt`}
              rows={4}
              value={prompt}
              maxLength={4000}
              onChange={(event) => {
                setPrompt(event.target.value);
              }}
              className={TEXTAREA}
            />
          </div>

          <details className="group rounded-lg border border-admin-line2 bg-admin-sunken">
            <summary className="flex min-h-10 cursor-pointer items-center justify-between px-3 text-[13.5px] font-semibold text-ink-invert-muted marker:content-none hover:text-ink-invert">
              Instructions and length
              <span aria-hidden className="transition-transform duration-150 group-open:rotate-90">
                ›
              </span>
            </summary>
            <div className="flex flex-col gap-4 border-t border-admin-line2 p-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${id}-system`} className={LABEL}>
                  Instructions <span className="font-normal text-admin-muted">(optional)</span>
                </label>
                <textarea
                  id={`${id}-system`}
                  rows={3}
                  value={system}
                  maxLength={4000}
                  placeholder="For example: You write for a web agency in plain, warm British English."
                  onChange={(event) => {
                    setSystem(event.target.value);
                  }}
                  className={TEXTAREA}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${id}-length`} className={LABEL}>
                  Longest reply
                </label>
                <select
                  id={`${id}-length`}
                  value={maxTokens}
                  onChange={(event) => {
                    setMaxTokens(Number(event.target.value));
                  }}
                  className={SELECT}
                >
                  <option value={120}>Short (about 90 words)</option>
                  <option value={400}>Medium (about 300 words)</option>
                  <option value={1200}>Long (about 900 words)</option>
                </select>
                <p className={HELP}>A longer reply costs more on your provider account.</p>
              </div>
            </div>
          </details>

          <button type="submit" disabled={busy || !prompt.trim()} className={`${button('primary')} w-full`}>
            {busy ? 'Waiting for the reply…' : 'Send test'}
          </button>
          {error ? (
            <p role="alert" className={ERROR}>
              {error}
            </p>
          ) : null}
        </form>
      )}

      <div aria-live="polite">
        {result ? (
          <div className="flex flex-col gap-3 rounded-xl border border-admin-line2 bg-admin-sunken p-4 motion-safe:animate-[admin-rise_180ms_var(--ease-out-quint)]">
            <p className="flex items-center gap-2 text-[14px] font-semibold text-ink-invert">
              <span aria-hidden className={`size-2 rounded-full ${result.ok ? 'bg-result' : 'bg-danger'}`} />
              {result.ok ? 'It works. The reply:' : 'It did not work.'}
            </p>
            {result.text ? (
              <p className="max-h-[320px] overflow-y-auto text-[14px] leading-[1.65] whitespace-pre-wrap text-ink-invert">{result.text}</p>
            ) : null}
            {result.error ? <p className={ERROR}>{result.error}</p> : null}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-admin-line2 pt-3 text-[12.5px]">
              <dt className={KICKER}>Time</dt>
              <dd className="text-right text-ink-invert-muted tabular-nums">{(result.latencyMs / 1000).toFixed(1)} s</dd>
              {result.model ? (
                <>
                  <dt className={KICKER}>Model</dt>
                  <dd className="truncate text-right font-mono text-ink-invert-muted" title={result.model}>
                    {result.model}
                  </dd>
                </>
              ) : null}
              {result.usage ? (
                <>
                  <dt className={KICKER}>Tokens</dt>
                  <dd className="text-right text-ink-invert-muted tabular-nums">
                    {result.usage.input ?? '—'} in · {result.usage.output ?? '—'} out
                  </dd>
                </>
              ) : null}
            </dl>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function when(iso: string): string {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${String(minutes)} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${String(hours)} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
