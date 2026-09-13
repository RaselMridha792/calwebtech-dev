'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A muted background loop over its poster (docs/05, Background video). The source is set
 * only from script, and never under reduced motion, so nothing downloads for those
 * visitors. It fades in on `canplay`, so a slow or missing file never shows a black
 * frame, and pauses whenever it is off screen.
 */
export function BackgroundVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const play = () => {
      video.play().catch(() => undefined);
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

  return (
    <video
      ref={ref}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-900 ${ready ? 'opacity-100' : 'opacity-0'}`}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden="true"
    />
  );
}
