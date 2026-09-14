'use client';

import { useEffect } from 'react';

const MIN_DURATION_MS = 250;
const MAX_DURATION_MS = 900;
/** A landed target is left alone once it has stayed put this long. */
const STABLE_MS = 500;
const HOLD_LIMIT_MS = 3000;

/** Distance from the viewport top to where the target should sit (its scroll-margin). */
function driftOf(target: HTMLElement): number {
  return target.getBoundingClientRect().top - (Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0);
}

/**
 * Smooth scrolling for in-page links that lands where the target is now, not where it
 * was when the scroll began.
 *
 * CSS `scroll-behavior: smooth` fixes its destination up front. Sections with
 * `content-visibility: auto` then render at their real height as the page passes them,
 * the target moves, and the scroll stops hundreds of pixels away. This glide re-reads
 * the target's position on every frame, then holds it in place while the sections
 * around it finish rendering. It ends with a native hash navigation, so history,
 * `:target` and the keyboard focus starting point behave as for a plain link. With
 * reduced motion the browser jumps instantly and only the hold applies.
 */
export function AnchorScroll() {
  useEffect(() => {
    let frame = 0;
    const cancel = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const hold = (target: HTMLElement) => {
      cancel();
      const started = performance.now();
      let stableSince = started;
      const tick = (now: number) => {
        const drift = driftOf(target);
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const canMove = drift < 0 ? window.scrollY > 0 : window.scrollY < maxScroll - 1;
        if (Math.abs(drift) > 1 && canMove) {
          window.scrollBy(0, drift);
          stableSince = now;
        }
        frame = now - stableSince < STABLE_MS && now - started < HOLD_LIMIT_MS ? requestAnimationFrame(tick) : 0;
      };
      frame = requestAnimationFrame(tick);
    };

    const glide = (target: HTMLElement, hash: string) => {
      cancel();
      const destination = () => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        return Math.min(Math.max(window.scrollY + driftOf(target), 0), maxScroll);
      };
      const from = window.scrollY;
      const duration = Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, Math.abs(destination() - from) / 8));
      const start = performance.now();

      const tick = (now: number) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
        window.scrollTo(0, from + (destination() - from) * eased);
        if (progress < 1) {
          frame = requestAnimationFrame(tick);
          return;
        }
        // Already in place, so this does not move the page. It records the history entry
        // and moves the focus starting point, exactly as the plain link would have.
        window.location.assign(hash);
        hold(target);
      };
      frame = requestAnimationFrame(tick);
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;
      // In-page links: `#pricing`, and links to a section of this same page written as a
      // path, such as the site chrome's `/#estimate` on the homepage.
      const link = event.target.closest('a[href*="#"]');
      if (!(link instanceof HTMLAnchorElement)) return;
      const url = new URL(link.href);
      const here = window.location;
      if (url.origin !== here.origin || url.pathname !== here.pathname || url.search !== here.search) return;
      const hash = url.hash;
      const target = hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
      if (!target) return;

      // Following a link closes the menu it sits in: the small-screen menu (<details>), and
      // the mega menus, which stay open while focus is inside them.
      link.closest('details[open]')?.removeAttribute('open');
      if (link.closest('[data-menu]')) link.blur();

      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        // The browser's instant jump runs straight after this handler.
        hold(target);
        return;
      }
      event.preventDefault();
      glide(target, hash);
    };

    document.addEventListener('click', onClick);
    // The reader takes over as soon as they scroll or type.
    for (const type of ['wheel', 'touchstart', 'keydown'] as const) {
      window.addEventListener(type, cancel, { passive: true });
    }
    return () => {
      cancel();
      document.removeEventListener('click', onClick);
      for (const type of ['wheel', 'touchstart', 'keydown'] as const) {
        window.removeEventListener(type, cancel);
      }
    };
  }, []);

  return null;
}
