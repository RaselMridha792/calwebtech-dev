'use client';

import { useEffect } from 'react';

/**
 * Reveals `[data-reveal]` elements once as they scroll into view. A single
 * observer for the whole page, so sections stay server components.
 */
export function RevealObserver() {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-reveal-ready', '');
    if (!root.classList.contains('js-motion')) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    for (const target of document.querySelectorAll('[data-reveal]')) {
      observer.observe(target);
    }
    return () => {
      observer.disconnect();
    };
  }, []);

  return null;
}
