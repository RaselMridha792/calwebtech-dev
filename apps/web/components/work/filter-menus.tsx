'use client';

import { useEffect } from 'react';

const MENU = 'details[data-filter-menu]';

function menus(): HTMLDetailsElement[] {
  return Array.from(document.querySelectorAll<HTMLDetailsElement>(MENU));
}

/**
 * The work filters are native `<details>` menus, so they open, close and reach every option
 * without script. This adds what a menu is expected to do besides: one open at a time, a
 * click outside closes it, and Escape closes it and returns focus to its button. Renders
 * nothing.
 */
export function FilterMenus() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      for (const menu of menus()) {
        if (menu.open && !(target instanceof Node && menu.contains(target))) menu.open = false;
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      for (const menu of menus()) {
        if (!menu.open) continue;
        menu.open = false;
        menu.querySelector('summary')?.focus();
      }
    };

    // `toggle` does not bubble, so it is caught on the way down.
    const onToggle = (event: Event) => {
      const opened = event.target;
      if (!(opened instanceof HTMLDetailsElement) || !opened.open || !opened.matches(MENU)) return;
      for (const menu of menus()) {
        if (menu !== opened) menu.open = false;
      }
    };

    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('toggle', onToggle, true);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('toggle', onToggle, true);
    };
  }, []);

  return null;
}
