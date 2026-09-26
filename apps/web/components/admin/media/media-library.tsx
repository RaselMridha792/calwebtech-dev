'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { MutationError, adminMutate, adminUpload } from '@/lib/admin/mutate';
import { MediaIcon } from '../icons';
import { EmptyState } from '../ui/page';
import { CARD, CARD_PAD, ERROR, H2, HELP, INPUT, LABEL, MUTED, button } from '../ui/styles';

/**
 * The media library (docs/12-admin-dashboard.md, module 7).
 *
 * The upload form asks for the description *before* it will take the file, because alt
 * text added later is alt text nobody writes: by the time someone is looking for an image
 * to reuse, whoever knew what it showed has gone.
 *
 * Deleting is refused by the API while anything still points at the asset, and the refusal
 * names the records, so the answer is "replace it there first" rather than a broken page.
 */
export interface Asset {
  id: string;
  url: string;
  altText: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  variantCount: number;
  uploadedBy: string | null;
  createdAt: string;
}

export function MediaLibrary({ assets, accept, maxBytes }: { assets: Asset[]; accept: string; maxBytes: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <UploadForm
        accept={accept}
        maxBytes={maxBytes}
        onDone={() => {
          setError(null);
          router.refresh();
        }}
        onError={setError}
      />

      {error ? (
        <p role="alert" className={`${ERROR} motion-safe:animate-[admin-rise_180ms_var(--ease-out-quint)]`}>
          {error}
        </p>
      ) : null}

      {assets.length === 0 ? (
        <div className={CARD}>
          <EmptyState icon={<MediaIcon className="size-5" />} title="No images yet">
            Add the first one above. Once an image is in the library it can be picked for any service, industry,
            case study or page.
          </EmptyState>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onChanged={() => {
                setError(null);
                router.refresh();
              }}
              onError={setError}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function UploadForm({
  accept,
  maxBytes,
  onDone,
  onError,
}: {
  accept: string;
  maxBytes: number;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [altText, setAltText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function submit(): void {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    const form = new FormData();
    form.append('file', file);
    form.append('altText', altText.trim());
    void adminUpload('/admin/media', form)
      .then(() => {
        setAltText('');
        setFileName(null);
        if (fileRef.current) fileRef.current.value = '';
        onDone();
      })
      .catch((cause: unknown) => {
        onError(cause instanceof MutationError ? cause.message : 'That upload failed.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  const described = altText.trim().length > 0;
  const megabytes = String(Math.round(maxBytes / 1024 / 1024));

  return (
    <section aria-labelledby="media-upload" className={`${CARD} ${CARD_PAD}`}>
      <div className="mb-5 flex flex-col gap-1">
        <h2 id="media-upload" className={H2}>
          Add an image
        </h2>
        <p className="text-[13.5px] leading-[1.55] text-ink-invert-muted">
          Describe the picture first, then choose the file. {formats(accept)}, up to {megabytes} MB.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="media-alt" className={LABEL}>
            What does the image show?
          </label>
          <input
            id="media-alt"
            value={altText}
            onChange={(event) => {
              setAltText(event.target.value);
            }}
            placeholder="A description someone who cannot see it would need"
            aria-describedby="media-alt-help"
            className={INPUT}
          />
          <p id="media-alt-help" className={HELP}>
            This is read aloud to visitors who use a screen reader and shown to search engines, so it is required:
            the library will not take an image without it.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="media-file" className={LABEL}>
            Image
          </label>
          {/*
            The real file input covers the whole zone, invisible, so a click or a dropped file
            anywhere on it reaches the browser's own picker. The ring and the dimming follow
            the input's own state through `has-`.
          */}
          <div
            className={`relative flex min-h-[124px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-5 text-center transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-admin-focus has-disabled:opacity-50 ${
              fileName ? 'border-admin-edge bg-admin-nav' : 'border-admin-line bg-admin-sunken hover:border-admin-edge'
            }`}
          >
            <input
              id="media-file"
              ref={fileRef}
              type="file"
              accept={accept}
              disabled={!described}
              aria-describedby="media-file-help"
              onChange={(event) => {
                setFileName(event.target.files?.[0]?.name ?? null);
              }}
              className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            />
            <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-admin-mist text-admin-link">
              <MediaIcon className="size-4" />
            </span>
            <span className="text-[14px] font-semibold text-ink-invert">
              {fileName ?? 'Choose an image or drop one here'}
            </span>
            <span id="media-file-help" className={HELP}>
              {fileName
                ? 'Chosen. Change it by choosing again.'
                : described
                  ? `Up to ${megabytes} MB. Copies are made at four sizes.`
                  : 'Describe the image first — the library will not take one without a description.'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-admin-line2 pt-4">
        <p className={HELP}>The original is kept, and AVIF and WebP copies are made at four widths for the site to use.</p>
        <button type="button" onClick={submit} disabled={busy || !described || !fileName} className={button('primary')}>
          {busy ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </section>
  );
}

/** "image/jpeg,image/png" as the words a person would use: "JPEG, PNG". */
function formats(accept: string): string {
  const names: Record<string, string> = { jpeg: 'JPEG', png: 'PNG', webp: 'WebP', avif: 'AVIF', gif: 'GIF', svg: 'SVG' };
  return accept
    .split(',')
    .map((type) => type.trim().split('/')[1] ?? '')
    .filter(Boolean)
    .map((subtype) => names[subtype.replace('+xml', '')] ?? subtype.toUpperCase())
    .join(', ');
}

function AssetCard({
  asset,
  onChanged,
  onError,
}: {
  asset: Asset;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [altText, setAltText] = useState(asset.altText);
  const [busy, setBusy] = useState(false);

  function run(promise: Promise<unknown>): void {
    setBusy(true);
    void promise
      .then(() => {
        setEditing(false);
        onChanged();
      })
      .catch((cause: unknown) => {
        onError(cause instanceof MutationError ? cause.message : 'That could not be applied.');
      })
      .finally(() => {
        setBusy(false);
      });
  }

  return (
    <li className={`${CARD} flex flex-col overflow-hidden`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- the admin previews the file
          as uploaded; next/image would re-optimise an image the library has already
          encoded, and its loader cannot reach an API path at build time. */}
      <img src={asset.url} alt={asset.altText} className="aspect-[4/3] w-full bg-admin-sunken object-cover" />

      <div className="flex flex-1 flex-col gap-2 p-4">
        {editing ? (
          <>
            <label className={LABEL} htmlFor={`alt-${asset.id}`}>
              Alt text
            </label>
            <input
              id={`alt-${asset.id}`}
              value={altText}
              onChange={(event) => {
                setAltText(event.target.value);
              }}
              className={INPUT}
            />
            <div className="mt-1 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                className={button('primary', 'sm')}
                onClick={() => {
                  run(adminMutate(`/admin/media/${encodeURIComponent(asset.id)}`, { method: 'PATCH', body: { altText } }));
                }}
              >
                Save
              </button>
              <button
                type="button"
                disabled={busy}
                className={button('ghost', 'sm')}
                onClick={() => {
                  setAltText(asset.altText);
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="line-clamp-2 text-[14px] leading-[1.45] font-semibold text-ink-invert">{asset.altText}</p>
            <p className={`${MUTED} tabular-nums`}>
              {asset.width && asset.height ? `${String(asset.width)} × ${String(asset.height)}` : 'Size unknown'}
              {asset.sizeBytes ? ` · ${String(Math.round(asset.sizeBytes / 1024))} kB` : ''} · {asset.variantCount}{' '}
              {asset.variantCount === 1 ? 'copy' : 'copies'}
            </p>
            <p className={MUTED}>
              Added {added(asset.createdAt)}
              {asset.uploadedBy ? ` by ${asset.uploadedBy}` : ''}
            </p>
            <div className="mt-auto flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                disabled={busy}
                className={button('secondary', 'sm')}
                onClick={() => {
                  setEditing(true);
                }}
              >
                Edit text
              </button>
              <button
                type="button"
                disabled={busy}
                className={button('danger', 'sm')}
                onClick={() => {
                  run(adminMutate(`/admin/media/${encodeURIComponent(asset.id)}`, { method: 'DELETE' }));
                }}
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </li>
  );
}

function added(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
