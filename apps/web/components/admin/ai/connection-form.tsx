'use client';
import type { AiConnection, AiTestResult } from '@calwebtech/shared';
import { AI_PROVIDERS, aiProvider, type AiProviderId, type AiProviderInfo } from '@calwebtech/shared/ai-providers';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { MutationError, adminMutate } from '@/lib/admin/mutate';
import { EyeIcon, ExternalIcon } from '../icons';
import { CHECK, ERROR, H3, HELP, INPUT, LABEL, LINK, button } from '../ui/styles';

/**
 * Adding a connection, or changing one (docs/08-decisions.md, 64).
 *
 * The key field is a password field that is never filled in from the server: there is no key
 * to fill it with, since the API never returns one. Editing leaves it empty, and an empty
 * key field means "keep the one stored".
 *
 * Saving a new connection tries it straight away, so the owner learns at once whether the
 * key works, rather than the first time a feature needs it.
 */
const FIRST: AiProviderInfo = AI_PROVIDERS[0];

/** A provider's details, typed as the general shape so its optional fields can be read. */
function infoOf(id: string): AiProviderInfo {
  return aiProvider(id) ?? FIRST;
}

export const TEST_PROMPT = 'Reply with one short, friendly sentence to confirm you are connected.';

export function ConnectionForm({
  existing,
  onDone,
  onTested,
}: {
  /** The connection being changed; absent when adding one. */
  existing?: AiConnection;
  onDone: () => void;
  onTested: (id: string, result: AiTestResult) => void;
}) {
  const router = useRouter();
  const id = useId();
  const [provider, setProvider] = useState<AiProviderId>(existing?.provider ?? 'anthropic');
  const info = infoOf(provider);
  const [label, setLabel] = useState(existing?.label ?? info.name);
  const [labelTouched, setLabelTouched] = useState(Boolean(existing));
  const [model, setModel] = useState(existing?.model ?? info.models.at(0) ?? '');
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? '');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [makeDefault, setMakeDefault] = useState(false);
  const [models, setModels] = useState<readonly string[]>(info.models);
  const [loadingModels, setLoadingModels] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const choose = (next: AiProviderId): void => {
    const nextInfo = infoOf(next);
    setProvider(next);
    setModel(nextInfo.models.at(0) ?? '');
    setModels(nextInfo.models);
    if (!labelTouched) setLabel(nextInfo.name);
    setFieldErrors({});
  };

  // A key pasted into the wrong provider is the commonest mistake; say so before saving.
  const keyMismatch = Boolean(apiKey && info.keyPrefix && !apiKey.trim().startsWith(info.keyPrefix));

  const save = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      if (existing) {
        await adminMutate(`/admin/ai/connections/${encodeURIComponent(existing.id)}`, {
          method: 'PATCH',
          body: {
            label,
            model,
            ...(info.baseUrl === null ? { baseUrl } : {}),
            ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          },
        });
        setApiKey('');
        router.refresh();
        onDone();
        return;
      }
      const created = await adminMutate<AiConnection>('/admin/ai/connections', {
        method: 'POST',
        body: {
          provider,
          label,
          model,
          ...(info.baseUrl === null ? { baseUrl } : {}),
          apiKey: apiKey.trim(),
          makeDefault,
        },
      });
      setApiKey('');
      router.refresh();
      onDone();
      // Try it at once, so the owner knows whether the key works.
      const result = await adminMutate<AiTestResult>(`/admin/ai/connections/${encodeURIComponent(created.id)}/test`, {
        method: 'POST',
        body: { prompt: TEST_PROMPT, maxTokens: 120 },
      });
      onTested(created.id, result);
      router.refresh();
    } catch (cause) {
      if (cause instanceof MutationError) {
        setError(cause.message);
        setFieldErrors(cause.fieldErrors);
      } else {
        setError('That could not be saved.');
      }
    } finally {
      setBusy(false);
    }
  };

  const loadModels = async (): Promise<void> => {
    if (!existing) return;
    setLoadingModels(true);
    setError(null);
    try {
      const list = await adminMutate<{ models: string[] }>(`/admin/ai/connections/${encodeURIComponent(existing.id)}/models`, {
        method: 'POST',
      });
      setModels(list.models.length > 0 ? list.models : info.models);
      if (list.models.length === 0) setError('The provider listed no models for this key.');
    } catch (cause) {
      setError(cause instanceof MutationError ? cause.message : 'The model list could not be loaded.');
    } finally {
      setLoadingModels(false);
    }
  };

  const errorsFor = (field: string): string[] | undefined => fieldErrors[field];

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {existing ? null : (
        <fieldset className="flex flex-col gap-3">
          <legend className={`${H3} mb-1`}>Choose a provider</legend>
          <p className={HELP}>Any of these works. You can add more than one and switch between them later.</p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {AI_PROVIDERS.map((entry) => {
              const chosen = entry.id === provider;
              return (
                <label
                  key={entry.id}
                  className={`relative flex min-h-[76px] cursor-pointer flex-col gap-1 rounded-xl border p-3.5 transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-admin-focus ${
                    chosen ? 'border-gold-500 bg-admin-nav' : 'border-admin-line2 bg-admin-sunken hover:border-admin-edge'
                  }`}
                >
                  <input
                    type="radio"
                    name={`${id}-provider`}
                    value={entry.id}
                    checked={chosen}
                    onChange={() => {
                      choose(entry.id);
                    }}
                    className="sr-only"
                  />
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[14px] font-semibold text-ink-invert">{entry.name}</span>
                    <span
                      aria-hidden
                      className={`size-4 shrink-0 rounded-full border-2 ${chosen ? 'border-gold-500 bg-gold-500 ring-2 ring-admin-nav ring-inset' : 'border-admin-line'}`}
                    />
                  </span>
                  <span className="text-[12.5px] leading-[1.45] text-admin-muted">{entry.blurb}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id={`${id}-label`} label="Name" help="For you: what this connection is for." errors={errorsFor('label')}>
          <input
            id={`${id}-label`}
            value={label}
            maxLength={60}
            onChange={(event) => {
              setLabel(event.target.value);
              setLabelTouched(true);
            }}
            aria-invalid={errorsFor('label') ? true : undefined}
            className={INPUT}
          />
        </Field>

        <Field
          id={`${id}-model`}
          label={info.id === 'azure' ? 'Deployment' : 'Model'}
          help={info.modelHelp ?? 'Pick a suggestion or type any model this provider offers.'}
          errors={errorsFor('model')}
        >
          <input
            id={`${id}-model`}
            value={model}
            list={`${id}-models`}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              setModel(event.target.value);
            }}
            aria-invalid={errorsFor('model') ? true : undefined}
            className={INPUT}
          />
          <datalist id={`${id}-models`}>
            {models.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          {existing ? (
            <button type="button" onClick={() => void loadModels()} disabled={loadingModels} className={`${button('ghost', 'sm')} self-start`}>
              {loadingModels ? 'Asking the provider…' : 'Load this provider’s current models'}
            </button>
          ) : null}
        </Field>
      </div>

      {info.baseUrl === null ? (
        <Field
          id={`${id}-base`}
          label="Address"
          help={`The provider’s API address, starting with https://. For example: ${info.baseUrlExample ?? 'https://api.example.com/v1'}`}
          errors={errorsFor('baseUrl')}
        >
          <input
            id={`${id}-base`}
            type="url"
            inputMode="url"
            value={baseUrl}
            placeholder={info.baseUrlExample}
            spellCheck={false}
            onChange={(event) => {
              setBaseUrl(event.target.value);
            }}
            aria-invalid={errorsFor('baseUrl') ? true : undefined}
            className={INPUT}
          />
        </Field>
      ) : null}

      <Field
        id={`${id}-key`}
        label="API key"
        help={
          existing
            ? `Leave empty to keep the stored key (ending ${existing.keyHint}). A new key replaces it.`
            : 'Encrypted before it is stored. Nobody, you included, can read it back from the dashboard.'
        }
        errors={errorsFor('apiKey')}
        extra={
          info.keysUrl ? (
            <a href={info.keysUrl} target="_blank" rel="noopener noreferrer" className={`${LINK} inline-flex items-center gap-1 text-[12.5px]`}>
              Get a key from {info.name}
              <ExternalIcon className="size-3.5" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null
        }
      >
        <div className="relative">
          <input
            id={`${id}-key`}
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            required={!existing}
            autoComplete="off"
            spellCheck={false}
            placeholder={existing ? `•••• ${existing.keyHint}` : info.keyPrefix ? `${info.keyPrefix}…` : 'Paste the key'}
            onChange={(event) => {
              setApiKey(event.target.value);
            }}
            aria-invalid={errorsFor('apiKey') ? true : undefined}
            className={`${INPUT} pr-12 font-mono`}
          />
          <button
            type="button"
            onClick={() => {
              setShowKey((current) => !current);
            }}
            aria-pressed={showKey}
            className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-admin-muted hover:text-ink-invert"
          >
            <EyeIcon open={!showKey} className="size-4" />
            <span className="sr-only">{showKey ? 'Hide the key' : 'Show the key'}</span>
          </button>
        </div>
        {keyMismatch ? (
          <p className="text-[12.5px] text-gold-500">
            {info.name} keys usually start with “{info.keyPrefix}”. Check it is the right provider’s key.
          </p>
        ) : null}
      </Field>

      {existing ? null : (
        <label className="flex items-center gap-2.5 text-[14px] text-ink-invert">
          <input
            type="checkbox"
            checked={makeDefault}
            onChange={(event) => {
              setMakeDefault(event.target.checked);
            }}
            className={CHECK}
          />
          Make this the one the site uses
          <span className="text-[12.5px] text-admin-muted">(the first connection always is)</span>
        </label>
      )}

      {error ? (
        <p role="alert" className={ERROR}>
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2.5 border-t border-admin-line2 pt-5">
        <button type="submit" disabled={busy} className={button('primary')}>
          {busy ? (existing ? 'Saving…' : 'Saving and testing…') : existing ? 'Save changes' : 'Save and test'}
        </button>
        <button type="button" onClick={onDone} className={button('ghost')}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  help,
  errors,
  extra,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  errors?: string[];
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={id} className={LABEL}>
          {label}
        </label>
        {extra}
      </span>
      {children}
      {errors?.length ? (
        <p role="alert" className={ERROR}>
          {errors.join(' ')}
        </p>
      ) : help ? (
        <p className={HELP}>{help}</p>
      ) : null}
    </div>
  );
}
