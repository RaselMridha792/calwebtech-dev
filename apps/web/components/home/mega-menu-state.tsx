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

/**
 * The mega menus in chrome.tsx open with CSS, on hover and while focus is inside them.
 * This adds what CSS cannot: Escape dismisses an open panel without moving focus out of
 * the menu or the pointer (WCAG 1.4.13), the button reopens a dismissed panel, and each
 * button's `aria-expanded` follows what is on screen (4.1.2). Renders nothing.
 */
export function MegaMenuState() {
  useEffect(() => {
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

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('click', onClick);
    for (const type of ['focusin', 'focusout', 'pointerover', 'pointerout'] as const) {
      document.addEventListener(type, syncSoon);
    }
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('click', onClick);
      for (const type of ['focusin', 'focusout', 'pointerover', 'pointerout'] as const) {
        document.removeEventListener(type, syncSoon);
      }
    };
  }, []);

  return null;
}
