'use client';

import { useRef } from 'react';
import { PlayIcon } from '../ui/icons';

/**
 * A play button and a native modal dialog: Escape closes it, focus moves into it and
 * returns to the button. The video downloads only when the dialog opens.
 *
 * `pill` is the labelled showreel button; `overlay` covers its positioned parent (a
 * video testimonial card) with a round play mark and names the video for assistive
 * technology.
 */
export function Showreel({
  label,
  videoUrl,
  poster,
  variant = 'pill',
}: {
  label: string;
  videoUrl: string;
  poster: string | null;
  variant?: 'pill' | 'overlay';
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const open = () => {
    dialogRef.current?.showModal();
    videoRef.current?.play().catch(() => undefined);
  };
  const close = () => {
    dialogRef.current?.close();
  };

  return (
    <>
      {variant === 'overlay' ? (
        <button type="button" onClick={open} aria-label={label} className="group absolute inset-0 grid place-items-center">
          <span
            className="grid h-16 w-16 place-items-center rounded-full bg-white text-ink transition-transform group-hover:scale-105"
            aria-hidden="true"
          >
            <PlayIcon className="ml-1 h-6 w-6" />
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={open}
          className="glass inline-flex items-center gap-3 rounded-xl px-6 py-3.5 font-semibold text-white hover:bg-white/15"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-ink" aria-hidden="true">
            <PlayIcon className="ml-0.5 h-3 w-3" />
          </span>
          {label}
        </button>
      )}
      <dialog
        ref={dialogRef}
        aria-label={label}
        onClose={() => videoRef.current?.pause()}
        className="m-auto w-full max-w-4xl bg-transparent p-5 backdrop:bg-ink/90"
      >
        <div className="mb-3 flex justify-end">
          <button type="button" onClick={close} className="text-[14.5px] font-semibold text-white/80 hover:text-white">
            Close
          </button>
        </div>
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-ink ring-1 ring-white/15">
          <video
            ref={videoRef}
            src={videoUrl}
            poster={poster ?? undefined}
            className="h-full w-full object-cover"
            controls
            playsInline
            preload="none"
          />
        </div>
      </dialog>
    </>
  );
}
