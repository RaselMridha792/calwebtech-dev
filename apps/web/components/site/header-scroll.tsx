'use client';
import { useEffect } from 'react';

/** How far the page has to move before the bar stops floating. The brand's figure. */
const THRESHOLD = 120;

/**
 * Marks the document once the page has scrolled past the top of the hero, so the header
 * can change from floating over the plate to sitting on its own ground.
 *
 * A data attribute on `<html>` rather than state in the header: the header is a server
 * component and stays one, the whole change is CSS (globals.css, "the floating header"),
 * and nothing re-renders on scroll. The listener is passive and reads a single number.
 */
export function HeaderScrollState() {
  useEffect(() => {
    const root = document.documentElement;
    let scrolled: boolean | null = null;

    const apply = (): void => {
      const next = window.scrollY > THRESHOLD;
      if (next === scrolled) return;
      scrolled = next;
      if (next) root.setAttribute('data-scrolled', '');
      else root.removeAttribute('data-scrolled');
    };

    apply();
    window.addEventListener('scroll', apply, { passive: true });
    return () => {
      window.removeEventListener('scroll', apply);
      root.removeAttribute('data-scrolled');
    };
  }, []);

  return null;
}
