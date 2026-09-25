'use client';
import { useId, useState } from 'react';
import { INPUT, LABEL } from './editor-parts';

/**
 * Page copy as a form (docs/08-decisions.md, 58).
 *
 * A page's copy is stored as one JSON value validated by that page's schema, which is what
 * keeps the site from being a page builder: the structure is fixed by the template, and only
 * the words change. This renders that value as fields — a text box per piece of copy, a
 * group per section, a list per list — so nobody edits JSON to change a heading. The API
 * validates the whole value on save and answers with the path of each field it refused;
 * the message appears under that field.
 *
 * `shapes` says what an empty list's new item, or a section that is not set, looks like,
 * keyed by path with list positions written `#` (`painPoints.items.#`, `compliance`). A
 * section with a shape can be added and removed; one without cannot be created here, which
 * keeps the editor from inventing structure the schema does not have.
 *
 * Client-only and free of the shared barrel, so it adds nothing but itself to the route.
 */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface CopyEditorProps {
  value: Json;
  onChange: (value: Json) => void;
  /** Field errors from the API, keyed by dotted path. */
  errors?: Record<string, string[]>;
  /** The path of this value in the request, to match errors: `content`. Empty for a whole value. */
  errorPrefix?: string;
  shapes?: Record<string, Json>;
}

export function CopyEditor({ value, onChange, errors = {}, errorPrefix = '', shapes = {} }: CopyEditorProps) {
  const [raw, setRaw] = useState<string | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const rawId = useId();
  const context: Context = { errors, errorPrefix, shapes, idBase: useId() };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button
          type="button"
          className={SMALL_BUTTON}
          onClick={() => {
            setRawError(null);
            setRaw(raw === null ? JSON.stringify(value, null, 2) : null);
          }}
        >
          {raw === null ? 'Edit as JSON' : 'Back to fields'}
        </button>
      </div>
      {raw === null ? (
        <Node value={value} path={[]} label={null} onChange={onChange} context={context} />
      ) : (
        <div className="flex flex-col gap-[3px]">
          <label htmlFor={rawId} className={LABEL}>
            The copy as JSON
          </label>
          <textarea
            id={rawId}
            rows={24}
            spellCheck={false}
            value={raw}
            aria-invalid={rawError ? true : undefined}
            onChange={(event) => {
              const text = event.target.value;
              setRaw(text);
              try {
                onChange(JSON.parse(text) as Json);
                setRawError(null);
              } catch {
                setRawError('Not valid JSON yet. The fields keep the last valid version.');
              }
            }}
            className="w-full rounded-[4px] border border-admin-line bg-admin-surface px-2 py-1.5 font-mono text-[12px] text-admin-ink outline-none focus-visible:border-admin-focus"
          />
          {rawError ? (
            <p role="alert" className="text-[11px] text-danger">
              {rawError}
            </p>
          ) : null}
        </div>
      )}
      <FieldErrors messages={errors[errorPrefix || '_form']} />
    </div>
  );
}

// ---------------------------------------------------------------- the tree

interface Context {
  errors: Record<string, string[]>;
  errorPrefix: string;
  shapes: Record<string, Json>;
  idBase: string;
}

type Path = (string | number)[];

const AREA =
  'w-full rounded-[4px] border border-admin-line bg-admin-surface px-2 py-1.5 text-[12.5px] text-admin-ink outline-none focus-visible:border-admin-focus';

const SMALL_BUTTON =
  'h-[26px] rounded-[4px] border border-admin-line px-2 text-[11px] font-semibold text-admin-body hover:border-admin-focus hover:text-admin-ink disabled:opacity-40';

