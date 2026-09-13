import type { Attribution, Utm } from '@calwebtech/shared';
import { utmFromSearchParams } from './utm';

const FIRST_TOUCH_KEY = 'cwt:first-touch';

interface FirstTouch {
  utm?: Utm;
  landingPage: string;
  referrer?: string;
}

function isFirstTouch(value: unknown): value is FirstTouch {
  return (
    typeof value === 'object' &&
    value !== null &&
    'landingPage' in value &&
    typeof value.landingPage === 'string'
  );
}

function readFirstTouch(): FirstTouch | null {
  try {
    const raw = window.localStorage.getItem(FIRST_TOUCH_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return isFirstTouch(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeFirstTouch(touch: FirstTouch): void {
  try {
    window.localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(touch));
  } catch {
    // Storage can be unavailable (private mode, blocked). Attribution still sends last touch.
  }
}

function deviceType(): NonNullable<Attribution['device']> {
  if (window.matchMedia('(max-width: 767px)').matches) return 'mobile';
  if (window.matchMedia('(max-width: 1023px)').matches) return 'tablet';
  return 'desktop';
}

/**
 * Records the first visit once, then returns first and last touch for a form
 * submission. Runs in the browser only.
 */
export function captureAttribution(): Attribution {
  const url = new URL(window.location.href);
  const lastTouch = utmFromSearchParams(url.searchParams);
  let firstTouch = readFirstTouch();
  if (!firstTouch) {
    firstTouch = {
      utm: lastTouch,
      landingPage: url.pathname,
      referrer: document.referrer || undefined,
    };
    writeFirstTouch(firstTouch);
  }
  return {
    firstTouch: firstTouch.utm,
    lastTouch,
    referrer: firstTouch.referrer?.slice(0, 2000),
    landingPage: firstTouch.landingPage.slice(0, 2000),
    device: deviceType(),
  };
}
