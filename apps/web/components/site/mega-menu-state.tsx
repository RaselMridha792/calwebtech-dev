'use client';

import { useEffect } from 'react';

const GROUP = '[data-mega]';

function groupOf(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>(GROUP) : null;
}

function buttonOf(group: HTMLElement): HTMLButtonElement | null {
  return group.querySelector<HTMLButtonElement>(':scope > button[aria-controls]');
}

/** Clears a dismissal once focus and the pointer have both left, then mirrors the panel's state. */
function sync(group: HTMLElement): void {
  const active = group.matches(':focus-within') || group.matches(':hover');
  if (!active) delete group.dataset.dismissed;
  buttonOf(group)?.setAttribute('aria-expanded', String(active && group.dataset.dismissed === undefined));
}

/** A path with its trailing slash, so `/services` and `/services/` compare equal. */
function slashed(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}

/** Where a header link leads on this site, or null for the homepage, an anchor or elsewhere. */
function pathOf(link: HTMLAnchorElement): string | null {
  if (link.origin !== location.origin || link.hash !== '') return null;
  const path = slashed(link.pathname);
  return path === '/' ? null : path;
}

/**
 * Marks where the reader is. A link to this very page is `aria-current="page"`; a top-level
 * link whose section holds it, like Services on a service page, is `aria-current="true"`; a
 * menu is current when its label is, or, for Resources, which has no page of its own, when
 * one of its lists leads here. Each carries `data-current` for the stylesheet. The site
 * navigates by full page loads, so this runs once per page.
 */
function markCurrent(header: Element): void {
  const here = slashed(location.pathname);
  const within = (link: HTMLAnchorElement) => {
    const path = pathOf(link);
    return path !== null && here.startsWith(path);
  };
  const mark = (element: HTMLElement, value: 'page' | 'true' | null) => {
    if (value !== null) element.setAttribute('aria-current', value);
    element.dataset.current = '';
  };

  for (const link of header.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    if (pathOf(link) === here) mark(link, 'page');
  }
  // The bar's own links: the menu labels and the plain links beside them.
  for (const link of header.querySelectorAll<HTMLAnchorElement>('nav > a[href], [data-mega] > a[href]')) {
    if (link.dataset.current === undefined && within(link)) mark(link, 'true');
  }
  for (const group of header.querySelectorAll<HTMLElement>(GROUP)) {
    const label = group.querySelector<HTMLAnchorElement>(':scope > a[href]');
    const links = label ? [label] : Array.from(group.querySelectorAll<HTMLAnchorElement>('li a[href]'));
    if (links.some(within)) mark(group, null);
  }
}

/**
 * The mega menus in site-header.tsx open with CSS, on hover and while focus is inside them.
 * This adds what CSS cannot: Escape dismisses an open panel without moving focus out of
 * the menu or the pointer (WCAG 1.4.13), the button reopens a dismissed panel, and each
 * button's `aria-expanded` follows what is on screen (4.1.2), and the menu and link for the
 * page being read are marked current (2.4.8). Renders nothing.
 */
export function MegaMenuState() {
  useEffect(() => {
    const header = document.querySelector('[data-site-header]');
    if (header) markCurrent(header);

    // :focus-within and :hover settle after the event that changes them.
    const syncSoon = (event: Event) => {
      const group = groupOf(event.target);
      if (group) {
        requestAnimationFrame(() => {
          sync(group);
        });
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const group = groupOf(document.activeElement) ?? document.querySelector<HTMLElement>(`${GROUP}:hover`);
      if (!group || group.dataset.dismissed !== undefined) return;
      group.dataset.dismissed = '';
      if (group.contains(document.activeElement)) buttonOf(group)?.focus();
      sync(group);
    };

    // Reopens only. Tapping a button focuses it, which already opens the panel, so a
    // toggle would close it again in the same tap.
    const onClick = (event: MouseEvent) => {
      const group = groupOf(event.target);
      if (!group || !(event.target instanceof Element) || !event.target.closest('button')) return;
      delete group.dataset.dismissed;
      sync(group);
    };

    // The light behind an open panel follows the pointer across it (site-header.tsx).
    const onPointerMove = (event: PointerEvent) => {
      const panel = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-menu]') : null;
      if (!panel) return;
      const box = panel.getBoundingClientRect();
      panel.style.setProperty('--spot-x', `${String(event.clientX - box.left)}px`);
      panel.style.setProperty('--spot-y', `${String(event.clientY - box.top)}px`);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('click', onClick);
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    for (const type of ['focusin', 'focusout', 'pointerover', 'pointerout'] as const) {
      document.addEventListener(type, syncSoon);
    }
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('click', onClick);
      document.removeEventListener('pointermove', onPointerMove);
      for (const type of ['focusin', 'focusout', 'pointerover', 'pointerout'] as const) {
        document.removeEventListener(type, syncSoon);
      }
    };
  }, []);

  return null;
}