function Node({
  value,
  path,
  label,
  onChange,
  context,
}: {
  value: Json;
  path: Path;
  label: string | null;
  onChange: (value: Json) => void;
  context: Context;
}) {
  const shape = context.shapes[shapeKey(path)];

  if (Array.isArray(value)) {
    return <List items={value} path={path} label={label ?? 'Items'} onChange={onChange} context={context} />;
  }
  if (value !== null && typeof value === 'object') {
    return <Group value={value} path={path} label={label} onChange={onChange} context={context} />;
  }
  if (value === null && shape !== undefined && typeof shape === 'string') {
    // A piece of copy that may be left out: empty stores null.
    return (
      <Text
        value=""
        path={path}
        label={label ?? ''}
        onChange={(text) => {
          onChange(text === '' ? null : text);
        }}
        context={context}
      />
    );
  }
  if (value === null) {
    return <NotSet path={path} label={label ?? ''} shape={shape} onChange={onChange} context={context} />;
  }
  if (typeof value === 'string') {
    const optional = shape !== undefined && typeof shape === 'string';
    return (
      <Text
        value={value}
        path={path}
        label={label ?? ''}
        onChange={(text) => {
          onChange(optional && text === '' ? null : text);
        }}
        context={context}
      />
    );
  }
  if (typeof value === 'number') {
    return (
      <Text
        value={String(value)}
        path={path}
        label={label ?? ''}
        type="number"
        onChange={(text) => {
          onChange(Number(text) || 0);
        }}
        context={context}
      />
    );
  }
  return (
    <label className="flex items-center gap-2 text-[12.5px] text-admin-ink">
      <input
        type="checkbox"
        checked={value}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      {label}
    </label>
  );
}

function Group({
  value,
  path,
  label,
  onChange,
  context,
}: {
  value: { [key: string]: Json };
  path: Path;
  label: string | null;
  onChange: (value: Json) => void;
  context: Context;
}) {
  const removable = path.length > 0 && context.shapes[shapeKey(path)] !== undefined && typeof path.at(-1) === 'string';
  const fields = Object.entries(value).map(([key, inner]) => (
    <Node
      key={key}
      value={inner}
      path={[...path, key]}
      label={humanize(key)}
      onChange={(next) => {
        onChange({ ...value, [key]: next });
      }}
      context={context}
    />
  ));

  if (label === null) return <div className="flex flex-col gap-3">{fields}</div>;
  return (
    <fieldset className="flex min-w-0 flex-col gap-3 rounded-[4px] border border-admin-line p-3">
      <legend className="px-1 text-[10.5px] font-bold tracking-[0.1em] text-admin-ink uppercase">{label}</legend>
      {fields}
      <FieldErrors messages={context.errors[errorKey(context, path)]} />
      {removable ? (
        <div>
          <button
            type="button"
            className={SMALL_BUTTON}
            onClick={() => {
              onChange(null);
            }}
          >
            Leave this section out
          </button>
        </div>
      ) : null}
    </fieldset>
  );
}

