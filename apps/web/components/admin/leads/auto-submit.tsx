'use client';
import { useEffect, useRef } from 'react';

/**
 * Applies a filter the moment it changes, which is what the design asks for, without making
 * the filter bar a controlled React form. The form works exactly as well without this — it
 * is a plain GET form and Enter still submits it — so this is enhancement, not plumbing.
 *
 * Free-text inputs opt out with `data-autosubmit="skip"`: submitting on every keystroke
 * would reload the table mid-word.
 */
export function AutoSubmit() {
  const anchor = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const form = anchor.current?.closest('form');
    if (!form) return undefined;

    const onChange = (event: Event): void => {
      const target = event.target;
      if (target instanceof HTMLElement && target.dataset.autosubmit === 'skip') return;
      form.requestSubmit();
    };

    form.addEventListener('change', onChange);
    return () => {
      form.removeEventListener('change', onChange);
    };
  }, []);

  return <span ref={anchor} hidden />;
}
