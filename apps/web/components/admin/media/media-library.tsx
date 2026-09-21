'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { MutationError, adminMutate, adminUpload } from '@/lib/admin/mutate';

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
    <div className="flex flex-col gap-5">
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
        <p role="alert" className="text-[12.5px] text-danger">
          {error}
        </p>
      ) : null}

      {assets.length === 0 ? (
        <p className="py-12 text-center text-[13px] text-admin-body">
          Nothing uploaded yet. Images added here can be used by every content type.
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
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

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-[4px] border border-admin-line bg-admin-sunken p-3">
      <div className="flex min-w-[260px] flex-1 flex-col gap-[3px]">
        <label htmlFor="media-alt" className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">
          What does the image show?
        </label>
        <input
          id="media-alt"
          value={altText}
          onChange={(event) => {
            setAltText(event.target.value);
          }}
          placeholder="A description someone who cannot see it would need"
          className="h-[30px] rounded-[4px] border border-admin-line bg-admin-surface px-2 text-[12.5px] text-admin-ink outline-none focus-visible:border-admin-focus"
        />
      </div>

      <div className="flex flex-col gap-[3px]">
        <label htmlFor="media-file" className="text-[9.5px] font-bold tracking-[0.12em] text-admin-muted uppercase">
          Image
        </label>
        <input
          id="media-file"
          ref={fileRef}
          type="file"
          accept={accept}
          disabled={!described}
          onChange={(event) => {
            setFileName(event.target.files?.[0]?.name ?? null);
          }}
          className="h-[30px] text-[12px] text-admin-body file:mr-2 file:h-[30px] file:rounded-[4px] file:border file:border-admin-line file:bg-admin-surface file:px-2 file:text-[12px] file:font-semibold file:text-admin-body disabled:opacity-40"
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={busy || !described || !fileName}
        className="h-[30px] rounded-[4px] bg-primary px-3 text-[12.5px] font-semibold text-white hover:bg-admin-primaryh disabled:opacity-40"
      >
        {busy ? 'Uploading…' : 'Upload'}
      </button>

      <p className="w-full text-[11px] text-admin-muted">
        {described
          ? `Up to ${String(Math.round(maxBytes / 1024 / 1024))} MB. AVIF and WebP copies are generated at four widths.`
          : 'Describe the image first — the library will not take one without a description.'}
      </p>
    </div>
  );
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
    <li className="flex flex-col overflow-hidden rounded-[4px] border border-admin-line bg-admin-surface">
      {/* eslint-disable-next-line @next/next/no-img-element -- the admin previews the file
          as uploaded; next/image would re-optimise an image the library has already
          encoded, and its loader cannot reach an API path at build time. */}
      <img src={asset.url} alt={asset.altText} className="aspect-[4/3] w-full bg-admin-sunken object-cover" />

      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        {editing ? (
          <>
            <label className="sr-only" htmlFor={`alt-${asset.id}`}>
              Alt text
            </label>
            <input
              id={`alt-${asset.id}`}
              value={altText}
              onChange={(event) => {
                setAltText(event.target.value);
              }}
              className="h-[28px] rounded-[4px] border border-admin-line bg-admin-sunken px-2 text-[12px] text-admin-ink outline-none focus-visible:border-admin-focus"
            />
            <div className="flex gap-1.5">
              <Small
                busy={busy}
                onClick={() => {
                  run(adminMutate(`/admin/media/${encodeURIComponent(asset.id)}`, { method: 'PATCH', body: { altText } }));
                }}
              >
                Save
              </Small>
              <Small
                busy={busy}
                onClick={() => {
                  setAltText(asset.altText);
                  setEditing(false);
                }}
              >
                Cancel
              </Small>
            </div>
          </>
        ) : (
          <>
            <p className="line-clamp-2 text-[12px] text-admin-ink">{asset.altText}</p>
            <p className="text-[10.5px] text-admin-muted tabular-nums">
              {asset.width && asset.height ? `${String(asset.width)}×${String(asset.height)}` : 'unknown size'}
              {asset.sizeBytes ? ` · ${String(Math.round(asset.sizeBytes / 1024))} kB` : ''} · {asset.variantCount}{' '}
              variants
            </p>
            <div className="mt-auto flex gap-1.5 pt-1.5">
              <Small
                busy={busy}
                onClick={() => {
                  setEditing(true);
                }}
              >
                Edit text
              </Small>
              <Small
                busy={busy}
                onClick={() => {
                  run(adminMutate(`/admin/media/${encodeURIComponent(asset.id)}`, { method: 'DELETE' }));
                }}
              >
                Delete
              </Small>
            </div>
          </>
        )}
      </div>
    </li>
  );
}

function Small({ busy, onClick, children }: { busy: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="h-[26px] rounded-[4px] border border-admin-line px-2 text-[11.5px] font-semibold text-admin-body hover:border-admin-focus hover:text-admin-ink disabled:opacity-40"
    >
      {children}
    </button>
  );
}