function List({
  items,
  path,
  label,
  onChange,
  context,
}: {
  items: Json[];
  path: Path;
  label: string;
  onChange: (value: Json) => void;
  context: Context;
}) {
  const blank = context.shapes[shapeKey([...path, 0])] ?? (items[0] === undefined ? undefined : emptied(items[0]));
  const move = (from: number, to: number): void => {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    if (moved === undefined) return;
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <fieldset className="flex min-w-0 flex-col gap-2 rounded-[4px] border border-admin-line p-3">
      <legend className="px-1 text-[10.5px] font-bold tracking-[0.1em] text-admin-ink uppercase">{label}</legend>
      {items.length === 0 ? <p className="text-[11.5px] text-admin-muted">None yet.</p> : null}
      {items.map((item, index) => (
        <div key={index} className="flex flex-col gap-2 border-b border-admin-line pb-2 last:border-b-0">
          <Node
            value={item}
            path={[...path, index]}
            label={`${label} ${String(index + 1)}`}
            onChange={(next) => {
              onChange(items.map((entry, i) => (i === index ? next : entry)));
            }}
            context={context}
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={SMALL_BUTTON}
              disabled={index === 0}
              onClick={() => {
                move(index, index - 1);
              }}
            >
              Move up
            </button>
            <button
              type="button"
              className={SMALL_BUTTON}
              disabled={index === items.length - 1}
              onClick={() => {
                move(index, index + 1);
              }}
            >
              Move down
            </button>
            <button
              type="button"
              className={SMALL_BUTTON}
              onClick={() => {
                onChange(items.filter((_, i) => i !== index));
              }}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <FieldErrors messages={context.errors[errorKey(context, path)]} />
      {blank !== undefined ? (
        <div>
          <button
            type="button"
            className={SMALL_BUTTON}
            onClick={() => {
              onChange([...items, blank]);
            }}
          >
            Add to {label.toLowerCase()}
          </button>
        </div>
      ) : null}
    </fieldset>
  );
}

function Text({
  value,
  path,
  label,
  type = 'text',
  onChange,
  context,
}: {
  value: string;
  path: Path;
  label: string;
  type?: string;
  onChange: (value: string) => void;
  context: Context;
}) {
  const id = `${context.idBase}-${path.join('-')}`;
  const messages = context.errors[errorKey(context, path)];
  const long = type === 'text' && (value.length > 90 || LONG_KEYS.test(String(path.at(-1) ?? '')));
  const className = `${long ? AREA : INPUT} ${messages ? 'border-danger' : ''}`;

  return (
    <div className="flex min-w-0 flex-col gap-[3px]">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      {long ? (
        <textarea
          id={id}
          rows={Math.min(8, Math.max(2, Math.ceil(value.length / 90)))}
          value={value}
          aria-invalid={messages ? true : undefined}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          className={className}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          aria-invalid={messages ? true : undefined}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          className={className}
        />
      )}
      <FieldErrors messages={messages} />
    </div>
  );
}

function NotSet({
  path,
  label,
  shape,
  onChange,
  context,
}: {
  path: Path;
  label: string;
  shape: Json | undefined;
  onChange: (value: Json) => void;
  context: Context;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[4px] border border-dashed border-admin-line px-3 py-2">
      <span className="text-[11.5px] text-admin-body">
        <span className="font-semibold text-admin-ink">{label}</span> is not set, so the page leaves it out.
      </span>
      {shape !== undefined ? (
        <button
          type="button"
          className={SMALL_BUTTON}
          onClick={() => {
            onChange(structuredClone(shape));
          }}
        >
          Add {label.toLowerCase()}
        </button>
      ) : null}
      <FieldErrors messages={context.errors[errorKey(context, path)]} />
    </div>
  );
}

function FieldErrors({ messages }: { messages: string[] | undefined }) {
  if (!messages?.length) return null;
  return (
    <p role="alert" className="text-[11px] text-danger">
      {messages.join(' ')}
    </p>
  );
}

// ---------------------------------------------------------------- helpers

const LONG_KEYS = /intro|body|answer|description|note|quote|summary|outcome|approach|challenge|message/i;

/** A path with list positions written `#`, which is how `shapes` names them. */
export function shapeKey(path: Path): string {
  return path.map((part) => (typeof part === 'number' ? '#' : part)).join('.');
}

function errorKey(context: Context, path: Path): string {
  return [context.errorPrefix, ...path.map(String)].filter(Boolean).join('.');
}

/** A copy of an item with its words taken out, for a new entry in the same list. */
export function emptied(value: Json): Json {
  if (typeof value === 'string') return '';
  if (typeof value === 'number') return 0;
  if (typeof value === 'boolean') return false;
  if (value === null) return null;
  if (Array.isArray(value)) return [];
  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, emptied(inner)]));
}

const WORDS: Record<string, string> = {
  cta: 'call to action',
  seo: 'search result',
  faq: 'questions',
  og: 'share',
  src: 'image address',
  alt: 'image description',
  href: 'link',
  url: 'address',
};

/** `primaryCta` to "Primary call to action". */
export function humanize(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .map((word) => WORDS[word.toLowerCase()] ?? word.toLowerCase());
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
