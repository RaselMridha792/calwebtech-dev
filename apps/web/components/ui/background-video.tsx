'use client';

import { useEffect, useRef, useState } from 'react';
import { PauseIcon, PlayIcon } from './icons';

/**
 * A muted background loop over a section's poster (docs/05, Background video). Place it
 * after the poster layer and before the overlays, outside any aria-hidden wrapper, because
 * it renders the pause control.
 *
 * The source is set only from script, and only on screens 768px and wider with motion
 * allowed and Data Saver off, so phones keep the poster and download nothing. It fades in
 * on `canplay`, so a slow or missing file never shows a black frame, pauses whenever it is
 * off screen, and offers a pause button once it plays (WCAG 2.2.2).
 */
export function BackgroundVideo({
  src,
  className,
  controlClassName = 'right-5 bottom-5',
}: {
  src: string;
  /** Opacity once playing, e.g. `opacity-60`. */
  className: string;
  /** Where the pause button sits in the section. */
  controlClassName?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const pausedByVisitor = useRef(false);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const { connection } = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (connection?.saveData === true) return;
    if (!matchMedia('(min-width: 768px) and (prefers-reduced-motion: no-preference)').matches) return;

    const play = () => {
      if (!pausedByVisitor.current) video.play().catch(() => undefined);
    };
    const onCanPlay = () => {
      setReady(true);
      play();
    };
    video.addEventListener('canplay', onCanPlay);
    video.src = src;
    video.load();

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) play();
        else video.pause();
      },
      { threshold: 0.05 },
    );
    observer.observe(video);

    return () => {
      observer.disconnect();
      video.removeEventListener('canplay', onCanPlay);
      video.pause();
    };
  }, [src]);

  const toggle = () => {
    const video = ref.current;
    if (!video) return;
    pausedByVisitor.current = !pausedByVisitor.current;
    setPaused(pausedByVisitor.current);
    if (pausedByVisitor.current) video.pause();
    else video.play().catch(() => undefined);
  };

  return (
    <>
      <video
        ref={ref}
        className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-900 ${ready ? className : 'opacity-0'}`}
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
        tabIndex={-1}
      />
      {ready ? (
        <button
          type="button"
          onClick={toggle}
          aria-pressed={paused}
          className={`glass absolute z-20 grid h-10 w-10 place-items-center rounded-full text-white hover:bg-white/15 ${controlClassName}`}
        >
          {paused ? <PlayIcon className="ml-0.5 h-3.5 w-3.5" /> : <PauseIcon className="h-3.5 w-3.5" />}
          <span className="sr-only">Pause the background video</span>
        </button>
      ) : null}
    </>
  );
}
