'use client';

import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import type { CalculatorViewProps } from './types';

/**
 * Loads the calculator on demand (docs/09-performance.md, "Load heavy or below-the-fold
 * widgets on interaction or visibility"), so the route's own JavaScript stays at the few
 * hundred bytes of this file.
 *
 * Until the chunk arrives the server-rendered card stays on screen, which is why this uses a
 * plain dynamic `import()` rather than `next/dynamic`: `next/dynamic` would swap the card for
 * its own loading state and shift the layout. The import starts when the section comes near
 * the viewport, or at the first touch, click or keyboard focus, whichever happens first.
 */
export function CalculatorLoader({ children, ...props }: CalculatorViewProps & { children: ReactNode }) {
  const [Calculator, setCalculator] = useState<ComponentType<CalculatorViewProps> | null>(null);
  const requested = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    if (requested.current) return;
    requested.current = true;
    void import('./calculator').then((module) => {
      setCalculator(() => module.Calculator);
    });
  }, []);

  useEffect(() => {
    const card = cardRef.current;
    if (!card || requested.current) return;
    if (!('IntersectionObserver' in window)) {
      load();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: '400px' },
    );
    observer.observe(card);
    return () => {
      observer.disconnect();
    };
  }, [load]);

  if (Calculator) return <Calculator {...props} />;
  return (
    <div ref={cardRef} onPointerDown={load} onFocusCapture={load}>
      {children}
    </div>
  );
}
