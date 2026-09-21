'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { DragIcon } from '../ui/icons';

const clamp = (value: number) => Math.max(2, Math.min(98, value));

interface BeforeAfterSliderProps {
  /** Server-rendered images that fill the frame. */
  before: ReactNode;
  after: ReactNode;
  clientName: string;
}

/**
 * Drag, touch or keyboard. The range input carries the value for assistive
 * technology; the handle mirrors its focus ring. Movement uses clip-path and
 * transform only, so nothing reflows while dragging.
 */
export function BeforeAfterSlider({ before, after, clientName }: BeforeAfterSliderProps) {
  // Unique per slider, so several on one page keep their own label.
  const inputId = useId();
  const [position, setPosition] = useState(50);
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const moveTo = (clientX: number) => {
    const box = boxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    setPosition(clamp(((clientX - rect.left) / rect.width) * 100));
  };

  return (
    <div
      ref={boxRef}
      className="group relative aspect-[16/10] touch-pan-y overflow-hidden bg-canvas-raised  ring-1 ring-hairline select-none"
      onPointerDown={(event) => {
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        moveTo(event.clientX);
      }}
      onPointerMove={(event) => {
        if (dragging.current) moveTo(event.clientX);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
    >
      {before}
      <span className="absolute right-5 bottom-4 rounded bg-navy-900-invert/80 px-2 py-1 text-[11px] font-bold text-ink">
        Before
      </span>

      <div
        className="absolute inset-0 border-r-2 border-white"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        {after}
        <span className="absolute bottom-4 left-5 rounded bg-navy-900 px-2 py-1 text-[11px] font-bold text-ink-invert">
          After
        </span>
      </div>

      <div
        className="pointer-events-none absolute inset-0 z-20"
        style={{ transform: `translateX(${position - 50}%)` }}
        aria-hidden="true"
      >
        <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-canvas-raised" />
        <span className="absolute top-1/2 left-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-canvas-raised text-ink shadow-lg group-has-[input:focus-visible]:outline-3 group-has-[input:focus-visible]:outline-offset-2 group-has-[input:focus-visible]:outline-primary">
          <DragIcon className="h-5 w-5" />
        </span>
      </div>

      <label className="sr-only" htmlFor={inputId}>
        {`Reveal the redesigned ${clientName} website`}
      </label>
      <input
        id={inputId}
        type="range"
        min={2}
        max={98}
        step={1}
        value={Math.round(position)}
        aria-valuetext={`${Math.round(position)}% showing the redesign`}
        onChange={(event) => {
          setPosition(clamp(Number(event.target.value)));
        }}
        className="pointer-events-none absolute inset-x-0 bottom-3 z-30 mx-auto h-11 w-[92%] opacity-0"
      />
    </div>
  );
}
