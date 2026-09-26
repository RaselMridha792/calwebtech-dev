'use client';
import { useId, useState, type ReactNode } from 'react';
import { PlusIcon, SortIcon } from '@/components/admin/icons';
import {
  CARD,
  CARD_PAD,
  CHECK,
  ERROR,
  H2,
  H3,
  HELP,
  INPUT,
  LABEL,
  TEXTAREA,
  button,
  iconButton,
} from '@/components/admin/ui/styles';

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
 * On the screen, a page's top-level sections are cards with a heading each, so a long page
 * reads as a table of contents; a group inside a section is indented under its own heading,
 * and each entry in a list is a small card with its own controls. Loose fields between
 * sections share a card, in the order the page keeps them.
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
  /**
   * The heading level of the top-level sections: 2 on a screen of their own, where each is a
   * card; 3 inside a card that already has an h2, where they are plain headed groups.
   */
  level?: 2 | 3;
}

export function CopyEditor({ value, onChange, errors = {}, errorPrefix = '', shapes = {}, level = 2 }: CopyEditorProps) {
  const [raw, setRaw] = useState<string | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const rawId = useId();
  const context: Context = { errors, errorPrefix, shapes, idBase: useId(), level };

  return (
    <div className={`flex min-w-0 flex-col ${level === 2 ? 'gap-6' : 'gap-5'}`}>
      <div className="flex justify-end">
        <button
          type="button"
          className={button('ghost', 'sm')}
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
        <div className="flex min-w-0 flex-col gap-1.5">
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
            className={`${TEXTAREA} font-mono text-[13px]`}
          />
          {rawError ? (
            <p role="alert" className={ERROR}>
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
  level: 2 | 3;
}

type Path = (string | number)[];

/** A list entry: a small card of its own inside the section. */
const ITEM = 'flex min-w-0 flex-col gap-4 rounded-lg border border-admin-line2 bg-admin-sunken p-4';

/** A group inside a section: indented under its heading, so where it ends is visible. */
const NESTED = 'flex min-w-0 flex-col gap-4 border-l-2 border-admin-line2 pl-4 sm:pl-5';

/** A top-level section on a screen of its own. */
const SECTION = `${CARD} ${CARD_PAD} flex min-w-0 flex-col gap-5`;

function Node({
  value,
  path,
  label,
  onChange,
  context,
  flat = false,
}: {
  value: Json;
  path: Path;
  label: string | null;
  onChange: (value: Json) => void;
  context: Context;
  /** Inside a list entry, which already carries the heading and the frame. */
  flat?: boolean;
}) {
  const shape = context.shapes[shapeKey(path)];

  if (Array.isArray(value)) {
    return <List items={value} path={path} label={label ?? 'Items'} onChange={onChange} context={context} />;
  }
  if (value !== null && typeof value === 'object') {
    return <Group value={value} path={path} label={label} onChange={onChange} context={context} flat={flat} />;
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
    <label className="flex items-center gap-2.5 text-[14px] text-ink-invert">
      <input
        type="checkbox"
        className={CHECK}
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
  flat,
}: {
  value: { [key: string]: Json };
  path: Path;
  label: string | null;
  onChange: (value: Json) => void;
  context: Context;
  flat: boolean;
}) {
  const removable = path.length > 0 && context.shapes[shapeKey(path)] !== undefined && typeof path.at(-1) === 'string';
  const field = (key: string, inner: Json): ReactNode => (
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
  );

  if (label === null) return <Root value={value} field={field} context={context} />;

  const body = (
    <>
      <div className="flex min-w-0 flex-col gap-4">{Object.entries(value).map(([key, inner]) => field(key, inner))}</div>
      <FieldErrors messages={context.errors[errorKey(context, path)]} />
      {removable ? (
        <div>
          <button
            type="button"
            className={button('ghost', 'sm')}
            onClick={() => {
              onChange(null);
            }}
          >
            Leave this section out
          </button>
        </div>
      ) : null}
    </>
  );
  if (flat) return <div className="flex min-w-0 flex-col gap-4">{body}</div>;

  const level = headingLevel(context, path);
  const id = headingId(context, path);
  return (
    <section aria-labelledby={id} className={level === 2 ? SECTION : NESTED}>
      <Heading level={level} id={id}>
        {label}
      </Heading>
      {body}
    </section>
  );
}

/**
 * The whole value: its sections in the page's order. On a screen of its own, each section
 * is a card and the loose fields between sections share one, so nothing floats unframed.
 */
function Root({
  value,
  field,
  context,
}: {
  value: { [key: string]: Json };
  field: (key: string, inner: Json) => ReactNode;
  context: Context;
}) {
  const blocks: ReactNode[] = [];
  let loose: ReactNode[] = [];
  let looseKey = '';
  const flush = (): void => {
    if (loose.length === 0) return;
    blocks.push(
      <div key={`fields-${looseKey}`} className={context.level === 2 ? `${CARD} ${CARD_PAD} flex min-w-0 flex-col gap-4` : 'flex min-w-0 flex-col gap-4'}>
        {loose}
      </div>,
    );
    loose = [];
  };

  for (const [key, inner] of Object.entries(value)) {
    const shape = context.shapes[shapeKey([key])];
    const section = Array.isArray(inner) || (inner !== null && typeof inner === 'object') || (inner === null && typeof shape !== 'string');
    if (section) {
      flush();
      blocks.push(field(key, inner));
    } else {
      if (loose.length === 0) looseKey = key;
      loose.push(field(key, inner));
    }
  }
  flush();

  return <div className={`flex min-w-0 flex-col ${context.level === 2 ? 'gap-6' : 'gap-5'}`}>{blocks}</div>;
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
  const level = headingLevel(context, path);
  const id = headingId(context, path);
  const move = (from: number, to: number): void => {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    if (moved === undefined) return;
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <section aria-labelledby={id} className={level === 2 ? SECTION : 'flex min-w-0 flex-col gap-3'}>
      <Heading level={level} id={id}>
        {label}
      </Heading>
      {items.length === 0 ? <p className={HELP}>None yet.</p> : null}
      {items.length > 0 ? (
        <ol className="flex min-w-0 flex-col gap-3">
          {items.map((item, index) => {
            const name = `${label} ${String(index + 1)}`;
            const simple = item === null || typeof item !== 'object';
            const controls = (
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className={iconButton('sm')}
                  disabled={index === 0}
                  aria-label={`Move ${name} up`}
                  onClick={() => {
                    move(index, index - 1);
                  }}
                >
                  <SortIcon direction="asc" className="size-4" />
                </button>
                <button
                  type="button"
                  className={iconButton('sm')}
                  disabled={index === items.length - 1}
                  aria-label={`Move ${name} down`}
                  onClick={() => {
                    move(index, index + 1);
                  }}
                >
                  <SortIcon direction="desc" className="size-4" />
                </button>
                <button
                  type="button"
                  className={button('ghost', 'sm')}
                  aria-label={`Remove ${name}`}
                  onClick={() => {
                    onChange(items.filter((_, i) => i !== index));
                  }}
                >
                  Remove
                </button>
              </span>
            );
            const node = (
              <Node
                value={item}
                path={[...path, index]}
                label={name}
                onChange={(next) => {
                  onChange(items.map((entry, i) => (i === index ? next : entry)));
                }}
                context={context}
                flat
              />
            );
            return (
              <li key={index} className={ITEM}>
                {simple ? (
                  <>
                    {node}
                    <div className="flex">{controls}</div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Heading level={level + 1} id={headingId(context, [...path, index])}>
                        {name}
                      </Heading>
                      {controls}
                    </div>
                    {node}
                  </>
                )}
              </li>
            );
          })}
        </ol>
      ) : null}
      <FieldErrors messages={context.errors[errorKey(context, path)]} />
      {blank !== undefined ? (
        <div>
          <button
            type="button"
            className={button('secondary', 'sm')}
            onClick={() => {
              onChange([...items, blank]);
            }}
          >
            <PlusIcon className="size-4" />
            Add to {label.toLowerCase()}
          </button>
        </div>
      ) : null}
    </section>
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

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
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
          className={TEXTAREA}
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
          className={INPUT}
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
    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-dashed border-admin-line px-4 py-3">
      <span className="min-w-0 flex-1 basis-60 text-[13.5px] leading-[1.5] text-ink-invert-muted">
        <span className="font-semibold text-ink-invert">{label}</span> is not set, so the page leaves it out.
      </span>
      {shape !== undefined ? (
        <button
          type="button"
          className={button('secondary', 'sm')}
          onClick={() => {
            onChange(structuredClone(shape));
          }}
        >
          <PlusIcon className="size-4" />
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
    <p role="alert" className={ERROR}>
      {messages.map(plainly).join(' ')}
    </p>
  );
}

/** A section's or a list's heading, at the level its depth in the page gives it. */
function Heading({ level, id, children }: { level: number; id: string; children: ReactNode }) {
  const depth = Math.min(6, Math.max(2, level));
  const Tag = `h${String(depth)}` as 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  const className = depth === 2 ? H2 : depth === 3 ? H3 : 'text-[14px] font-semibold text-ink-invert';
  return (
    <Tag id={id} className={className}>
      {children}
    </Tag>
  );
}

/**
 * The validator's messages about length, in the words of someone writing copy. A schema's
 * own message ("Alt text is required") passes through unchanged.
 */
export function plainly(message: string): string {
  if (/expected string to have >=1 characters/.test(message)) return 'This cannot be empty.';
  const longest = /expected string to have <=(\d+) characters/.exec(message);
  if (longest) return `Keep this to ${longest[1] ?? ''} characters or fewer.`;
  const fewest = /expected array to have >=(\d+) items/.exec(message);
  if (fewest) return `This needs at least ${fewest[1] ?? ''}.`;
  const most = /expected array to have <=(\d+) items/.exec(message);
  if (most) return `This takes at most ${most[1] ?? ''}.`;
  return message;
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

/** A top-level section is h2 on its own screen and h3 inside a card; each level under it is one deeper. */
function headingLevel(context: Context, path: Path): number {
  return context.level + Math.max(0, path.length - 1);
}

function headingId(context: Context, path: Path): string {
  return `${context.idBase}-${path.join('-')}-heading`;
}

/**
 * `value` with its keys in `like`'s order, all the way down. Postgres stores JSON with its
 * keys sorted by length, so copy read back from a row lists the FAQ before the hero; the
 * editor shows sections in the page's order by laying the stored value over the template's.
 * Keys the template does not have follow, and nothing is added or dropped.
 */
export function ordered(value: Json, like: Json | undefined): Json {
  if (Array.isArray(value)) {
    const item = Array.isArray(like) ? like[0] : undefined;
    return value.map((entry) => ordered(entry, item));
  }
  if (value === null || typeof value !== 'object') return value;
  const template = like !== null && typeof like === 'object' && !Array.isArray(like) ? like : {};
  const keys = [
    ...Object.keys(template).filter((key) => key in value),
    ...Object.keys(value).filter((key) => !(key in template)),
  ];
  return Object.fromEntries(keys.map((key) => [key, ordered(value[key] ?? null, template[key])]));
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
