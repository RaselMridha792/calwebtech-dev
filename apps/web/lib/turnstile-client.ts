/** The parts of Cloudflare's explicit-rendering API the lead forms use. */
export interface TurnstileWidgetOptions {
  sitekey: string;
  action?: string;
  appearance?: 'always' | 'execute' | 'interaction-only';
  'response-field-name'?: string;
  callback?: (token: string) => void;
  'error-callback'?: (code: string) => void;
  'expired-callback'?: () => void;
}

export interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileWidgetOptions): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

// Cloudflare requires this exact URL: a proxied or cached copy breaks on their next update.
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let loading: Promise<TurnstileApi> | null = null;

/**
 * Loads Turnstile once, on demand. No third-party script runs before a visitor touches a
 * form, so it costs nothing against the page's JavaScript budget or its LCP.
 */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('Turnstile loaded without its API'));
    };
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error('Turnstile could not be loaded'));
    };
    document.head.append(script);
  });
  return loading;
}
