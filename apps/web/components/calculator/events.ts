/**
 * The calculator's measurable events (docs/03-page-specs.md, "Each step fires a measurable
 * event"). Names come from the API view (`calculatorEvents()` in packages/shared), so the
 * contract documents them and this module only dispatches.
 *
 * Each event goes to Umami when it is loaded, and always to a DOM event on `window`, which
 * is what the end-to-end test listens for. Nothing personal is ever sent: the payload is
 * the step, the direction, and the band a result fell in.
 */

declare global {
  interface Window {
    umami?: { track: (name: string, data?: Readonly<Record<string, string | number>>) => void };
  }
}

/** The DOM event every tracked action also dispatches, for tests and for future listeners. */
export const CALCULATOR_TRACK_EVENT = 'calwebtech:track';

export type TrackPayload = Readonly<Record<string, string | number>>;

export function track(name: string, data?: TrackPayload): void {
  if (typeof window === 'undefined') return;
  try {
    window.umami?.track(name, data);
  } catch {
    // Analytics must never break the tool.
  }
  window.dispatchEvent(new CustomEvent(CALCULATOR_TRACK_EVENT, { detail: { name, data: data ?? {} } }));
}
