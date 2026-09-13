'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { PauseIcon, PlayIcon } from '../ui/icons';

const ADVANCE_MS = 5200;

interface StepTab {
  title: string;
  timing: string;
}

/**
 * Tabbed process walkthrough. Panels are rendered on the server and passed in, so
 * this component only owns selection. It advances on its own while in view until
 * the visitor takes control, and can be paused (WCAG 2.2.2). Arrow keys, Home and
 * End move between steps.
 */
export function ProcessStepper({ tabs, panels }: { tabs: StepTab[]; panels: ReactNode[] }) {
  const [active, setActive] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const count = tabs.length;

  useEffect(() => {
    const root = rootRef.current;
    if (!autoplay || count < 2 || !root) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let timer: number | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          timer ??= window.setInterval(() => {
            setActive((index) => (index + 1) % count);
          }, ADVANCE_MS);
        } else if (timer !== undefined) {
          window.clearInterval(timer);
          timer = undefined;
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(root);
    return () => {
      observer.disconnect();
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [autoplay, count]);

  const select = (index: number, moveFocus = false) => {
    setAutoplay(false);
    setActive(index);
    if (moveFocus) tabRefs.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const keys: Record<string, number> = {
      ArrowRight: (index + 1) % count,
      ArrowDown: (index + 1) % count,
      ArrowLeft: (index - 1 + count) % count,
      ArrowUp: (index - 1 + count) % count,
      Home: 0,
      End: count - 1,
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next, true);
  };

  if (count === 0) return null;
  const progress = count > 1 ? (active / (count - 1)) * 0.9 + 0.1 : 1;

  return (
    <div ref={rootRef}>
      <div className="relative">
        <div className="absolute top-6 right-0 left-0 hidden h-px bg-white/15 md:block" aria-hidden="true" />
        <div
          className="absolute top-6 right-0 left-0 hidden h-px origin-left bg-primary transition-transform duration-500 ease-(--ease-out-soft) md:block"
          style={{ transform: `scaleX(${progress})` }}
          aria-hidden="true"
        />
        <div role="tablist" aria-label="Project process" className="relative grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-5">
          {tabs.map((tab, index) => {
            const selected = index === active;
            return (
              <button
                key={tab.title}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                id={`${baseId}-tab-${index}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${baseId}-panel-${index}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => {
                  select(index);
                }}
                onKeyDown={(event) => {
                  onKeyDown(event, index);
                }}
                className="text-left"
              >
                <span
                  className={`grid h-12 w-12 place-items-center rounded-full border-2 font-display font-bold transition-colors ${selected ? 'border-primary bg-primary text-white' : 'border-white/25 bg-ink text-white/70'}`}
                >
                  {index + 1}
                </span>
                <span
                  className={`mt-3 block font-display text-[15px] font-bold transition-colors ${selected ? 'text-white' : 'text-white/60'}`}
                >
                  {tab.title}
                </span>
                <span className="mt-0.5 block text-[12.5px] text-white/60">{tab.timing}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={() => {
            setAutoplay((value) => !value);
          }}
          aria-pressed={!autoplay}
          className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-[13px] font-medium text-white/70 hover:text-white"
        >
          {autoplay ? <PauseIcon className="h-3 w-3" /> : <PlayIcon className="h-3 w-3" />}
          {autoplay ? 'Pause the walkthrough' : 'Play the walkthrough'}
        </button>
      </div>

      <div className="mt-4">
        {panels.map((panel, index) => (
          <div
            key={tabs[index]?.title ?? index}
            id={`${baseId}-panel-${index}`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${index}`}
            hidden={index !== active}
            className="animate-panel-in items-center gap-10 lg:grid lg:grid-cols-12"
          >
            {panel}
          </div>
        ))}
      </div>
    </div>
  );
}
